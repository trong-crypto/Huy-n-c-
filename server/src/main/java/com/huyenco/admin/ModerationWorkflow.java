package com.huyenco.admin;

import com.huyenco.common.exception.ContractException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Profile("db")
@ConditionalOnProperty(name="huyenco.auth.enabled",havingValue="true")
public class ModerationWorkflow {
    private final JdbcTemplate db;
    private final TransactionTemplate transactions;
    private final Clock clock;

    public ModerationWorkflow(JdbcTemplate db, PlatformTransactionManager manager, Clock clock) {
        this.db=db;
        this.transactions=new TransactionTemplate(manager);
        this.clock=clock;
    }

    public void decide(UUID reportId, UUID actor, UUID requestId, int version, String action, String reason, int days) {
        if (!Set.of("WARNING","TEMP_LOCK","PERMANENT_LOCK","DISMISS").contains(action)
                || reason==null || reason.isBlank() || reason.length()>2000
                || (action.equals("TEMP_LOCK") ? !Set.of(1,7,30).contains(days) : days!=0) || version<1)
            throw new ContractException("INVALID_INPUT","Cần chọn biện pháp và nhập lý do hợp lệ.");
        String note=reason.strip();
        transactions.executeWithoutResult(tx -> {
            var reports=db.queryForList("SELECT target_id FROM consultation_reports WHERE id=?",reportId);
            if(reports.isEmpty()) throw new ContractException("NOT_FOUND","Không tìm thấy báo cáo.");
            UUID account=(UUID)reports.get(0).get("target_id");
            var targets=db.queryForList("SELECT * FROM accounts WHERE id=? FOR UPDATE",account);
            var target=targets.get(0);
            // Match account-status writers: lock the account before the report.
            var report=db.queryForMap("SELECT * FROM consultation_reports WHERE id=? FOR UPDATE",reportId);
            var existing=db.queryForList("SELECT * FROM moderation_decisions WHERE id=?",requestId);
            if(!existing.isEmpty()) {
                var old=existing.get(0);
                if(!reportId.equals(old.get("report_id")) || !actor.equals(old.get("actor_id"))
                        || !action.equals(old.get("action")) || !note.equals(old.get("reason"))
                        || days!=((Number)old.get("days")).intValue() || version!=((Number)old.get("report_version")).intValue())
                    throw new ContractException("REQUEST_ID_CONFLICT","Mã xử lý đã được dùng cho quyết định khác.");
                return;
            }
            if(((Number)report.get("version")).intValue()!=version)
                throw new ContractException("VERSION_CONFLICT","Báo cáo đã thay đổi. Hãy tải lại trước khi xử lý.");
            if(!"REVIEWING".equals(report.get("status")))
                throw new ContractException("INVALID_TRANSITION","Cần bắt đầu xem xét báo cáo trước khi ra quyết định; báo cáo đã đóng phải được mở lại.");
            if(account.equals(actor)||"ADMIN".equals(target.get("role")))
                throw new ContractException("FORBIDDEN","Không áp dụng xử phạt tài khoản admin tại đây.");
            boolean locking=action.equals("TEMP_LOCK")||action.equals("PERMANENT_LOCK");
            if(locking && !"ACTIVE".equals(target.get("status")))
                throw new ContractException("INVALID_TRANSITION","Tài khoản đang bị khóa. Kiểm tra quyết định hiện hành trước khi thay đổi.");
            OffsetDateTime now=clock.instant().atOffset(ZoneOffset.UTC);
            OffsetDateTime until=action.equals("TEMP_LOCK")?now.plusDays(days):null;
            db.update("INSERT INTO moderation_decisions(id,report_id,account_id,actor_id,action,reason,days,report_version,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    requestId,reportId,account,actor,action,note,days,version,until,now);
            if(locking) {
                int next=((Number)target.get("status_version")).intValue()+1;
                db.update("UPDATE accounts SET status='LOCKED',status_version=?,lock_reason=?,lock_until=?,lock_decision_id=? WHERE id=?",next,note,until,requestId,account);
                int revoked=db.update("UPDATE account_sessions SET revoked_at=greatest(created_at,?) WHERE account_id=? AND revoked_at IS NULL AND expires_at>?",now,account,now);
                db.update("INSERT INTO admin_account_status_events(account_id,version,actor_id,previous_status,status,revoked_sessions,occurred_at,reason) VALUES (?,?,?,'ACTIVE','LOCKED',?,?,?)",
                        account,next,actor,revoked,now,note);
            }
            db.update("UPDATE consultation_reports SET status=?,admin_note=?,reviewed_by=?,reviewed_at=?,version=version+1 WHERE id=?",
                    action.equals("DISMISS")?"DISMISSED":"RESOLVED",note,actor,now,reportId);
            // The reporter receives only the result, never private account details or the admin's internal note.
            notify((UUID)report.get("reporter_id"),requestId,"Kết quả báo cáo tư vấn",
                    action.equals("DISMISS")?"Admin đã xem xét báo cáo của bạn và chưa đủ căn cứ để xác định vi phạm.":"Admin đã xem xét báo cáo của bạn và áp dụng biện pháp xử lý phù hợp.",now);
            if(!action.equals("DISMISS")) {
                String measure=action.equals("WARNING")?"Cảnh cáo":until==null?"Khóa không thời hạn":"Tạm khóa "+days+" ngày, đến "+until.toInstant();
                notify(account,requestId,"Thông báo xử lý từ admin",measure+". Lý do: "+note+". Liên hệ: ddaotrondz2005@gmail.com",now);
            }
        });
    }

    private void notify(UUID account,UUID decision,String title,String body,OffsetDateTime now) {
        db.update("INSERT INTO moderation_notifications(id,account_id,decision_id,title,body,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(account_id,decision_id) DO NOTHING",
                UUID.randomUUID(),account,decision,title,body,now);
    }

    @Scheduled(fixedDelay=15000,initialDelay=1000)
    public void expireLocks() {
        transactions.executeWithoutResult(tx -> {
            OffsetDateTime now=clock.instant().atOffset(ZoneOffset.UTC);
            var expired=db.queryForList("SELECT id,lock_decision_id FROM accounts WHERE status='LOCKED' AND lock_until<=? ORDER BY lock_until LIMIT 100 FOR UPDATE SKIP LOCKED",now);
            for(var account:expired) {
                UUID id=(UUID)account.get("id"),decision=UUID.randomUUID();
                db.update("UPDATE accounts SET status='ACTIVE',status_version=status_version+1,lock_reason=NULL,lock_until=NULL,lock_decision_id=NULL WHERE id=?",id);
                db.update("INSERT INTO moderation_decisions(id,account_id,action,reason,created_at) VALUES (?,?,'AUTO_UNLOCK','Hết thời hạn tạm khóa',?)",decision,id,now);
                notify(id,decision,"Tài khoản đã được mở khóa","Thời hạn tạm khóa đã kết thúc. Bạn có thể đăng nhập lại. Vui lòng tuân thủ quy định sử dụng hệ thống.",now);
            }
        });
    }
}

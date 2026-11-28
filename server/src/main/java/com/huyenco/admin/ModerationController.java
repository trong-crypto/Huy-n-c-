package com.huyenco.admin;

import static com.huyenco.admin.AdminDirectoryHttp.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.auth.ChatSessionAccess;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("db")
@ConditionalOnProperty(name="huyenco.auth.enabled",havingValue="true")
public class ModerationController {
    private static final Logger LOG=LoggerFactory.getLogger(ModerationController.class);
    private final JdbcTemplate db;
    private final ModerationWorkflow workflow;
    private final AdminRequestAccess admins;
    private final ChatSessionAccess sessions;
    private final ObjectReader reader;
    public ModerationController(JdbcTemplate db,ModerationWorkflow workflow,AdminRequestAccess admins,ChatSessionAccess sessions,ObjectMapper mapper) {
        this.db=db;this.workflow=workflow;this.admins=admins;this.sessions=sessions;this.reader=reader(mapper);
    }
    @PostMapping("/api/v1/admin/reports/{id}/decisions")
    ResponseEntity<Envelope> decide(HttpServletRequest request,@PathVariable String id) {
        return respond(LOG,200,()->{
            var actor=admins.require(request,true);query(request,Set.of());var b=body(request,reader,12000);
            if(b.size()!=5||!b.path("action").isTextual()||!b.path("note").isTextual()||!b.path("requestId").isTextual()||!b.path("days").isInt()||!b.path("expectedVersion").isInt())throw invalid();
            workflow.decide(uuid(id),actor,uuid(b.path("requestId").asText()),b.path("expectedVersion").intValue(),b.path("action").asText(),b.path("note").asText(),b.path("days").intValue());
            return Map.of("saved",true);
        });
    }
    @GetMapping("/api/v1/admin/accounts/{id}/moderation")
    ResponseEntity<Envelope> history(HttpServletRequest request,@PathVariable String id) {
        return respond(LOG,200,()->{admins.require(request,false);query(request,Set.of("page"));int page=number(request.getParameter("page"),0,0,Integer.MAX_VALUE);
            return Map.of("items",db.queryForList("""
                SELECT d.id::text AS id,d.action,d.reason,d.created_at,d.expires_at,a.display_name AS actor_name
                FROM moderation_decisions d LEFT JOIN accounts a ON a.id=d.actor_id WHERE d.account_id=?
                UNION ALL
                SELECT 'status-'||e.version,CASE WHEN e.status='LOCKED' THEN 'MANUAL_LOCK' ELSE 'MANUAL_UNLOCK' END,
                    coalesce(e.reason,'Mở khóa tài khoản'),e.occurred_at,NULL::timestamptz,a.display_name
                FROM admin_account_status_events e LEFT JOIN accounts a ON a.id=e.actor_id
                WHERE e.account_id=? AND NOT EXISTS (
                    SELECT 1 FROM moderation_decisions d WHERE d.account_id=e.account_id
                    AND d.actor_id=e.actor_id AND d.created_at=e.occurred_at AND d.action IN ('TEMP_LOCK','PERMANENT_LOCK'))
                ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?
                """,uuid(id),uuid(id),(long)page*20));});
    }
    @GetMapping("/api/v1/chat/moderation-notifications")
    ResponseEntity<Envelope> notifications(HttpServletRequest request) {
        return respond(LOG,200,()->{var actor=sessions.requireRead(request);query(request,Set.of("page"));int page=number(request.getParameter("page"),0,0,Integer.MAX_VALUE);
            return Map.of("items",db.queryForList("SELECT id,title,body,created_at,read_at FROM moderation_notifications WHERE account_id=? ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?",actor.accountId(),(long)page*20),
                    "unread",db.queryForObject("SELECT count(*) FROM moderation_notifications WHERE account_id=? AND read_at IS NULL",Long.class,actor.accountId()));});
    }
    @PutMapping("/api/v1/chat/moderation-notifications/{id}/read")
    ResponseEntity<Envelope> read(HttpServletRequest request,@PathVariable String id) {
        return respond(LOG,200,()->{var actor=sessions.requireWrite(request);query(request,Set.of());
            db.update("UPDATE moderation_notifications SET read_at=coalesce(read_at,now()) WHERE id=? AND account_id=?",uuid(id),actor.accountId());return Map.of("saved",true);});
    }
}

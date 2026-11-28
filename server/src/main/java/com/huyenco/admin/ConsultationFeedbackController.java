package com.huyenco.admin;

import static com.huyenco.admin.AdminDirectoryHttp.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

@RestController
@Profile("db")
@ConditionalOnProperty(name="huyenco.auth.enabled",havingValue="true")
public class ConsultationFeedbackController {
 private static final Logger LOG=LoggerFactory.getLogger(ConsultationFeedbackController.class);
 private final JdbcTemplate db;
 private final ChatSessionAccess sessions;
 private final AdminRequestAccess admins;
 private final ObjectReader reader;
 private final TransactionTemplate tx;
 private final com.huyenco.websocket.AdminReviewNotifications notifications;
 public ConsultationFeedbackController(JdbcTemplate db,ChatSessionAccess sessions,AdminRequestAccess admins,ObjectMapper mapper,PlatformTransactionManager manager,com.huyenco.websocket.AdminReviewNotifications notifications) {
  this.db=db;this.sessions=sessions;this.admins=admins;this.reader=reader(mapper);this.tx=new TransactionTemplate(manager);this.notifications=notifications;
 }
 private Map<String,Object> room(UUID id,ChatSessionAccess.Actor actor) {
  var rows=db.queryForList("SELECT * FROM chat_conversations WHERE id=? AND (user_account_id=? OR consultant_account_id=?) FOR SHARE",id,actor.accountId(),actor.accountId());
  if(rows.isEmpty()) throw new ContractException("NOT_FOUND","Không tìm thấy hội thoại.");
  return rows.get(0);
 }
 @GetMapping("/api/v1/chat/conversations/{id}/feedback")
 ResponseEntity<Envelope> feedback(HttpServletRequest req,@PathVariable String id) {
  return respond(LOG,200,()->tx.execute(s->{var a=sessions.requireRead(req);query(req,Set.of());UUID key=uuid(id);room(key,a);
   var rating=db.queryForList("SELECT stars FROM consultation_ratings WHERE conversation_id=? AND user_id=?",key,a.accountId());
   return Map.of("reported",db.queryForObject("SELECT count(*) FROM consultation_reports WHERE conversation_id=? AND reporter_id=?",Long.class,key,a.accountId())>0,
    "stars",rating.isEmpty()?0:((Number)rating.get(0).get("stars")).intValue());}));
 }
 @PostMapping("/api/v1/chat/conversations/{id}/reports")
 ResponseEntity<Envelope> report(HttpServletRequest req,@PathVariable String id) {
  return respond(LOG,200,()->tx.execute(s->{var a=sessions.requireWrite(req);query(req,Set.of());UUID key=uuid(id);var r=room(key,a);
   var b=body(req,reader,12000);if(b.size()!=2||!b.path("reason").isTextual()||!b.path("description").isTextual())throw invalid();
   String reason=b.path("reason").asText(),description=b.path("description").asText().strip();
   if(!Set.of("HARASSMENT","INAPPROPRIATE","FRAUD","PRIVACY","SPAM","OTHER").contains(reason)||description.length()>2000||reason.equals("OTHER")&&description.isBlank())throw invalid();
   UUID target=(UUID)r.get(a.accountId().equals(r.get("user_account_id"))?"consultant_account_id":"user_account_id");
   int inserted=db.update("INSERT INTO consultation_reports(id,conversation_id,reporter_id,target_id,reason,description) VALUES (?,?,?,?,?,?) ON CONFLICT(conversation_id,reporter_id) DO NOTHING",UUID.randomUUID(),key,a.accountId(),target,reason,description);
   if(inserted>0)org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization(){public void afterCommit(){notifications.submitted(com.huyenco.websocket.AdminReviewNotifications.Area.REPORT);}});
   return Map.of("saved",true);}));
 }
 @PutMapping("/api/v1/chat/conversations/{id}/rating")
 ResponseEntity<Envelope> rate(HttpServletRequest req,@PathVariable String id) {
  return respond(LOG,200,()->tx.execute(s->{var a=sessions.requireWrite(req);query(req,Set.of());UUID key=uuid(id);var r=room(key,a);
   if(a.role()!=ChatSessionAccess.Role.USER||!a.accountId().equals(r.get("user_account_id"))||!"COMPLETED".equals(r.get("end_reason")))throw new ContractException("FORBIDDEN","Chỉ đánh giá cuộc tư vấn đã hoàn thành.");
   var b=body(req,reader,200);if(b.size()!=1||!b.path("stars").isInt())throw invalid();int stars=b.path("stars").intValue();if(stars<1||stars>5)throw invalid();
   db.update("INSERT INTO consultation_ratings(conversation_id,user_id,consultant_id,stars) VALUES (?,?,?,?) ON CONFLICT(conversation_id) DO NOTHING",key,a.accountId(),r.get("consultant_account_id"),stars);
   return Map.of("saved",true);}));
 }
 @GetMapping("/api/v1/admin/reports")
 ResponseEntity<Envelope> list(HttpServletRequest req) {
  return respond(LOG,200,()->{admins.require(req,false);query(req,Set.of("page","status"));int page=number(req.getParameter("page"),0,0,Integer.MAX_VALUE);
   String status=req.getParameter("status");if(status==null)status="PENDING";
   if(!Set.of("ALL","PENDING","REVIEWING","RESOLVED","DISMISSED").contains(status))throw invalid();
   String filter=status.equals("ALL")?"":" WHERE r.status=?";var args=new ArrayList<Object>();if(!status.equals("ALL"))args.add(status);
   long total=db.queryForObject("SELECT count(*) FROM consultation_reports r"+filter,Long.class,args.toArray());args.add(20);args.add((long)page*20);
   var items=db.queryForList("SELECT r.*,a.display_name AS reporter_name,t.display_name AS target_name,t.status AS target_status FROM consultation_reports r JOIN accounts a ON a.id=r.reporter_id JOIN accounts t ON t.id=r.target_id"+filter+" ORDER BY r.created_at DESC,r.id DESC LIMIT ? OFFSET ?",args.toArray());
   return Map.of("items",items,"page",page,"totalPages",(total+19)/20,"totalElements",total);});
 }
 @PutMapping("/api/v1/admin/reports/{id}")
 ResponseEntity<Envelope> review(HttpServletRequest req,@PathVariable String id) {
  return respond(LOG,200,()->tx.execute(s->{UUID actor=admins.require(req,true);query(req,Set.of());var b=body(req,reader,12000);
   if(b.size()!=3||!b.path("status").isTextual()||!b.path("note").isTextual()||!b.path("expectedVersion").isInt()||b.path("expectedVersion").intValue()<1)throw invalid();String status=b.path("status").asText(),note=b.path("note").asText().strip();
   if(!"REVIEWING".equals(status)||note.length()>2000||note.isEmpty())throw invalid();
   var rows=db.queryForList("SELECT status,version FROM consultation_reports WHERE id=? FOR UPDATE",uuid(id));
   if(rows.isEmpty())throw new ContractException("NOT_FOUND","Không tìm thấy báo cáo.");
   int version=((Number)rows.get(0).get("version")).intValue();
   if(version!=b.path("expectedVersion").intValue())throw new ContractException("VERSION_CONFLICT","Báo cáo đã thay đổi. Hãy tải lại trước khi xử lý.");
   db.update("UPDATE consultation_reports SET status='REVIEWING',review_note=?,reviewed_by=?,reviewed_at=now(),version=version+1 WHERE id=?",note,actor,uuid(id));
   db.update("INSERT INTO consultation_report_reviews(id,report_id,actor_id,previous_status,status,note,version) VALUES (?,?,?,?,'REVIEWING',?,?)",UUID.randomUUID(),uuid(id),actor,rows.get(0).get("status"),note,version+1);
   return Map.of("saved",true);}));
 }
 @GetMapping("/api/v1/admin/reports/{id}")
 ResponseEntity<Envelope> detail(HttpServletRequest req,@PathVariable String id) {
  return respond(LOG,200,()->{admins.require(req,false);query(req,Set.of());
   var rows=db.queryForList("""
    SELECT r.*,a.display_name AS reporter_name,t.display_name AS target_name,t.status AS target_status,
      d.action AS decision_action,d.reason AS decision_reason,d.created_at AS decision_at,
      d.expires_at AS decision_expires_at,reviewer.display_name AS decision_actor
    FROM consultation_reports r JOIN accounts a ON a.id=r.reporter_id JOIN accounts t ON t.id=r.target_id
    LEFT JOIN LATERAL (SELECT * FROM moderation_decisions WHERE report_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) d ON true
    LEFT JOIN accounts reviewer ON reviewer.id=d.actor_id WHERE r.id=?
    """,uuid(id));
   if(rows.isEmpty())throw new ContractException("NOT_FOUND","Không tìm thấy báo cáo.");
   var detail=rows.get(0);
   detail.put("review_events",db.queryForList("SELECT e.id,e.previous_status,e.note,e.created_at,a.display_name AS actor_name FROM consultation_report_reviews e JOIN accounts a ON a.id=e.actor_id WHERE e.report_id=? ORDER BY e.created_at DESC,e.version DESC LIMIT 30",uuid(id)));
   return detail;});
 }
 @GetMapping("/api/v1/admin/reports/{id}/messages")
 ResponseEntity<Envelope> evidence(HttpServletRequest req,@PathVariable String id) {
  return respond(LOG,200,()->{admins.require(req,false);query(req,Set.of("page"));int page=number(req.getParameter("page"),0,0,Integer.MAX_VALUE);
   var rows=db.queryForList("SELECT conversation_id FROM consultation_reports WHERE id=?",uuid(id));
   if(rows.isEmpty())throw new ContractException("NOT_FOUND","Không tìm thấy báo cáo.");
   return Map.of("items",db.queryForList("SELECT m.sequence,m.body AS text,m.created_at,a.display_name AS sender_name FROM chat_messages m JOIN accounts a ON a.id=m.sender_account_id WHERE m.conversation_id=? ORDER BY m.sequence LIMIT 50 OFFSET ?",rows.get(0).get("conversation_id"),(long)page*50));});
 }
}

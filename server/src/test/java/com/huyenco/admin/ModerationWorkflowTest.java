package com.huyenco.admin;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.common.exception.ContractException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ModerationWorkflowTest {
 @Test
 @EnabledIfEnvironmentVariable(named="ADMIN_STATS_TEST_URL",matches="jdbc:postgresql://127[.]0[.]0[.]1:[0-9]+/[a-zA-Z0-9_]+")
 void decisionsAreAuditedPrivateIdempotentAndTemporaryLocksExpireExactlyOnce() throws Exception {
  try(var connection=DriverManager.getConnection(System.getenv("ADMIN_STATS_TEST_URL"),System.getenv("ADMIN_STATS_TEST_USER"),System.getenv("ADMIN_STATS_TEST_PASSWORD"))){
   var source=new SingleConnectionDataSource(connection,true);var db=new JdbcTemplate(source);var manager=new DataSourceTransactionManager(source);
   db.execute("CREATE TEMP TABLE accounts(id uuid PRIMARY KEY,display_name text,status text,role text,status_version int DEFAULT 1)");
   db.execute("CREATE TEMP TABLE chat_conversations(id uuid PRIMARY KEY)");
   db.execute("CREATE TEMP TABLE admin_account_status_events(account_id uuid,version int,actor_id uuid,previous_status text,status text,revoked_sessions int,occurred_at timestamptz)");
   db.execute("CREATE TEMP TABLE account_sessions(account_id uuid,created_at timestamptz,expires_at timestamptz,revoked_at timestamptz)");
   for(String file:new String[]{"V41__consultation_feedback.sql","V42__moderation_workflow.sql","V43__report_review_flow.sql"})db.execute(Files.readString(Path.of("src/main/resources/db/migration/"+file)).replace("CREATE TABLE ","CREATE TEMP TABLE "));
   UUID user=UUID.randomUUID(),target=UUID.randomUUID(),admin=UUID.randomUUID(),room=UUID.randomUUID(),report=UUID.randomUUID();
   db.update("INSERT INTO pg_temp.accounts(id,display_name,status,role) VALUES (?,'Reporter','ACTIVE','USER'),(?,'Target','ACTIVE','CONSULTANT'),(?,'Admin','ACTIVE','ADMIN')",user,target,admin);
   db.update("INSERT INTO pg_temp.chat_conversations VALUES (?)",room);
   db.update("INSERT INTO pg_temp.consultation_reports(id,conversation_id,reporter_id,target_id,reason) VALUES (?,?,?,?,'SPAM')",report,room,user,target);
   Instant start=Instant.parse("2026-11-28T10:00:00Z");var service=new ModerationWorkflow(db,manager,Clock.fixed(start,ZoneOffset.UTC));UUID key=UUID.randomUUID();
   assertEquals("INVALID_TRANSITION",assertThrows(ContractException.class,()->service.decide(report,admin,key,1,"WARNING","Private reason",0)).code());
   db.update("UPDATE pg_temp.consultation_reports SET status='REVIEWING'");
   service.decide(report,admin,key,1,"WARNING","Private reason",0);
   service.decide(report,admin,key,1,"WARNING","Private reason",0);
   assertEquals(1,db.queryForObject("SELECT count(*) FROM pg_temp.moderation_decisions",Integer.class));
   assertEquals(2,db.queryForObject("SELECT count(*) FROM pg_temp.moderation_notifications",Integer.class));
   assertEquals("ACTIVE",db.queryForObject("SELECT status FROM pg_temp.accounts WHERE id=?",String.class,target));
   assertFalse(db.queryForObject("SELECT body FROM pg_temp.moderation_notifications WHERE account_id=?",String.class,user).contains("Private reason"));
   assertTrue(db.queryForObject("SELECT body FROM pg_temp.moderation_notifications WHERE account_id=?",String.class,target).contains("Private reason"));
   assertEquals("REQUEST_ID_CONFLICT",assertThrows(ContractException.class,()->service.decide(report,admin,key,1,"WARNING","Different",0)).code());
   assertEquals("VERSION_CONFLICT",assertThrows(ContractException.class,()->service.decide(report,admin,UUID.randomUUID(),1,"TEMP_LOCK","Reason",7)).code());
   db.update("UPDATE pg_temp.consultation_reports SET status='REVIEWING',version=3");
   db.update("INSERT INTO pg_temp.account_sessions VALUES (?,?,?,null)",target,OffsetDateTime.ofInstant(start,ZoneOffset.UTC),OffsetDateTime.ofInstant(start.plusSeconds(3600),ZoneOffset.UTC));
   service.decide(report,admin,UUID.randomUUID(),3,"TEMP_LOCK","Temporary reason",7);
   assertEquals("LOCKED",db.queryForObject("SELECT status FROM pg_temp.accounts WHERE id=?",String.class,target));
   assertEquals(1,db.queryForObject("SELECT count(*) FROM pg_temp.account_sessions WHERE revoked_at IS NOT NULL",Integer.class));
   service.expireLocks();assertEquals("LOCKED",db.queryForObject("SELECT status FROM pg_temp.accounts WHERE id=?",String.class,target));
   var later=new ModerationWorkflow(db,manager,Clock.fixed(start.plus(Duration.ofDays(7)),ZoneOffset.UTC));later.expireLocks();later.expireLocks();
   assertEquals("ACTIVE",db.queryForObject("SELECT status FROM pg_temp.accounts WHERE id=?",String.class,target));
   assertEquals(1,db.queryForObject("SELECT count(*) FROM pg_temp.moderation_decisions WHERE action='AUTO_UNLOCK'",Integer.class));
   db.update("UPDATE pg_temp.consultation_reports SET status='REVIEWING',version=5");
   later.decide(report,admin,UUID.randomUUID(),5,"PERMANENT_LOCK","Permanent reason",0);
   new ModerationWorkflow(db,manager,Clock.fixed(start.plus(Duration.ofDays(100)),ZoneOffset.UTC)).expireLocks();
   assertEquals("LOCKED",db.queryForObject("SELECT status FROM pg_temp.accounts WHERE id=?",String.class,target));
   assertNull(db.queryForObject("SELECT lock_until FROM pg_temp.accounts WHERE id=?",OffsetDateTime.class,target));
   var sessions=mock(ChatSessionAccess.class);var access=mock(AdminRequestAccess.class);
   when(sessions.requireRead(any())).thenReturn(new ChatSessionAccess.Actor(user,ChatSessionAccess.Role.USER,"2099-01-01T00:00:00Z"));
   when(sessions.requireWrite(any())).thenReturn(new ChatSessionAccess.Actor(user,ChatSessionAccess.Role.USER,"2099-01-01T00:00:00Z"));
   when(access.require(any(),anyBoolean())).thenReturn(admin);
   var mvc=MockMvcBuilders.standaloneSetup(new ModerationController(db,later,access,sessions,new ObjectMapper())).build();
   mvc.perform(get("/api/v1/admin/accounts/"+target+"/moderation")).andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(4));
   UUID privateNotice=db.queryForObject("SELECT id FROM pg_temp.moderation_notifications WHERE account_id=? LIMIT 1",UUID.class,target);
   mvc.perform(put("/api/v1/chat/moderation-notifications/"+privateNotice+"/read")).andExpect(status().isOk());
   assertNull(db.queryForObject("SELECT read_at FROM pg_temp.moderation_notifications WHERE id=?",OffsetDateTime.class,privateNotice));
   mvc.perform(get("/api/v1/chat/moderation-notifications")).andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(3));
   var reportMvc=MockMvcBuilders.standaloneSetup(new ConsultationFeedbackController(db,sessions,access,new ObjectMapper(),manager,mock(com.huyenco.websocket.AdminReviewNotifications.class))).build();
   reportMvc.perform(get("/api/v1/admin/reports/"+report)).andExpect(status().isOk()).andExpect(jsonPath("$.data.decision_action").value("PERMANENT_LOCK"));
   reportMvc.perform(put("/api/v1/admin/reports/"+report).contentType("application/json").content("{\"status\":\"REVIEWING\",\"note\":\"\",\"expectedVersion\":6}")).andExpect(status().isBadRequest());
   String reopen="{\"status\":\"REVIEWING\",\"note\":\"New information\",\"expectedVersion\":6}";
   reportMvc.perform(put("/api/v1/admin/reports/"+report).contentType("application/json").content(reopen)).andExpect(status().isOk());
   reportMvc.perform(put("/api/v1/admin/reports/"+report).contentType("application/json").content(reopen)).andExpect(status().isConflict());
   reportMvc.perform(get("/api/v1/admin/reports/"+report)).andExpect(jsonPath("$.data.review_note").value("New information")).andExpect(jsonPath("$.data.decision_reason").value("Permanent reason")).andExpect(jsonPath("$.data.review_events.length()").value(1));
   assertEquals("LOCKED",db.queryForObject("SELECT status FROM pg_temp.accounts WHERE id=?",String.class,target));
   when(access.require(any(),anyBoolean())).thenThrow(new ContractException("INVALID_SESSION","Session required"));
   mvc.perform(get("/api/v1/admin/accounts/"+target+"/moderation")).andExpect(status().isUnauthorized());
  }
 }
}

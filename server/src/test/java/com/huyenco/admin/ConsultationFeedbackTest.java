package com.huyenco.admin;

import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.common.exception.ContractException;
import com.huyenco.websocket.AdminReviewNotifications;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ConsultationFeedbackTest {
 @Test
 @EnabledIfEnvironmentVariable(named="ADMIN_STATS_TEST_URL",matches="jdbc:postgresql://127[.]0[.]0[.]1:[0-9]+/[a-zA-Z0-9_]+")
 void enforcesParticipantsCompletionRatingUniquenessAndAdminPrivacy() throws Exception {
  try(var connection=DriverManager.getConnection(System.getenv("ADMIN_STATS_TEST_URL"),System.getenv("ADMIN_STATS_TEST_USER"),System.getenv("ADMIN_STATS_TEST_PASSWORD"))){
   var source=new SingleConnectionDataSource(connection,true);var db=new JdbcTemplate(source);
   db.execute("CREATE TEMP TABLE accounts(id uuid PRIMARY KEY,display_name text,status text)");
   db.execute("CREATE TEMP TABLE admin_account_status_events(id uuid)");
   db.execute("CREATE TEMP TABLE chat_conversations(id uuid PRIMARY KEY,user_account_id uuid,consultant_account_id uuid,status text,started_at timestamptz,end_reason text)");
   db.execute("CREATE TEMP TABLE chat_messages(conversation_id uuid,sender_account_id uuid,sequence bigint,body text,created_at timestamptz)");
   String migration=Files.readString(Path.of("src/main/resources/db/migration/V41__consultation_feedback.sql")).replace("CREATE TABLE ","CREATE TEMP TABLE ");
   db.execute(migration);
   db.execute(Files.readString(Path.of("src/main/resources/db/migration/V42__moderation_workflow.sql")).replace("CREATE TABLE ","CREATE TEMP TABLE "));
   db.execute(Files.readString(Path.of("src/main/resources/db/migration/V43__report_review_flow.sql")).replace("CREATE TABLE ","CREATE TEMP TABLE "));
   UUID user=UUID.randomUUID(),consultant=UUID.randomUUID(),admin=UUID.randomUUID(),room=UUID.randomUUID();
   for(UUID id:new UUID[]{user,consultant,admin})db.update("INSERT INTO pg_temp.accounts VALUES (?,?,'ACTIVE')",id,id.toString());
   db.update("INSERT INTO pg_temp.chat_conversations VALUES (?,?,?,'ACTIVE',now(),null)",room,user,consultant);
   var sessions=mock(ChatSessionAccess.class);var admins=mock(AdminRequestAccess.class);var notices=mock(AdminReviewNotifications.class);
   var actor=new ChatSessionAccess.Actor(user,ChatSessionAccess.Role.USER,"2099-01-01T00:00:00Z");
   when(sessions.requireRead(any())).thenReturn(actor);when(sessions.requireWrite(any())).thenReturn(actor);when(admins.require(any(),anyBoolean())).thenReturn(admin);
   var mvc=MockMvcBuilders.standaloneSetup(new ConsultationFeedbackController(db,sessions,admins,new ObjectMapper(),new DataSourceTransactionManager(source),notices)).build();
   String base="/api/v1/chat/conversations/"+room;
   mvc.perform(put(base+"/rating").contentType("application/json").content("{\"stars\":5}")).andExpect(status().isForbidden());
   mvc.perform(post(base+"/reports").contentType("application/json").content("{\"reason\":\"OTHER\",\"description\":\"\"}")).andExpect(status().isBadRequest());
   for(int i=0;i<2;i++)mvc.perform(post(base+"/reports").contentType("application/json").content("{\"reason\":\"HARASSMENT\",\"description\":\"Test report\"}")).andExpect(status().isOk());
   verify(notices,times(1)).submitted(AdminReviewNotifications.Area.REPORT);
   assertEquals(1,db.queryForObject("SELECT count(*) FROM pg_temp.consultation_reports",Integer.class));
   db.update("UPDATE pg_temp.chat_conversations SET status='ENDED',end_reason='COMPLETED'");
   mvc.perform(put(base+"/rating").contentType("application/json").content("{\"stars\":6}")).andExpect(status().isBadRequest());
   mvc.perform(put(base+"/rating").contentType("application/json").content("{\"stars\":5}")).andExpect(status().isOk());
   mvc.perform(put(base+"/rating").contentType("application/json").content("{\"stars\":1}")).andExpect(status().isOk());
   assertEquals(5,db.queryForObject("SELECT stars FROM pg_temp.consultation_ratings",Integer.class));
   mvc.perform(get(base+"/feedback")).andExpect(jsonPath("$.data.stars").value(5)).andExpect(jsonPath("$.data.reported").value(true));
   var peer=new ChatSessionAccess.Actor(consultant,ChatSessionAccess.Role.CONSULTANT,actor.expiresAt());when(sessions.requireWrite(any())).thenReturn(peer);
   mvc.perform(put(base+"/rating").contentType("application/json").content("{\"stars\":5}")).andExpect(status().isForbidden());
   mvc.perform(post(base+"/reports").contentType("application/json").content("{\"reason\":\"SPAM\",\"description\":\"\"}")).andExpect(status().isOk());
   assertEquals(user,db.queryForObject("SELECT target_id FROM pg_temp.consultation_reports WHERE reporter_id=?",UUID.class,consultant));
   when(sessions.requireWrite(any())).thenReturn(new ChatSessionAccess.Actor(admin,ChatSessionAccess.Role.USER,actor.expiresAt()));
   mvc.perform(post(base+"/reports").contentType("application/json").content("{\"reason\":\"SPAM\",\"description\":\"\"}")).andExpect(status().isNotFound());
   mvc.perform(get("/api/v1/admin/reports")).andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(2));
   UUID report=db.queryForObject("SELECT id FROM pg_temp.consultation_reports WHERE reporter_id=?",UUID.class,user);
   mvc.perform(put("/api/v1/admin/reports/"+report).contentType("application/json").content("{\"status\":\"RESOLVED\",\"note\":\"\"}")).andExpect(status().isBadRequest());
   mvc.perform(put("/api/v1/admin/reports/"+report).contentType("application/json").content("{\"status\":\"REVIEWING\",\"note\":\"Reviewed\",\"expectedVersion\":1}")).andExpect(status().isOk());
   db.update("INSERT INTO pg_temp.chat_messages VALUES (?,?,1,'Evidence',now())",room,user);
   mvc.perform(get("/api/v1/admin/reports/"+report+"/messages")).andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].text").value("Evidence"));
   when(admins.require(any(),anyBoolean())).thenThrow(new ContractException("INVALID_SESSION","Session required"));
   mvc.perform(get("/api/v1/admin/reports")).andExpect(status().isUnauthorized());
  }
 }
}

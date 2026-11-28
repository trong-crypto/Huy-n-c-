package com.huyenco.admin;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.auth.AdminRequestAccess;
import java.sql.DriverManager;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class AccountModerationTest {
 @Test
 @EnabledIfEnvironmentVariable(named="ADMIN_STATS_TEST_URL",matches="jdbc:postgresql://127[.]0[.]0[.]1:[0-9]+/[a-zA-Z0-9_]+")
 void requiresReasonRevokesSessionsAndRetainsAuditAfterUnlock() throws Exception {
  try(var connection=DriverManager.getConnection(System.getenv("ADMIN_STATS_TEST_URL"),System.getenv("ADMIN_STATS_TEST_USER"),System.getenv("ADMIN_STATS_TEST_PASSWORD"))){
   var source=new SingleConnectionDataSource(connection,true);var db=new JdbcTemplate(source);
   db.execute("CREATE TEMP TABLE accounts(id uuid PRIMARY KEY,identifier_normalized text,display_name text,role text,status text,status_version int,created_at timestamptz,phone_number text,lock_reason text,lock_until timestamptz,lock_decision_id uuid)");
   db.execute("CREATE TEMP TABLE chat_conversations(user_account_id uuid,consultant_account_id uuid,started_at timestamptz,status text,end_reason text,created_at timestamptz)");
   db.execute("CREATE TEMP TABLE consultation_ratings(consultant_id uuid,stars int)");
   db.execute("CREATE TEMP TABLE admin_account_status_events(account_id uuid,version int,actor_id uuid,previous_status text,status text,revoked_sessions int,occurred_at timestamptz,reason text)");
   db.execute("CREATE TEMP TABLE admin_account_role_events(account_id uuid,version int,actor_id uuid,previous_role text,role text,revoked_sessions int,occurred_at timestamptz)");
   db.execute("CREATE TEMP TABLE account_sessions(account_id uuid,revoked_at timestamptz,created_at timestamptz,expires_at timestamptz)");
   db.execute("CREATE TEMP TABLE password_change_requests(id uuid,account_id uuid,requested_at timestamptz,status text)");
   db.execute("CREATE TEMP TABLE consultant_profiles(account_id uuid,review_status text)");
   UUID id=UUID.randomUUID(),admin=UUID.randomUUID();db.update("INSERT INTO pg_temp.accounts VALUES (?,'user','User','USER','ACTIVE',1,now(),null,null)",id);
   db.update("INSERT INTO pg_temp.account_sessions VALUES (?,null,now(),now()+interval '1 hour')",id);
   var access=mock(AdminRequestAccess.class);when(access.require(any(),anyBoolean())).thenReturn(admin);
   var service=new AccountDirectoryService(db,Clock.systemUTC(),new DataSourceTransactionManager(source));
   var mvc=MockMvcBuilders.standaloneSetup(new AccountDirectoryController(service,Optional.of(access),new ObjectMapper())).build();String path="/api/v1/admin/accounts/"+id+"/status";
   mvc.perform(put(path).contentType("application/json").content("{\"expectedVersion\":1,\"status\":\"LOCKED\"}")).andExpect(status().isBadRequest());
   mvc.perform(put(path).contentType("application/json").content("{\"expectedVersion\":1,\"status\":\"LOCKED\",\"reason\":\"Spam\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.data.account.lockReason").value("Spam"));
   assertEquals(1,db.queryForObject("SELECT count(*) FROM pg_temp.account_sessions WHERE revoked_at IS NOT NULL",Integer.class));
   // Automatic unlocks are recorded in moderation_decisions, so an old LOCKED event must not contradict the current account.
   db.update("UPDATE pg_temp.accounts SET status='ACTIVE' WHERE id=?",id);
   assertNull(service.detail(id).lastStatusChange());
   db.update("UPDATE pg_temp.accounts SET status='LOCKED' WHERE id=?",id);
   mvc.perform(put(path).contentType("application/json").content("{\"expectedVersion\":1,\"status\":\"ACTIVE\"}")).andExpect(status().isConflict());
   mvc.perform(put(path).contentType("application/json").content("{\"expectedVersion\":2,\"status\":\"ACTIVE\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.data.account.status").value("ACTIVE"));
   assertNull(db.queryForObject("SELECT lock_reason FROM pg_temp.accounts WHERE id=?",String.class,id));
   assertEquals("Spam",db.queryForObject("SELECT reason FROM pg_temp.admin_account_status_events WHERE version=2",String.class));
   db.update("UPDATE pg_temp.accounts SET role='ADMIN'");
   mvc.perform(put(path).contentType("application/json").content("{\"expectedVersion\":3,\"status\":\"LOCKED\",\"reason\":\"Spam\"}")).andExpect(status().isForbidden());
  }
 }
}

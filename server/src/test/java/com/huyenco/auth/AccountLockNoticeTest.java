package com.huyenco.auth;
import static org.junit.jupiter.api.Assertions.*;
import java.sql.DriverManager;
import java.time.Clock;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;

class AccountLockNoticeTest {
 @Test
 @EnabledIfEnvironmentVariable(named="ADMIN_STATS_TEST_URL",matches="jdbc:postgresql://127[.]0[.]0[.]1:[0-9]+/[a-zA-Z0-9_]+")
 void showsReasonOnlyForCorrectPasswordOrExistingUnexpiredSession() throws Exception {
  try(var connection=DriverManager.getConnection(System.getenv("ADMIN_STATS_TEST_URL"),System.getenv("ADMIN_STATS_TEST_USER"),System.getenv("ADMIN_STATS_TEST_PASSWORD"))){
   var source=new SingleConnectionDataSource(connection,true);var db=new JdbcTemplate(source);
   db.execute("CREATE TEMP TABLE accounts(id uuid PRIMARY KEY,identifier_normalized text,display_name text,role text,password_hash text,status text,lock_reason text,lock_until timestamptz)");
   db.execute("CREATE TEMP TABLE account_sessions(id uuid PRIMARY KEY,account_id uuid,realm text,expires_at timestamptz,revoked_at timestamptz,token_hash text)");
   UUID id=UUID.randomUUID(),sid=UUID.randomUUID();String password=UUID.randomUUID().toString();
   db.update("INSERT INTO pg_temp.accounts VALUES (?,'locked','Locked','USER',?,'LOCKED','Spam')",id,AccountAuthService.passwordEncoder().encode(password));
   db.update("INSERT INTO pg_temp.account_sessions VALUES (?,?,'CUSTOMER',now()+interval '1 hour',now(),'fake')",sid,id);
   var service=new AccountAuthService(db,new DataSourceTransactionManager(source),Clock.systemUTC(),"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
   assertEquals("INVALID_CREDENTIALS",assertThrows(AuthFailure.class,()->service.login(AccountAuthService.Realm.CUSTOMER,"locked","wrong",null)).code);
   var locked=assertThrows(AuthFailure.class,()->service.login(AccountAuthService.Realm.CUSTOMER,"locked",password,null));
   assertEquals("ACCOUNT_SUSPENDED",locked.code);assertTrue(locked.getMessage().contains("Spam"));assertTrue(locked.getMessage().contains("ddaotrondz2005@gmail.com"));
   assertEquals("ACCOUNT_SUSPENDED",assertThrows(AuthFailure.class,()->service.requireStoredSessionById(AccountAuthService.Realm.CUSTOMER,sid)).code);
   db.update("UPDATE pg_temp.account_sessions SET expires_at=now()-interval '1 hour'");
   assertEquals("INVALID_SESSION",assertThrows(AuthFailure.class,()->service.requireStoredSessionById(AccountAuthService.Realm.CUSTOMER,sid)).code);
  }
 }
}

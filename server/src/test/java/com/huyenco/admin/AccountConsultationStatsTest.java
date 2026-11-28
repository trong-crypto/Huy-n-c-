package com.huyenco.admin;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.common.exception.ContractException;
import java.sql.DriverManager;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AccountConsultationStatsTest {
    private final UUID id = UUID.randomUUID();

    @Test
    void acceptsVietnamDateRangeAndRejectsInvalidFilters() throws Exception {
        var service = mock(AccountDirectoryService.class);
        var access = mock(AdminRequestAccess.class);
        var mvc = MockMvcBuilders.standaloneSetup(new AccountDirectoryController(service, Optional.of(access), new ObjectMapper())).build();
        mvc.perform(get("/api/v1/admin/accounts/" + id).param("from", "2026-11-01").param("to", "2026-11-25"))
                .andExpect(status().isOk());
        verify(service).detail(id, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 25));
        clearInvocations(service);
        for (String date : new String[]{"2026-02-30", "bad", "", "9999-12-31"}) {
            mvc.perform(get("/api/v1/admin/accounts/" + id).param("from", date)).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/v1/admin/accounts/" + id).param("from", "2026-11-25").param("to", "2026-11-01"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void requiresAdminSessionBeforeReadingStatistics() throws Exception {
        var service = mock(AccountDirectoryService.class);
        var access = mock(AdminRequestAccess.class);
        when(access.require(any(), eq(false))).thenThrow(new ContractException("INVALID_SESSION", "Session required"));
        var mvc = MockMvcBuilders.standaloneSetup(new AccountDirectoryController(service, Optional.of(access), new ObjectMapper())).build();
        mvc.perform(get("/api/v1/admin/accounts/" + id)).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "ADMIN_STATS_TEST_URL", matches = "jdbc:postgresql://127[.]0[.]0[.]1:[0-9]+/[a-zA-Z0-9_]+")
    void countsStatesSeparatelyAndUsesInclusiveVietnamDatesWithoutTouchingPersistentTables() throws Exception {
        try (var connection = DriverManager.getConnection(System.getenv("ADMIN_STATS_TEST_URL"),
                System.getenv("ADMIN_STATS_TEST_USER"), System.getenv("ADMIN_STATS_TEST_PASSWORD"))) {
            connection.setTransactionIsolation(java.sql.Connection.TRANSACTION_REPEATABLE_READ);
            connection.setAutoCommit(false);
            try {
                var source = new SingleConnectionDataSource(connection, true);
                var db = new JdbcTemplate(source);
                // A temporary table shadows the real table for this connection only. Rollback removes all fixtures.
                db.execute("CREATE TEMP TABLE chat_conversations (user_account_id uuid, consultant_account_id uuid, created_at timestamptz, status text, started_at timestamptz, end_reason text) ON COMMIT DROP");
                UUID consultant = UUID.randomUUID();
                for (String state : new String[]{"PENDING", "ACTIVE", "COMPLETED", "DECLINED", "CANCELLED"}) {
                    boolean accepted = state.equals("ACTIVE") || state.equals("COMPLETED");
                    db.update("INSERT INTO pg_temp.chat_conversations VALUES (?,?,'2026-11-24T17:00:00Z',?,?::timestamptz,?)",
                            id, consultant, state.equals("ACTIVE") || state.equals("PENDING") ? state : "ENDED",
                            accepted ? "2026-11-24T17:01:00Z" : null, state.equals("ACTIVE") || state.equals("PENDING") ? null : state);
                }
                db.update("INSERT INTO pg_temp.chat_conversations VALUES (?,?,'2026-11-25T17:00:00Z','PENDING',null,null)", id, consultant);
                db.update("INSERT INTO pg_temp.chat_conversations VALUES (?,?,'2026-11-24T16:59:59Z','PENDING',null,null)", id, consultant);
                var service = new AccountDirectoryService(db, Clock.systemUTC(), new DataSourceTransactionManager(source));
                var expected = new AccountDirectoryService.ConsultationCounts(5, 1, 2, 1, 1, 1, 1);
                var date = LocalDate.of(2026, 11, 25);
                assertEquals(expected, service.counts(id, "user_account_id", date, date));
                assertEquals(expected, service.counts(consultant, "consultant_account_id", date, date));
                assertEquals(7, service.counts(id, "user_account_id", null, null).total());
                assertEquals(0, service.counts(UUID.randomUUID(), "user_account_id", null, null).total());
                db.execute("CREATE TEMP TABLE consultation_ratings (consultant_id uuid, stars int) ON COMMIT DROP");
                db.execute("CREATE TEMP TABLE accounts (id uuid, identifier_normalized text, display_name text, role text, status text, status_version int, created_at timestamptz,lock_reason text DEFAULT NULL) ON COMMIT DROP");
                db.update("INSERT INTO pg_temp.accounts VALUES (?,'user','User','USER','ACTIVE',1,now(),null),(?,'consultant','Consultant','CONSULTANT','ACTIVE',1,now(),null)", id, consultant);
                var accounts = service.list("", null, null, false, 0, 20);
                assertEquals(2, accounts.totalElements());
                assertEquals(7, accounts.items().stream().filter(a -> a.id().equals(id)).findFirst().orElseThrow().consultationRequests());
                assertEquals(2, accounts.items().stream().filter(a -> a.id().equals(consultant)).findFirst().orElseThrow().consultationsAccepted());
            } finally { connection.rollback(); }
        }
    }
}

package com.huyenco.admin;

import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.auth.ChatSessionAccess.Role;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.dto.ApiError;
import com.huyenco.websocket.ChatSocketSecurity;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
class AdminOnlineController {
    private final AdminRequestAccess access;
    private final ChatSocketSecurity sockets;

    AdminOnlineController(AdminRequestAccess access, ChatSocketSecurity sockets) {
        this.access = access;
        this.sockets = sockets;
    }

    @GetMapping("/api/v1/admin/metrics/online")
    ResponseEntity<?> online(HttpServletRequest request) {
        String id = UUID.randomUUID().toString();
        try {
            access.require(request, false);
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Envelope(
                    id, "COMPLETED", new Online(sockets.onlineAccounts(Role.USER),
                    sockets.onlineAccounts(Role.CONSULTANT), Instant.now().toString()), null));
        } catch (ContractException failure) {
            return ResponseEntity.status("INVALID_SESSION".equals(failure.code()) ? 401 : 403)
                    .cacheControl(CacheControl.noStore()).body(new Envelope(id, "FAILED", null,
                            new ApiError(failure.code(), failure.getMessage(), null, null)));
        }
    }
    record Online(long users, long consultants, String sampledAt) {}
    record Envelope(String requestId, String status, Online data, ApiError error) {}
}

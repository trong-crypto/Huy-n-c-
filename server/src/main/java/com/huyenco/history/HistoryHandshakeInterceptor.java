package com.huyenco.history;

import com.huyenco.common.exception.ContractException;
import com.huyenco.knowledge.KnowledgeAccessException;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.http.server.*;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.server.HandshakeInterceptor;

/** Bind verified cookie ownership to server-only attributes, never a client-supplied STOMP header. */
@Component
public class HistoryHandshakeInterceptor implements HandshakeInterceptor {
    private final SessionService sessions;
    private final RequestGuards guards;
    public HistoryHandshakeInterceptor(SessionService sessions,RequestGuards guards){this.sessions=sessions;this.guards=guards;}
    @Override public boolean beforeHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Map<String,Object> attributes) {
        if(!(request instanceof ServletServerHttpRequest servlet)){response.setStatusCode(HttpStatus.BAD_REQUEST);return false;}
        try {
            guards.origin(servlet.getServletRequest());
            var owner=sessions.optional(servlet.getServletRequest());
            if(owner!=null)attributes.put(SessionService.WS_OWNER,owner);
            return true;
        } catch(ContractException failure) {
            response.setStatusCode("INVALID_SESSION".equals(failure.code())?HttpStatus.UNAUTHORIZED:HttpStatus.FORBIDDEN);return false;
        } catch(KnowledgeAccessException failure){response.setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);return false;}
    }
    @Override public void afterHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Exception exception) { }
}

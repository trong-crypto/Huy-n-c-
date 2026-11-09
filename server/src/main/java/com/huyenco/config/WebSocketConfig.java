package com.huyenco.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import com.huyenco.websocket.CalculationSessions;
import com.huyenco.websocket.ChatSocketSecurity;
import com.huyenco.websocket.SessionDestinationInterceptor;
import com.huyenco.websocket.SafeStompErrorHandler;
import com.huyenco.history.HistoryHandshakeInterceptor;
import java.util.Optional;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final String[] allowedOrigins;
    private final ObjectProvider<CalculationSessions> sessions;
    private final ObjectProvider<MessageChannel> outbound;
    private final HistoryHandshakeInterceptor historyHandshake;
    private final Optional<ChatSocketSecurity> chatSecurity;

    public WebSocketConfig(@Value("${huyenco.allowed-origins}") String allowedOrigins,
                           ObjectProvider<CalculationSessions> sessions,
                           @Qualifier("clientOutboundChannel") ObjectProvider<MessageChannel> outbound,
                           HistoryHandshakeInterceptor historyHandshake, Optional<ChatSocketSecurity> chatSecurity) {
        this.allowedOrigins = allowedOrigins.split("\\s*,\\s*");
        this.sessions = sessions;
        this.outbound = outbound;
        this.historyHandshake = historyHandshake;
        this.chatSecurity = chatSecurity;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.setPreserveReceiveOrder(true);
        registry.setErrorHandler(new SafeStompErrorHandler());
        registry.addEndpoint("/ws", "/api/v1/ws").addInterceptors(historyHandshake).setAllowedOriginPatterns(allowedOrigins);
        chatSecurity.ifPresent(chat -> registry.addEndpoint(ChatSocketSecurity.ENDPOINT)
                .addInterceptors(chat).setAllowedOriginPatterns(allowedOrigins));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
        registry.setPreservePublishOrder(true);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new SessionDestinationInterceptor(sessions, outbound, chatSecurity));
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        chatSecurity.ifPresent(chat -> registration.interceptors(chat.outboundGuard(outbound::getObject)));
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        registry.setMessageSizeLimit(16 * 1024);
        registry.setSendBufferSizeLimit(64 * 1024);
        registry.setSendTimeLimit(10_000);
    }
}


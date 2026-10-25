package com.huyenco.history;

import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RequestGuards {
    private final Set<String> origins;
    public RequestGuards(@Value("${huyenco.allowed-origins:http://localhost:3000}") String origins) {
        this.origins=Set.copyOf(Arrays.asList(origins.split("\\s*,\\s*")));
    }
    public void origin(HttpServletRequest request) {
        var values=Collections.list(request.getHeaders("Origin"));
        if (values.isEmpty()) return; // CLI has no Origin; mutation still requires an explicit custom header/CSRF.
        String own=request.getScheme()+"://"+request.getServerName();
        int port=request.getServerPort();
        if (!("http".equals(request.getScheme())&&port==80) && !("https".equals(request.getScheme())&&port==443)) own+=":"+port;
        if(values.size()!=1 || !(origins.contains(values.get(0)) || own.equals(values.get(0)))) reject();
    }
    public void mutation(HttpServletRequest request) {
        origin(request);
        var headers=Collections.list(request.getHeaders("X-HuyenCo-Request"));
        if(headers.size()!=1 || !"1".equals(headers.get(0))) reject();
    }
    private static void reject(){throw new ContractException("CSRF_REJECTED","Yêu cầu không vượt qua kiểm tra nguồn/CSRF.");}
}

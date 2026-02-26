package com.mentalhealth.app.security;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Component
public class RateLimitingFilter implements Filter {

    // Simple in-memory rate limiting (IP-based)
    // In a production environment with multiple instances, use Redis-based rate
    // limiting
    private final Map<String, RequestInfo> requestCounts = new ConcurrentHashMap<>();
    private static final int MAX_REQUESTS_PER_MINUTE = 60;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (!(request instanceof HttpServletRequest) || !(response instanceof HttpServletResponse)) {
            chain.doFilter(request, response);
            return;
        }

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        String clientIp = httpRequest.getRemoteAddr();

        RequestInfo info = requestCounts.compute(clientIp, (ip, currentInfo) -> {
            long now = System.currentTimeMillis();
            if (currentInfo == null || (now - currentInfo.startTime) > TimeUnit.MINUTES.toMillis(1)) {
                return new RequestInfo(now, 1);
            }
            return new RequestInfo(currentInfo.startTime, currentInfo.count + 1);
        });

        if (info.count > MAX_REQUESTS_PER_MINUTE) {
            httpResponse.setStatus(429); // Too Many Requests
            httpResponse.getWriter().write("Too many requests. Please try again later.");
            return;
        }

        chain.doFilter(request, response);
    }

    private static class RequestInfo {
        final long startTime;
        final int count;

        RequestInfo(long startTime, int count) {
            this.startTime = startTime;
            this.count = count;
        }
    }
}

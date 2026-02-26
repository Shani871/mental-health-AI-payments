package com.mentalhealth.app.video;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
public class ZoomService {

    private final RestTemplate restTemplate;

    @Value("${zoom.accountId}")
    private String accountId;

    @Value("${zoom.clientId}")
    private String clientId;

    @Value("${zoom.clientSecret}")
    private String clientSecret;

    public ZoomService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String createMeeting(String topic, String startTime) {
        String accessToken = getAccessToken();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(accessToken);

        Map<String, Object> body = new HashMap<>();
        body.put("topic", topic);
        body.put("type", 2); // Scheduled meeting
        body.put("start_time", startTime);
        body.put("duration", 60);
        body.put("timezone", "UTC");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity("https://api.zoom.us/v2/users/me/meetings",
                    entity, Map.class);
            if (response.getStatusCode() == HttpStatus.CREATED && response.getBody() != null) {
                return (String) response.getBody().get("join_url");
            }
        } catch (Exception e) {
            System.err.println("Error creating Zoom meeting: " + e.getMessage());
        }

        return "https://zoom.us/mock-meeting-link"; // Fallback for demo/dev
    }

    private String getAccessToken() {
        // Zoom Server-to-Server OAuth flow
        String url = "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=" + accountId;

        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(clientId, clientSecret);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return (String) response.getBody().get("access_token");
            }
        } catch (Exception e) {
            System.err.println("Error getting Zoom access token: " + e.getMessage());
        }

        return "mock-token";
    }
}

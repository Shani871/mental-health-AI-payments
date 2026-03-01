package com.mentalhealth.app.video;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

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
        return createMeetingDetails(topic, startTime).getJoinUrl();
    }

    public MeetingDetails createMeetingDetails(String topic, String startTime) {
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
                String meetingId = String.valueOf(response.getBody().get("id"));
                String joinUrl = String.valueOf(response.getBody().get("join_url"));
                String hostUrl = String.valueOf(response.getBody().getOrDefault("start_url", joinUrl));
                return new MeetingDetails(meetingId, joinUrl, hostUrl, 60, "ZOOM");
            }
        } catch (Exception e) {
            System.err.println("Error creating Zoom meeting: " + e.getMessage());
        }

        return new MeetingDetails(
                "mock-" + UUID.randomUUID(),
                "https://zoom.us/mock-meeting-link",
                "https://zoom.us/mock-host-link",
                60,
                "JITSI_FALLBACK");
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

    public static class MeetingDetails {
        private final String meetingId;
        private final String joinUrl;
        private final String hostUrl;
        private final Integer sessionDuration;
        private final String provider;

        public MeetingDetails(String meetingId, String joinUrl, String hostUrl, Integer sessionDuration, String provider) {
            this.meetingId = meetingId;
            this.joinUrl = joinUrl;
            this.hostUrl = hostUrl;
            this.sessionDuration = sessionDuration;
            this.provider = provider;
        }

        public String getMeetingId() {
            return meetingId;
        }

        public String getJoinUrl() {
            return joinUrl;
        }

        public String getHostUrl() {
            return hostUrl;
        }

        public Integer getSessionDuration() {
            return sessionDuration;
        }

        public String getProvider() {
            return provider;
        }
    }
}

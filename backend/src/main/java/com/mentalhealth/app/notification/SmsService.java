package com.mentalhealth.app.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SmsService {

    private static final Logger log = LoggerFactory.getLogger(SmsService.class);

    @Value("${sms.provider:mock}")
    private String provider;

    @Value("${sms.from:MindBridge}")
    private String from;

    public void sendSms(String to, String message) {
        if (to == null || to.isBlank()) {
            return;
        }
        // Placeholder implementation for Twilio/Fast2SMS integration.
        log.info("SMS [{}] to {} from {} -> {}", provider, to, from, message);
    }
}

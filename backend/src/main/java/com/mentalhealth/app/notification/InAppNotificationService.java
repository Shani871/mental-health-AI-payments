package com.mentalhealth.app.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mentalhealth.app.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class InAppNotificationService {

    private final InAppNotificationRepository notificationRepository;
    private final ObjectMapper objectMapper;

    public InAppNotificationService(InAppNotificationRepository notificationRepository, ObjectMapper objectMapper) {
        this.notificationRepository = notificationRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public InAppNotification create(User user, String type, String message, Map<String, Object> payload) {
        InAppNotification notification = new InAppNotification();
        notification.setUser(user);
        notification.setType(type);
        notification.setMessage(message);
        notification.setPayload(toJson(payload));
        notification.setRead(false);
        return notificationRepository.save(notification);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUserNotifications(UUID userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(item -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("id", item.getId());
                    row.put("type", item.getType());
                    row.put("message", item.getMessage());
                    row.put("read", item.getRead());
                    row.put("payload", item.getPayload());
                    row.put("createdAt", item.getCreatedAt());
                    return row;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getUnreadCount(UUID userId) {
        return Map.of("count", notificationRepository.countByUserIdAndReadFalse(userId));
    }

    @Transactional
    public InAppNotification markRead(UUID notificationId, UUID userId) {
        InAppNotification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        if (!notification.getUser().getId().equals(userId)) {
            throw new RuntimeException("You can only update your own notifications.");
        }
        notification.setRead(true);
        return notificationRepository.save(notification);
    }

    private String toJson(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}

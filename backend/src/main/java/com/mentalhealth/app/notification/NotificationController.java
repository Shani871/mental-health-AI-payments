package com.mentalhealth.app.notification;

import com.mentalhealth.app.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final InAppNotificationService notificationService;

    public NotificationController(InAppNotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('USER','THERAPIST','ADMIN')")
    public ResponseEntity<?> getMyNotifications() {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(notificationService.getUserNotifications(requester.getId()));
    }

    @GetMapping("/unread-count")
    @PreAuthorize("hasAnyRole('USER','THERAPIST','ADMIN')")
    public ResponseEntity<?> getUnreadCount() {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(notificationService.getUnreadCount(requester.getId()));
    }

    @PutMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('USER','THERAPIST','ADMIN')")
    public ResponseEntity<?> markRead(@PathVariable UUID id) {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        InAppNotification notification = notificationService.markRead(id, requester.getId());
        return ResponseEntity.ok(Map.of(
                "id", notification.getId(),
                "type", notification.getType(),
                "message", notification.getMessage(),
                "read", notification.getRead(),
                "payload", notification.getPayload(),
                "createdAt", notification.getCreatedAt()));
    }
}

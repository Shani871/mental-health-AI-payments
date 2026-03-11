package com.mentalhealth.app.video;

import com.mentalhealth.app.user.Role;
import com.mentalhealth.app.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/video/meetings")
public class VideoMeetingController {

    private final VideoMeetingService videoMeetingService;

    public VideoMeetingController(VideoMeetingService videoMeetingService) {
        this.videoMeetingService = videoMeetingService;
    }

    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('USER','THERAPIST')")
    public ResponseEntity<?> getMyMeetings(
            @RequestParam(required = false, name = "q") String query,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) String attendanceStatus,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        LocalDateTime fromDateTime = parseDateTime(from, "from");
        LocalDateTime toDateTime = parseDateTime(to, "to");
        if (requester.getRole() == Role.THERAPIST) {
            return ResponseEntity.ok(videoMeetingService.getTherapistMeetings(
                    requester.getId(), query, provider, attendanceStatus, fromDateTime, toDateTime));
        }
        return ResponseEntity.ok(videoMeetingService.getUserMeetings(
                requester.getId(), query, provider, attendanceStatus, fromDateTime, toDateTime));
    }

    private LocalDateTime parseDateTime(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value.trim());
        } catch (Exception ex) {
            throw new RuntimeException("Invalid " + field + " date-time. Use ISO format, e.g. 2026-03-10T18:30:00");
        }
    }
}

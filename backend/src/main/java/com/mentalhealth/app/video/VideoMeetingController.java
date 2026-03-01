package com.mentalhealth.app.video;

import com.mentalhealth.app.user.Role;
import com.mentalhealth.app.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/video/meetings")
public class VideoMeetingController {

    private final VideoMeetingService videoMeetingService;

    public VideoMeetingController(VideoMeetingService videoMeetingService) {
        this.videoMeetingService = videoMeetingService;
    }

    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('USER','THERAPIST')")
    public ResponseEntity<?> getMyMeetings() {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (requester.getRole() == Role.THERAPIST) {
            return ResponseEntity.ok(videoMeetingService.getTherapistMeetings(requester.getId()));
        }
        return ResponseEntity.ok(videoMeetingService.getUserMeetings(requester.getId()));
    }
}

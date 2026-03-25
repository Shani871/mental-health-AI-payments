package com.mentalhealth.app.dashboard;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.mentalhealth.app.user.User;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final UserDashboardService userDashboardService;

    public DashboardController(UserDashboardService userDashboardService) {
        this.userDashboardService = userDashboardService;
    }

    @GetMapping("/user")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getUserDashboard() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(userDashboardService.getUserDashboard(user.getId()));
    }

    @GetMapping("/therapist")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> getTherapistDashboard() {
        return ResponseEntity.ok(Map.of("message", "Welcome to Therapist Dashboard", "role", "THERAPIST"));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAdminDashboard() {
        return ResponseEntity.ok(Map.of("message", "Welcome to Admin Dashboard", "role", "ADMIN"));
    }
}

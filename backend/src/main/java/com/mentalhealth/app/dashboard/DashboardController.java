package com.mentalhealth.app.dashboard;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @GetMapping("/user")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getUserDashboard() {
        return ResponseEntity.ok(Map.of("message", "Welcome to User Dashboard", "role", "USER"));
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

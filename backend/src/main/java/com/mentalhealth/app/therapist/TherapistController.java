package com.mentalhealth.app.therapist;

import com.mentalhealth.app.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/therapists")
public class TherapistController {

    private final TherapistService therapistService;
    private final TherapistRepository therapistRepository;

    public TherapistController(TherapistService therapistService, TherapistRepository therapistRepository) {
        this.therapistService = therapistService;
        this.therapistRepository = therapistRepository;
    }

    @PostMapping("/profile")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<TherapistProfile> updateProfile(@RequestBody Map<String, String> request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Therapist therapist = therapistRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Therapist record not found for user"));

        TherapistProfile profile = therapistService.createOrUpdateProfile(
                therapist.getId(),
                request.get("bio"),
                request.get("profilePictureUrl"));
        return ResponseEntity.ok(profile);
    }

    @PostMapping("/availability")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<TherapistAvailability> addSlot(@RequestBody Map<String, String> request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Therapist therapist = therapistRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Therapist record not found for user"));

        LocalDateTime start = LocalDateTime.parse(request.get("startTime"));
        LocalDateTime end = LocalDateTime.parse(request.get("endTime"));

        TherapistAvailability availability = therapistService.addAvailabilitySlot(therapist.getId(), start, end);
        return ResponseEntity.ok(availability);
    }

    @GetMapping("/{id}/slots")
    public ResponseEntity<List<TherapistAvailability>> getSlots(@PathVariable UUID id) {
        return ResponseEntity.ok(therapistService.getAvailableSlots(id));
    }

    @GetMapping("/all")
    public ResponseEntity<List<Therapist>> getAllTherapists() {
        return ResponseEntity.ok(therapistRepository.findAll());
    }
}

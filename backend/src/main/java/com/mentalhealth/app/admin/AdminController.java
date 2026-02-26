package com.mentalhealth.app.admin;

import com.mentalhealth.app.therapist.Therapist;
import com.mentalhealth.app.therapist.TherapistRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final TherapistRepository therapistRepository;

    public AdminController(TherapistRepository therapistRepository) {
        this.therapistRepository = therapistRepository;
    }

    @GetMapping("/therapists/unverified")
    public ResponseEntity<List<Therapist>> getUnverifiedTherapists() {
        List<Therapist> unverified = therapistRepository.findAll().stream()
                .filter(t -> !t.getVerified())
                .collect(Collectors.toList());
        return ResponseEntity.ok(unverified);
    }

    @PutMapping("/therapists/{id}/verify")
    public ResponseEntity<?> verifyTherapist(@PathVariable UUID id) {
        Therapist therapist = therapistRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Therapist not found"));

        therapist.setVerified(true);
        therapistRepository.save(therapist);

        return ResponseEntity.ok("Therapist verified successfully!");
    }
}

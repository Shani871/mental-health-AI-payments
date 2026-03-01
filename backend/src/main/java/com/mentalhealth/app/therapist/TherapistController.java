package com.mentalhealth.app.therapist;

import com.mentalhealth.app.common.storage.FileStorageService;
import com.mentalhealth.app.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/therapists")
public class TherapistController {

    private final TherapistService therapistService;
    private final TherapistRepository therapistRepository;
    private final FileStorageService fileStorageService;

    public TherapistController(TherapistService therapistService, TherapistRepository therapistRepository,
            FileStorageService fileStorageService) {
        this.therapistService = therapistService;
        this.therapistRepository = therapistRepository;
        this.fileStorageService = fileStorageService;
    }

    @PostMapping("/profile")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<TherapistProfile> updateProfile(@RequestBody Map<String, String> request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Therapist therapist = therapistRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Therapist record not found for user"));

        if (request.containsKey("language")) {
            therapist.setLanguage(request.get("language"));
            therapistRepository.save(therapist);
        }

        TherapistProfile profile = therapistService.createOrUpdateProfile(
                therapist.getId(),
                request.get("bio"),
                request.get("profilePictureUrl"),
                request.get("licenseDocumentUrl"),
                request.get("idDocumentUrl"));
        return ResponseEntity.ok(profile);
    }

    @PostMapping("/profile/documents")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> uploadDocuments(
            @RequestParam(required = false) MultipartFile licenseDocument,
            @RequestParam(required = false) MultipartFile idDocument) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Therapist therapist = therapistRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Therapist record not found for user"));

        String licenseUrl = null;
        String idUrl = null;
        if (licenseDocument != null && !licenseDocument.isEmpty()) {
            String relative = fileStorageService.store(licenseDocument, "therapist-docs");
            licenseUrl = "/api/public/files/" + relative;
        }
        if (idDocument != null && !idDocument.isEmpty()) {
            String relative = fileStorageService.store(idDocument, "therapist-docs");
            idUrl = "/api/public/files/" + relative;
        }
        TherapistProfile profile = therapistService.createOrUpdateProfile(
                therapist.getId(),
                null,
                null,
                licenseUrl,
                idUrl);
        return ResponseEntity.ok(Map.of(
                "profileId", profile.getId(),
                "licenseDocumentUrl", profile.getLicenseDocumentUrl(),
                "idDocumentUrl", profile.getIdDocumentUrl()));
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

    @PutMapping("/availability/{slotId}")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<TherapistAvailability> updateSlot(@PathVariable UUID slotId, @RequestBody Map<String, String> request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Therapist therapist = therapistRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Therapist record not found for user"));

        LocalDateTime start = LocalDateTime.parse(request.get("startTime"));
        LocalDateTime end = LocalDateTime.parse(request.get("endTime"));
        TherapistAvailability availability = therapistService.updateAvailabilitySlot(therapist.getId(), slotId, start, end);
        return ResponseEntity.ok(availability);
    }

    @GetMapping("/me/slots")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<List<TherapistAvailability>> getMySlots() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Therapist therapist = therapistRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Therapist record not found for user"));
        return ResponseEntity.ok(therapistService.getTherapistSlots(therapist.getId()));
    }

    @GetMapping("/{id}/slots")
    public ResponseEntity<List<TherapistAvailability>> getSlots(@PathVariable UUID id) {
        return ResponseEntity.ok(therapistService.getAvailableSlots(id));
    }

    @GetMapping("/{id}/profile")
    public ResponseEntity<Map<String, Object>> getTherapistProfile(@PathVariable UUID id) {
        return ResponseEntity.ok(therapistService.getTherapistProfileDetails(id));
    }

    @GetMapping("/all")
    public ResponseEntity<List<Map<String, Object>>> getAllTherapists(
            @RequestParam(required = false) String specialization,
            @RequestParam(required = false) Double minRating,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) String availableAfter) {
        LocalDateTime availableAfterDateTime = null;
        if (availableAfter != null && !availableAfter.isBlank()) {
            availableAfterDateTime = LocalDateTime.parse(availableAfter);
        }

        return ResponseEntity.ok(therapistService.searchTherapists(
                specialization,
                minRating,
                maxPrice,
                keyword,
                language,
                availableAfterDateTime));
    }

    @GetMapping("/{id}/utilization")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getTherapistSlotUtilization(@PathVariable UUID id) {
        return ResponseEntity.ok(therapistService.getSlotUtilization(id));
    }
}

package com.mentalhealth.app.therapist;

import com.mentalhealth.app.booking.Booking;
import com.mentalhealth.app.booking.BookingRepository;
import com.mentalhealth.app.booking.BookingStatus;
import com.mentalhealth.app.common.storage.FileStorageService;
import com.mentalhealth.app.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/therapists")
public class TherapistController {

    private final TherapistService therapistService;
    private final TherapistRepository therapistRepository;
    private final FileStorageService fileStorageService;
    private final TherapistProfileRepository therapistProfileRepository;
    private final BookingRepository bookingRepository;

    public TherapistController(TherapistService therapistService, TherapistRepository therapistRepository,
            FileStorageService fileStorageService,
            TherapistProfileRepository therapistProfileRepository,
            BookingRepository bookingRepository) {
        this.therapistService = therapistService;
        this.therapistRepository = therapistRepository;
        this.fileStorageService = fileStorageService;
        this.therapistProfileRepository = therapistProfileRepository;
        this.bookingRepository = bookingRepository;
    }

    @PostMapping("/profile")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> request) {
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
        return ResponseEntity.ok(toProfileMap(profile));
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
    public ResponseEntity<?> addSlot(@RequestBody Map<String, String> request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Therapist therapist = therapistRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Therapist record not found for user"));

        LocalDateTime start = LocalDateTime.parse(request.get("startTime"));
        LocalDateTime end = LocalDateTime.parse(request.get("endTime"));

        TherapistAvailability availability = therapistService.addAvailabilitySlot(therapist.getId(), start, end);
        return ResponseEntity.ok(toSlotMap(availability));
    }

    @PutMapping("/availability/{slotId}")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> updateSlot(@PathVariable UUID slotId, @RequestBody Map<String, String> request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Therapist therapist = therapistRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Therapist record not found for user"));

        LocalDateTime start = LocalDateTime.parse(request.get("startTime"));
        LocalDateTime end = LocalDateTime.parse(request.get("endTime"));
        TherapistAvailability availability = therapistService.updateAvailabilitySlot(therapist.getId(), slotId, start, end);
        return ResponseEntity.ok(toSlotMap(availability));
    }

    @GetMapping("/me/slots")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> getMySlots() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Therapist therapist = therapistRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Therapist record not found for user"));
        return ResponseEntity.ok(therapistService.getTherapistSlots(therapist.getId()).stream()
                .map(this::toSlotMap)
                .collect(Collectors.toList()));
    }

    @GetMapping("/me/dashboard")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> getMyDashboard() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Therapist therapist = therapistRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Therapist record not found for user"));
        TherapistProfile profile = therapistProfileRepository.findByTherapistId(therapist.getId())
                .orElse(new TherapistProfile());
        List<TherapistAvailability> slots = therapistService.getTherapistSlots(therapist.getId());
        List<Booking> bookings = bookingRepository.findByTherapist_User_Id(user.getId());

        long pendingBookings = bookings.stream().filter(booking -> booking.getStatus() == BookingStatus.PENDING).count();
        long confirmedBookings = bookings.stream().filter(booking -> booking.getStatus() == BookingStatus.CONFIRMED).count();
        long completedBookings = bookings.stream().filter(booking -> booking.getStatus() == BookingStatus.COMPLETED).count();
        long noShows = bookings.stream().filter(booking -> booking.getStatus() == BookingStatus.NO_SHOW).count();
        long openSlots = slots.stream().filter(slot -> !Boolean.TRUE.equals(slot.getBooked())).count();
        long bookedSlots = slots.stream().filter(slot -> Boolean.TRUE.equals(slot.getBooked())).count();

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("totalSlots", slots.size());
        metrics.put("openSlots", openSlots);
        metrics.put("bookedSlots", bookedSlots);
        metrics.put("pendingBookings", pendingBookings);
        metrics.put("confirmedBookings", confirmedBookings);
        metrics.put("completedBookings", completedBookings);
        metrics.put("noShows", noShows);

        Map<String, Object> onboarding = new HashMap<>();
        onboarding.put("accountCreated", true);
        onboarding.put("profileCompleted", profile.getBio() != null && !profile.getBio().isBlank()
                && therapist.getLanguage() != null && !therapist.getLanguage().isBlank());
        onboarding.put("documentsUploaded",
                profile.getLicenseDocumentUrl() != null && !profile.getLicenseDocumentUrl().isBlank()
                        && profile.getIdDocumentUrl() != null && !profile.getIdDocumentUrl().isBlank());
        onboarding.put("verified", therapist.getApprovalStatus() == TherapistApprovalStatus.VERIFIED);
        onboarding.put("slotsPublished", !slots.isEmpty());

        Map<String, Object> payload = new HashMap<>();
        payload.put("therapistId", therapist.getId());
        payload.put("name", therapist.getUser().getName());
        payload.put("email", therapist.getUser().getEmail());
        payload.put("specialization", therapist.getSpecialization());
        payload.put("language", therapist.getLanguage());
        payload.put("experienceYears", therapist.getExperienceYears());
        payload.put("hourlyRate", therapist.getHourlyRate());
        payload.put("verified", therapist.getVerified());
        payload.put("approvalStatus", therapist.getApprovalStatus());
        payload.put("profile", toProfileMap(profile));
        payload.put("metrics", metrics);
        payload.put("onboarding", onboarding);
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/{id}/slots")
    public ResponseEntity<?> getSlots(@PathVariable UUID id) {
        return ResponseEntity.ok(therapistService.getAvailableSlots(id).stream()
                .map(this::toSlotMap)
                .collect(Collectors.toList()));
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

    private Map<String, Object> toSlotMap(TherapistAvailability slot) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", slot.getId());
        data.put("startTime", slot.getStartTime());
        data.put("endTime", slot.getEndTime());
        data.put("booked", slot.getBooked());
        data.put("therapistId", slot.getTherapist() == null ? null : slot.getTherapist().getId());
        return data;
    }

    private Map<String, Object> toProfileMap(TherapistProfile profile) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", profile.getId());
        data.put("bio", profile.getBio());
        data.put("profilePictureUrl", profile.getProfilePictureUrl());
        data.put("licenseDocumentUrl", profile.getLicenseDocumentUrl());
        data.put("idDocumentUrl", profile.getIdDocumentUrl());
        data.put("rating", profile.getRating());
        data.put("therapistId", profile.getTherapist() == null ? null : profile.getTherapist().getId());
        return data;
    }
}

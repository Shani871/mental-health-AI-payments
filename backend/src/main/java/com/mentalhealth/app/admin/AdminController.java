package com.mentalhealth.app.admin;

import com.mentalhealth.app.common.ApiResponse;
import com.mentalhealth.app.booking.Booking;
import com.mentalhealth.app.booking.BookingRepository;
import com.mentalhealth.app.therapist.TherapistAvailability;
import com.mentalhealth.app.therapist.TherapistAvailabilityRepository;
import com.mentalhealth.app.therapist.TherapistProfile;
import com.mentalhealth.app.therapist.TherapistProfileRepository;
import com.mentalhealth.app.therapist.TherapistApprovalStatus;
import com.mentalhealth.app.therapist.Therapist;
import com.mentalhealth.app.therapist.TherapistRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final TherapistRepository therapistRepository;
    private final TherapistProfileRepository therapistProfileRepository;
    private final TherapistAvailabilityRepository availabilityRepository;
    private final BookingRepository bookingRepository;

    public AdminController(
            TherapistRepository therapistRepository,
            TherapistProfileRepository therapistProfileRepository,
            TherapistAvailabilityRepository availabilityRepository,
            BookingRepository bookingRepository) {
        this.therapistRepository = therapistRepository;
        this.therapistProfileRepository = therapistProfileRepository;
        this.availabilityRepository = availabilityRepository;
        this.bookingRepository = bookingRepository;
    }

    @GetMapping("/therapists/unverified")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getUnverifiedTherapists() {
        List<Map<String, Object>> unverified = therapistRepository.findAll().stream()
                .filter(t -> t.getApprovalStatus() == TherapistApprovalStatus.PENDING)
                .map(therapist -> {
                    TherapistProfile profile = therapistProfileRepository.findByTherapistId(therapist.getId())
                            .orElse(new TherapistProfile());
                    Map<String, Object> row = new HashMap<>();
                    row.put("therapistId", therapist.getId());
                    row.put("name", therapist.getUser().getName());
                    row.put("email", therapist.getUser().getEmail());
                    row.put("specialization", therapist.getSpecialization());
                    row.put("language", therapist.getLanguage());
                    row.put("experienceYears", therapist.getExperienceYears());
                    row.put("hourlyRate", therapist.getHourlyRate());
                    row.put("verified", therapist.getVerified());
                    row.put("approvalStatus", therapist.getApprovalStatus());
                    row.put("licenseDocumentUrl", profile.getLicenseDocumentUrl());
                    row.put("idDocumentUrl", profile.getIdDocumentUrl());
                    row.put("profilePictureUrl", profile.getProfilePictureUrl());
                    return row;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(unverified);
    }

    @GetMapping("/therapists/overview")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAllTherapistsOverview() {
        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> data = therapistRepository.findAll().stream()
                .map(therapist -> {
                    TherapistProfile profile = therapistProfileRepository.findByTherapistId(therapist.getId())
                            .orElse(new TherapistProfile());
                    List<TherapistAvailability> slots = availabilityRepository.findByTherapistIdOrderByStartTimeAsc(
                            therapist.getId());
                    List<Booking> bookings = bookingRepository.findByTherapistId(therapist.getId());

                    List<Map<String, Object>> slotRows = slots.stream().map(slot -> {
                        Map<String, Object> item = new HashMap<>();
                        item.put("id", slot.getId());
                        item.put("startTime", slot.getStartTime());
                        item.put("endTime", slot.getEndTime());
                        item.put("booked", slot.getBooked());
                        item.put("windowStatus", slot.getStartTime().isBefore(now) ? "PAST" : "UPCOMING");
                        return item;
                    }).collect(Collectors.toList());

                    List<Map<String, Object>> bookingRows = bookings.stream()
                            .sorted((a, b) -> b.getAvailabilitySlot().getStartTime()
                                    .compareTo(a.getAvailabilitySlot().getStartTime()))
                            .map(booking -> {
                                Map<String, Object> item = new HashMap<>();
                                item.put("id", booking.getId());
                                item.put("status", booking.getStatus());
                                item.put("userName", booking.getUser().getName());
                                item.put("userEmail", booking.getUser().getEmail());
                                item.put("slotStartTime", booking.getAvailabilitySlot().getStartTime());
                                item.put("slotEndTime", booking.getAvailabilitySlot().getEndTime());
                                item.put("meetingLink", booking.getMeetingLink());
                                return item;
                            }).collect(Collectors.toList());

                    long totalSlots = slots.size();
                    long bookedSlots = slots.stream().filter(slot -> Boolean.TRUE.equals(slot.getBooked())).count();

                    Map<String, Object> row = new HashMap<>();
                    row.put("therapistId", therapist.getId());
                    row.put("name", therapist.getUser().getName());
                    row.put("email", therapist.getUser().getEmail());
                    row.put("specialization", therapist.getSpecialization());
                    row.put("language", therapist.getLanguage());
                    row.put("experienceYears", therapist.getExperienceYears());
                    row.put("hourlyRate", therapist.getHourlyRate());
                    row.put("verified", therapist.getVerified());
                    row.put("approvalStatus", therapist.getApprovalStatus());
                    row.put("rating", profile.getRating());
                    row.put("bio", profile.getBio());
                    row.put("licenseDocumentUrl", profile.getLicenseDocumentUrl());
                    row.put("idDocumentUrl", profile.getIdDocumentUrl());
                    row.put("totalSlots", totalSlots);
                    row.put("bookedSlots", bookedSlots);
                    row.put("openSlots", Math.max(totalSlots - bookedSlots, 0));
                    row.put("slots", slotRows);
                    row.put("bookings", bookingRows);
                    return row;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(data);
    }

    @PutMapping("/therapists/{id}/verify")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> verifyTherapist(@PathVariable UUID id) {
        Therapist therapist = therapistRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Therapist not found"));

        therapist.setApprovalStatus(TherapistApprovalStatus.VERIFIED);
        therapistRepository.save(therapist);

        return ResponseEntity.ok(ApiResponse.success("Therapist verified successfully", null));
    }

    @PutMapping("/therapists/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> rejectTherapist(@PathVariable UUID id) {
        Therapist therapist = therapistRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Therapist not found"));

        therapist.setApprovalStatus(TherapistApprovalStatus.REJECTED);
        therapistRepository.save(therapist);

        return ResponseEntity.ok(ApiResponse.success("Therapist rejected successfully", null));
    }
}

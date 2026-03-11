package com.mentalhealth.app.booking;

import com.mentalhealth.app.user.User;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;
    private final BookingRepository bookingRepository;

    public BookingController(BookingService bookingService, BookingRepository bookingRepository) {
        this.bookingService = bookingService;
        this.bookingRepository = bookingRepository;
    }

    @PostMapping("/create")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> createBooking(@RequestParam UUID slotId) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Booking booking = bookingService.createBooking(user.getId(), slotId);
        return ResponseEntity.ok(toBookingMap(booking));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getMyBookings() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(bookingRepository.findByUserId(user.getId()).stream()
                .map(this::toBookingMap)
                .collect(Collectors.toList()));
    }

    @GetMapping("/therapist/my")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> getMyTherapistBookings() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(bookingRepository.findByTherapist_User_Id(user.getId()).stream()
                .map(this::toBookingMap)
                .collect(Collectors.toList()));
    }

    @DeleteMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('USER', 'THERAPIST', 'ADMIN')")
    public ResponseEntity<?> cancelBooking(@PathVariable UUID id) {
        User actor = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        bookingService.cancelBooking(id, actor.getRole().name(), actor.getRole().name().equals("ADMIN"));
        return ResponseEntity.ok("Booking cancelled successfully.");
    }

    @PutMapping("/{id}/reschedule")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> rescheduleBooking(@PathVariable UUID id, @RequestParam UUID newSlotId) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(toBookingMap(bookingService.rescheduleBooking(id, newSlotId, user.getId(), "USER")));
    }

    @PutMapping("/{id}/therapist-reschedule")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> therapistRescheduleBooking(@PathVariable UUID id, @RequestParam UUID newSlotId) {
        User therapistUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(
                toBookingMap(bookingService.rescheduleBooking(id, newSlotId, therapistUser.getId(), "THERAPIST")));
    }

    @PutMapping("/{id}/therapist-accept")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> therapistAcceptBooking(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> request) {
        User therapistUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String meetingLink = request == null ? null : request.get("meetingLink");
        return ResponseEntity.ok(toBookingMap(bookingService.therapistAcceptBooking(id, therapistUser.getId(), meetingLink)));
    }

    @PutMapping("/{id}/therapist-meeting-link")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> updateTherapistMeetingLink(@PathVariable UUID id, @RequestBody Map<String, String> request) {
        User therapistUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(
                toBookingMap(bookingService.updateTherapistMeetingLink(id, therapistUser.getId(), request.get("meetingLink"))));
    }

    @PutMapping("/{id}/complete")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> completeBooking(@PathVariable UUID id) {
        User therapistUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(toBookingMap(bookingService.markCompleted(id, therapistUser.getId())));
    }

    @PutMapping("/{id}/no-show")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> markNoShow(@PathVariable UUID id) {
        User therapistUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(toBookingMap(bookingService.markNoShow(id, therapistUser.getId())));
    }

    @PutMapping("/{id}/override-cancellation-fee")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> overrideCancellationFee(@PathVariable UUID id) {
        return ResponseEntity.ok(toBookingMap(bookingService.overrideCancellationFee(id)));
    }

    @GetMapping("/{id}/calendar.ics")
    @PreAuthorize("hasAnyRole('USER', 'THERAPIST', 'ADMIN')")
    public ResponseEntity<byte[]> downloadCalendarInvite(@PathVariable UUID id) {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        boolean hasAccess = requester.getRole().name().equals("ADMIN")
                || (booking.getUser() != null && booking.getUser().getId().equals(requester.getId()))
                || (booking.getTherapist() != null
                        && booking.getTherapist().getUser() != null
                        && booking.getTherapist().getUser().getId().equals(requester.getId()));
        if (!hasAccess) {
            throw new RuntimeException("You are not allowed to access this booking calendar invite.");
        }

        if (booking.getAvailabilitySlot() == null
                || booking.getAvailabilitySlot().getStartTime() == null
                || booking.getAvailabilitySlot().getEndTime() == null) {
            throw new RuntimeException("Booking slot details are missing.");
        }

        String ics = buildCalendarInvite(booking);
        byte[] content = ics.getBytes(StandardCharsets.UTF_8);
        String fileName = "mindtriage-session-" + booking.getId() + ".ics";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "text/calendar; charset=UTF-8")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.parseMediaType("text/calendar"))
                .body(content);
    }

    private Map<String, Object> toBookingMap(Booking booking) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", booking.getId());
        payload.put("status", booking.getStatus());
        payload.put("paymentId", booking.getPaymentId());
        payload.put("meetingLink", booking.getMeetingLink());
        payload.put("cancellationFeeApplied", booking.getCancellationFeeApplied());
        payload.put("cancellationFeeAmount", booking.getCancellationFeeAmount());
        payload.put("cancelledByRole", booking.getCancelledByRole());
        payload.put("createdAt", booking.getCreatedAt());
        payload.put("updatedAt", booking.getUpdatedAt());

        if (booking.getUser() != null) {
            payload.put("user", Map.of(
                    "id", booking.getUser().getId(),
                    "name", booking.getUser().getName(),
                    "email", booking.getUser().getEmail()));
        } else {
            payload.put("user", null);
        }

        if (booking.getTherapist() != null) {
            Map<String, Object> therapist = new HashMap<>();
            therapist.put("id", booking.getTherapist().getId());
            therapist.put("specialization", booking.getTherapist().getSpecialization());
            therapist.put("language", booking.getTherapist().getLanguage());
            therapist.put("experienceYears", booking.getTherapist().getExperienceYears());
            therapist.put("hourlyRate", booking.getTherapist().getHourlyRate());
            if (booking.getTherapist().getUser() != null) {
                therapist.put("user", Map.of(
                        "id", booking.getTherapist().getUser().getId(),
                        "name", booking.getTherapist().getUser().getName(),
                        "email", booking.getTherapist().getUser().getEmail()));
            } else {
                therapist.put("user", null);
            }
            payload.put("therapist", therapist);
        } else {
            payload.put("therapist", null);
        }

        if (booking.getAvailabilitySlot() != null) {
            payload.put("availabilitySlot", Map.of(
                    "id", booking.getAvailabilitySlot().getId(),
                    "startTime", booking.getAvailabilitySlot().getStartTime(),
                    "endTime", booking.getAvailabilitySlot().getEndTime(),
                    "booked", booking.getAvailabilitySlot().getBooked()));
        } else {
            payload.put("availabilitySlot", null);
        }
        return payload;
    }

    private String buildCalendarInvite(Booking booking) {
        DateTimeFormatter utcFormat = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
        String dtStart = booking.getAvailabilitySlot().getStartTime()
                .atZone(ZoneId.systemDefault())
                .withZoneSameInstant(ZoneId.of("UTC"))
                .format(utcFormat);
        String dtEnd = booking.getAvailabilitySlot().getEndTime()
                .atZone(ZoneId.systemDefault())
                .withZoneSameInstant(ZoneId.of("UTC"))
                .format(utcFormat);
        String dtStamp = java.time.LocalDateTime.now()
                .atZone(ZoneId.systemDefault())
                .withZoneSameInstant(ZoneId.of("UTC"))
                .format(utcFormat);

        String therapistName = booking.getTherapist() == null || booking.getTherapist().getUser() == null
                ? "Therapist"
                : booking.getTherapist().getUser().getName();
        String userName = booking.getUser() == null ? "User" : booking.getUser().getName();
        String meetingLink = booking.getMeetingLink() == null ? "" : booking.getMeetingLink().trim();

        String summary = escapeIcs("MindTriage Therapy Session");
        String description = escapeIcs("Session between " + userName + " and " + therapistName
                + (meetingLink.isBlank() ? "" : "\\nJoin: " + meetingLink));
        String location = escapeIcs(meetingLink.isBlank() ? "Online session" : meetingLink);
        String urlLine = meetingLink.isBlank() ? "X-MINDTRIAGE-LINK:Not-Provided" : "URL:" + escapeIcs(meetingLink);
        String calendarStatus = booking.getStatus() == BookingStatus.CONFIRMED ? "CONFIRMED" : "TENTATIVE";

        return String.join("\r\n",
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//MindTriage//Mental Health Session//EN",
                "CALSCALE:GREGORIAN",
                "METHOD:PUBLISH",
                "BEGIN:VEVENT",
                "UID:" + booking.getId() + "@mindtriage.local",
                "DTSTAMP:" + dtStamp,
                "DTSTART:" + dtStart,
                "DTEND:" + dtEnd,
                "SUMMARY:" + summary,
                "DESCRIPTION:" + description,
                "LOCATION:" + location,
                urlLine,
                "STATUS:" + calendarStatus,
                "END:VEVENT",
                "END:VCALENDAR",
                "");
    }

    private String escapeIcs(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\r\n", "\\n")
                .replace("\n", "\\n");
    }
}

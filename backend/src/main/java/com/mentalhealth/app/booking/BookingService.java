package com.mentalhealth.app.booking;

import com.mentalhealth.app.audit.AuditService;
import com.mentalhealth.app.notification.InAppNotificationService;
import com.mentalhealth.app.therapist.TherapistAvailability;
import com.mentalhealth.app.therapist.TherapistAvailabilityRepository;
import com.mentalhealth.app.therapist.TherapistService;
import com.mentalhealth.app.video.MeetingAttendanceStatus;
import com.mentalhealth.app.video.VideoMeetingService;
import com.mentalhealth.app.user.User;
import com.mentalhealth.app.user.UserRepository;
import com.mentalhealth.app.video.ZoomService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final TherapistAvailabilityRepository availabilityRepository;
    private final UserRepository userRepository;
    private final TherapistService therapistService;
    private final ZoomService zoomService;
    private final AuditService auditService;
    private final InAppNotificationService notificationService;
    private final VideoMeetingService videoMeetingService;
    private static final int PENDING_PAYMENT_WINDOW_MINUTES = 5;

    public BookingService(BookingRepository bookingRepository,
            TherapistAvailabilityRepository availabilityRepository,
            UserRepository userRepository,
            TherapistService therapistService,
            ZoomService zoomService,
            AuditService auditService,
            InAppNotificationService notificationService,
            VideoMeetingService videoMeetingService) {
        this.bookingRepository = bookingRepository;
        this.availabilityRepository = availabilityRepository;
        this.userRepository = userRepository;
        this.therapistService = therapistService;
        this.zoomService = zoomService;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.videoMeetingService = videoMeetingService;
    }

    @Transactional
    public Booking createBooking(UUID userId, UUID slotId) {
        if (!therapistService.lockSlot(slotId, PENDING_PAYMENT_WINDOW_MINUTES)) {
            throw new RuntimeException("Slot is currently being booked by another user. Please try again later.");
        }

        TherapistAvailability slot = availabilityRepository.findById(slotId)
                .orElseThrow(() -> new RuntimeException("Availability slot not found"));

        if (slot.getBooked()) {
            therapistService.unlockSlot(slotId);
            throw new RuntimeException("Slot is already booked");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Booking booking = new Booking(user, slot.getTherapist(), slot, BookingStatus.PENDING);

        slot.setBooked(true);
        availabilityRepository.save(slot);

        Booking savedBooking = bookingRepository.save(booking);
        auditService.log("BOOKING_INITIATED", user.getEmail(), "Booking created with ID: " + savedBooking.getId());
        notificationService.create(
                user,
                "BOOKING_PENDING",
                "Booking initiated. Complete payment to confirm your session.",
                java.util.Map.of("bookingId", savedBooking.getId().toString()));

        return savedBooking;
    }

    @Transactional
    public void confirmBooking(UUID bookingId, String paymentId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentId(paymentId);

        String startTime = booking.getAvailabilitySlot().getStartTime().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        String topic = "Mental Health Session: " + booking.getUser().getName() + " & "
                + booking.getTherapist().getUser().getName();
        ZoomService.MeetingDetails meetingDetails = zoomService.createMeetingDetails(topic, startTime);
        booking.setMeetingLink(meetingDetails.getJoinUrl());

        bookingRepository.save(booking);
        videoMeetingService.upsertForBooking(booking, meetingDetails);
        therapistService.unlockSlot(booking.getAvailabilitySlot().getId());
        auditService.log("BOOKING_CONFIRMED", booking.getUser().getEmail(),
                "Payment ID: " + paymentId + " for Booking ID: " + bookingId);
        notificationService.create(
                booking.getUser(),
                "BOOKING_CONFIRMED",
                "Your session is confirmed. Join link is now available.",
                java.util.Map.of("bookingId", booking.getId().toString(), "meetingLink", booking.getMeetingLink()));
        notificationService.create(
                booking.getTherapist().getUser(),
                "NEW_CONFIRMED_SESSION",
                "A user session has been confirmed on your calendar.",
                java.util.Map.of("bookingId", booking.getId().toString()));
    }

    @Transactional
    public void cancelBooking(UUID bookingId, String cancelledByRole, boolean adminOverrideFee) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            return;
        }
        if (booking.getStatus() == BookingStatus.COMPLETED || booking.getStatus() == BookingStatus.NO_SHOW) {
            throw new RuntimeException("Completed or no-show bookings cannot be cancelled.");
        }

        boolean lateCancellation = booking.getAvailabilitySlot().getStartTime().isBefore(LocalDateTime.now().plusHours(24));
        if (lateCancellation && !adminOverrideFee) {
            BigDecimal fee = booking.getTherapist().getHourlyRate().multiply(new BigDecimal("0.50"));
            booking.setCancellationFeeApplied(true);
            booking.setCancellationFeeAmount(fee);
        } else {
            booking.setCancellationFeeApplied(false);
            booking.setCancellationFeeAmount(BigDecimal.ZERO);
        }
        booking.setCancelledByRole(cancelledByRole);
        booking.setStatus(BookingStatus.CANCELLED);

        TherapistAvailability slot = booking.getAvailabilitySlot();
        slot.setBooked(false);
        availabilityRepository.save(slot);
        therapistService.unlockSlot(slot.getId());

        bookingRepository.save(booking);
        auditService.log("BOOKING_CANCELLED", booking.getUser().getEmail(), "Booking ID: " + bookingId + " cancelled.");
        notificationService.create(
                booking.getUser(),
                "BOOKING_CANCELLED",
                "Your booking was cancelled.",
                java.util.Map.of("bookingId", booking.getId().toString()));
        notificationService.create(
                booking.getTherapist().getUser(),
                "SESSION_CANCELLED",
                "A booked session was cancelled.",
                java.util.Map.of("bookingId", booking.getId().toString()));
    }

    @Transactional
    public Booking rescheduleBooking(UUID bookingId, UUID newSlotId, UUID requesterId, String requesterRole) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (booking.getStatus() != BookingStatus.PENDING && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new RuntimeException("Only pending or confirmed bookings can be rescheduled.");
        }

        if ("USER".equals(requesterRole) && !booking.getUser().getId().equals(requesterId)) {
            throw new RuntimeException("You can only reschedule your own bookings.");
        }
        if ("THERAPIST".equals(requesterRole) && !booking.getTherapist().getUser().getId().equals(requesterId)) {
            throw new RuntimeException("You can only reschedule your own sessions.");
        }

        if (booking.getAvailabilitySlot().getStartTime().isBefore(LocalDateTime.now().plusHours(24))) {
            throw new RuntimeException("Rescheduling is only allowed at least 24 hours before the session.");
        }

        if (!therapistService.lockSlot(newSlotId, PENDING_PAYMENT_WINDOW_MINUTES)) {
            throw new RuntimeException("Requested slot is currently locked by another booking attempt.");
        }

        TherapistAvailability newSlot = availabilityRepository.findById(newSlotId)
                .orElseThrow(() -> new RuntimeException("New slot not found"));
        if (newSlot.getBooked()) {
            therapistService.unlockSlot(newSlotId);
            throw new RuntimeException("New slot is already booked.");
        }

        TherapistAvailability oldSlot = booking.getAvailabilitySlot();
        oldSlot.setBooked(false);
        availabilityRepository.save(oldSlot);
        therapistService.unlockSlot(oldSlot.getId());

        newSlot.setBooked(true);
        availabilityRepository.save(newSlot);
        booking.setAvailabilitySlot(newSlot);
        Booking saved = bookingRepository.save(booking);

        auditService.log("BOOKING_RESCHEDULED", booking.getUser().getEmail(),
                "Booking ID: " + bookingId + " moved to slot: " + newSlotId + " by " + requesterRole);
        notificationService.create(
                booking.getUser(),
                "BOOKING_RESCHEDULED",
                "Your session has been rescheduled.",
                java.util.Map.of("bookingId", booking.getId().toString(), "newSlotId", newSlotId.toString()));
        notificationService.create(
                booking.getTherapist().getUser(),
                "SESSION_RESCHEDULED",
                "A session slot has been rescheduled.",
                java.util.Map.of("bookingId", booking.getId().toString(), "newSlotId", newSlotId.toString()));
        return saved;
    }

    @Transactional
    public Booking markCompleted(UUID bookingId, UUID therapistUserId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        if (!booking.getTherapist().getUser().getId().equals(therapistUserId)) {
            throw new RuntimeException("Only assigned therapist can mark booking as completed.");
        }
        booking.setStatus(BookingStatus.COMPLETED);
        Booking saved = bookingRepository.save(booking);
        videoMeetingService.markAttendance(bookingId, MeetingAttendanceStatus.ATTENDED);
        notificationService.create(
                booking.getUser(),
                "SESSION_COMPLETED",
                "Your therapy session has been marked completed. You can now submit a review.",
                java.util.Map.of("bookingId", booking.getId().toString()));
        return saved;
    }

    @Transactional
    public Booking markNoShow(UUID bookingId, UUID therapistUserId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        if (!booking.getTherapist().getUser().getId().equals(therapistUserId)) {
            throw new RuntimeException("Only assigned therapist can mark no-show.");
        }
        booking.setStatus(BookingStatus.NO_SHOW);
        Booking saved = bookingRepository.save(booking);
        videoMeetingService.markAttendance(bookingId, MeetingAttendanceStatus.NO_SHOW);
        notificationService.create(
                booking.getUser(),
                "SESSION_NO_SHOW",
                "Your session was marked as no-show.",
                java.util.Map.of("bookingId", booking.getId().toString()));
        return saved;
    }

    @Transactional
    public Booking overrideCancellationFee(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        if (booking.getStatus() != BookingStatus.CANCELLED) {
            throw new RuntimeException("Cancellation fee override is only available for cancelled bookings.");
        }
        booking.setCancellationFeeApplied(false);
        booking.setCancellationFeeAmount(BigDecimal.ZERO);
        return bookingRepository.save(booking);
    }

    @Transactional
    public void handleFailedPayment(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        if (booking.getStatus() != BookingStatus.PENDING) {
            return;
        }
        TherapistAvailability slot = booking.getAvailabilitySlot();
        slot.setBooked(false);
        availabilityRepository.save(slot);
        therapistService.unlockSlot(slot.getId());
        booking.setStatus(BookingStatus.CANCELLED);
        bookingRepository.save(booking);
        notificationService.create(
                booking.getUser(),
                "BOOKING_PAYMENT_FAILED",
                "Payment failed and booking has been released.",
                java.util.Map.of("bookingId", booking.getId().toString()));
    }

    @Scheduled(fixedDelayString = "${booking.pending-timeout-check-ms:60000}")
    @Transactional
    public void releaseExpiredPendingBookings() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(PENDING_PAYMENT_WINDOW_MINUTES);
        List<Booking> expiredPending = bookingRepository.findByStatusAndCreatedAtBefore(BookingStatus.PENDING, threshold);

        for (Booking booking : expiredPending) {
            TherapistAvailability slot = booking.getAvailabilitySlot();
            slot.setBooked(false);
            availabilityRepository.save(slot);
            therapistService.unlockSlot(slot.getId());
            booking.setStatus(BookingStatus.CANCELLED);
            bookingRepository.save(booking);
            auditService.log("BOOKING_PAYMENT_TIMEOUT", booking.getUser().getEmail(),
                    "Booking ID: " + booking.getId() + " cancelled due to payment timeout.");
            notificationService.create(
                    booking.getUser(),
                    "BOOKING_TIMEOUT",
                    "Booking was cancelled because payment was not completed in time.",
                    java.util.Map.of("bookingId", booking.getId().toString()));
        }
    }
}

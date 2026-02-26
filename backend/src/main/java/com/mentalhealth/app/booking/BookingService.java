package com.mentalhealth.app.booking;

import com.mentalhealth.app.audit.AuditService;
import com.mentalhealth.app.therapist.TherapistAvailability;
import com.mentalhealth.app.therapist.TherapistAvailabilityRepository;
import com.mentalhealth.app.therapist.TherapistService;
import com.mentalhealth.app.user.User;
import com.mentalhealth.app.user.UserRepository;
import com.mentalhealth.app.video.ZoomService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final TherapistAvailabilityRepository availabilityRepository;
    private final UserRepository userRepository;
    private final TherapistService therapistService;
    private final ZoomService zoomService;
    private final AuditService auditService;

    public BookingService(BookingRepository bookingRepository,
            TherapistAvailabilityRepository availabilityRepository,
            UserRepository userRepository,
            TherapistService therapistService,
            ZoomService zoomService,
            AuditService auditService) {
        this.bookingRepository = bookingRepository;
        this.availabilityRepository = availabilityRepository;
        this.userRepository = userRepository;
        this.therapistService = therapistService;
        this.zoomService = zoomService;
        this.auditService = auditService;
    }

    @Transactional
    public Booking createBooking(UUID userId, UUID slotId) {
        if (!therapistService.lockSlot(slotId)) {
            throw new RuntimeException("Slot is currently being booked by another user. Please try again later.");
        }

        try {
            TherapistAvailability slot = availabilityRepository.findById(slotId)
                    .orElseThrow(() -> new RuntimeException("Availability slot not found"));

            if (slot.getBooked()) {
                throw new RuntimeException("Slot is already booked");
            }

            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            Booking booking = new Booking(user, slot.getTherapist(), slot, BookingStatus.PENDING);

            slot.setBooked(true);
            availabilityRepository.save(slot);

            Booking savedBooking = bookingRepository.save(booking);
            auditService.log("BOOKING_INITIATED", user.getEmail(), "Booking created with ID: " + savedBooking.getId());

            return savedBooking;

        } finally {
            therapistService.unlockSlot(slotId);
        }
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
        String meetingLink = zoomService.createMeeting(topic, startTime);
        booking.setMeetingLink(meetingLink);

        bookingRepository.save(booking);
        auditService.log("BOOKING_CONFIRMED", booking.getUser().getEmail(),
                "Payment ID: " + paymentId + " for Booking ID: " + bookingId);
    }

    @Transactional
    public void cancelBooking(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        booking.setStatus(BookingStatus.CANCELLED);

        TherapistAvailability slot = booking.getAvailabilitySlot();
        slot.setBooked(false);
        availabilityRepository.save(slot);

        bookingRepository.save(booking);
        auditService.log("BOOKING_CANCELLED", booking.getUser().getEmail(), "Booking ID: " + bookingId + " cancelled.");
    }
}

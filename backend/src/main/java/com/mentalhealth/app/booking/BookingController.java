package com.mentalhealth.app.booking;

import com.mentalhealth.app.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

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
        return ResponseEntity.ok(booking);
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<List<Booking>> getMyBookings() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(bookingRepository.findByUserId(user.getId()));
    }

    @GetMapping("/therapist/my")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<List<Booking>> getMyTherapistBookings() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(bookingRepository.findByTherapist_User_Id(user.getId()));
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
    public ResponseEntity<Booking> rescheduleBooking(@PathVariable UUID id, @RequestParam UUID newSlotId) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(bookingService.rescheduleBooking(id, newSlotId, user.getId(), "USER"));
    }

    @PutMapping("/{id}/therapist-reschedule")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<Booking> therapistRescheduleBooking(@PathVariable UUID id, @RequestParam UUID newSlotId) {
        User therapistUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(bookingService.rescheduleBooking(id, newSlotId, therapistUser.getId(), "THERAPIST"));
    }

    @PutMapping("/{id}/complete")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<Booking> completeBooking(@PathVariable UUID id) {
        User therapistUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(bookingService.markCompleted(id, therapistUser.getId()));
    }

    @PutMapping("/{id}/no-show")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<Booking> markNoShow(@PathVariable UUID id) {
        User therapistUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(bookingService.markNoShow(id, therapistUser.getId()));
    }

    @PutMapping("/{id}/override-cancellation-fee")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Booking> overrideCancellationFee(@PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.overrideCancellationFee(id));
    }
}

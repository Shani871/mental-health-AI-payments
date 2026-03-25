package com.mentalhealth.app.dashboard;

import com.mentalhealth.app.ai.AiService;
import com.mentalhealth.app.booking.Booking;
import com.mentalhealth.app.booking.BookingRepository;
import com.mentalhealth.app.booking.BookingStatus;
import com.mentalhealth.app.payment.PaymentLedgerService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class UserDashboardService {

    private final BookingRepository bookingRepository;
    private final AiService aiService;
    private final PaymentLedgerService paymentLedgerService;

    public UserDashboardService(BookingRepository bookingRepository,
            AiService aiService,
            PaymentLedgerService paymentLedgerService) {
        this.bookingRepository = bookingRepository;
        this.aiService = aiService;
        this.paymentLedgerService = paymentLedgerService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getUserDashboard(UUID userId) {
        List<Booking> bookings = bookingRepository.findByUserId(userId);
        LocalDateTime now = LocalDateTime.now();

        List<Booking> upcoming = bookings.stream()
                .filter(booking -> booking.getStatus() == BookingStatus.PENDING
                        || booking.getStatus() == BookingStatus.CONFIRMED)
                .sorted(Comparator.comparing(booking -> booking.getAvailabilitySlot().getStartTime()))
                .toList();

        Map<String, Object> bookingMetrics = new HashMap<>();
        bookingMetrics.put("upcomingCount", upcoming.size());
        bookingMetrics.put("completedCount", bookings.stream().filter(booking -> booking.getStatus() == BookingStatus.COMPLETED).count());
        bookingMetrics.put("cancelledCount", bookings.stream().filter(booking -> booking.getStatus() == BookingStatus.CANCELLED).count());
        bookingMetrics.put("pendingPaymentCount", bookings.stream().filter(booking -> booking.getStatus() == BookingStatus.PENDING).count());
        bookingMetrics.put("nextSessionInHours", upcoming.isEmpty() ? null : java.time.Duration.between(now, upcoming.get(0).getAvailabilitySlot().getStartTime()).toHours());

        List<Map<String, Object>> careActions = aiService.getRecommendedActions(userId);

        Map<String, Object> response = new HashMap<>();
        response.put("bookingMetrics", bookingMetrics);
        response.put("nextSession", upcoming.isEmpty() ? null : toSessionCard(upcoming.get(0)));
        response.put("upcomingSessions", upcoming.stream().limit(3).map(this::toSessionCard).toList());
        response.put("careInsights", aiService.getUserCareInsights(userId));
        response.put("paymentOverview", paymentLedgerService.getUserPaymentOverview(userId));
        response.put("recommendedActions", careActions);
        return response;
    }

    private Map<String, Object> toSessionCard(Booking booking) {
        Map<String, Object> card = new HashMap<>();
        card.put("id", booking.getId());
        card.put("status", booking.getStatus());
        card.put("meetingLink", booking.getMeetingLink());
        card.put("startTime", booking.getAvailabilitySlot().getStartTime());
        card.put("endTime", booking.getAvailabilitySlot().getEndTime());
        card.put("therapistName", booking.getTherapist() == null || booking.getTherapist().getUser() == null
                ? "Therapist"
                : booking.getTherapist().getUser().getName());
        card.put("hourlyRate", booking.getTherapist() == null ? null : booking.getTherapist().getHourlyRate());
        return card;
    }
}

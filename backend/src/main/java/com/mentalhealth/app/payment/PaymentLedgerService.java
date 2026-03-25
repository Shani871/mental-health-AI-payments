package com.mentalhealth.app.payment;

import com.mentalhealth.app.booking.Booking;
import com.mentalhealth.app.booking.BookingStatus;
import com.mentalhealth.app.booking.BookingRepository;
import com.mentalhealth.app.therapist.TherapistRepository;
import com.mentalhealth.app.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PaymentLedgerService {

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final PayoutRepository payoutRepository;
    private final RefundRepository refundRepository;
    private final BookingRepository bookingRepository;
    private final TherapistRepository therapistRepository;
    private final PaymentService paymentService;

    public PaymentLedgerService(PaymentTransactionRepository paymentTransactionRepository,
            PayoutRepository payoutRepository,
            RefundRepository refundRepository,
            BookingRepository bookingRepository,
            TherapistRepository therapistRepository,
            PaymentService paymentService) {
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.payoutRepository = payoutRepository;
        this.refundRepository = refundRepository;
        this.bookingRepository = bookingRepository;
        this.therapistRepository = therapistRepository;
        this.paymentService = paymentService;
    }

    @Transactional
    public PaymentTransaction upsertPendingTransaction(UUID bookingId, BigDecimal amount, String gatewayOrderId) {
        return upsertPendingTransaction(bookingId, amount, gatewayOrderId, "RAZORPAY");
    }

    @Transactional
    public PaymentTransaction upsertPendingTransaction(UUID bookingId, BigDecimal amount, String gatewayOrderId, String gateway) {
        Booking booking = bookingRepository.findById(bookingId).orElseThrow(() -> new RuntimeException("Booking not found"));
        PaymentTransaction tx = paymentTransactionRepository.findByBookingId(bookingId).orElseGet(PaymentTransaction::new);

        BigDecimal therapistEarning = paymentService.calculateTherapistPayout(amount);
        BigDecimal commission = amount.subtract(therapistEarning);

        tx.setBooking(booking);
        tx.setUser(booking.getUser());
        tx.setTherapist(booking.getTherapist());
        tx.setAmount(amount);
        tx.setPlatformCommission(commission);
        tx.setTherapistEarning(therapistEarning);
        tx.setGatewayOrderId(gatewayOrderId);
        tx.setGateway(gateway);
        tx.setStatus(PaymentStatus.PENDING);
        return paymentTransactionRepository.save(tx);
    }

    @Transactional
    public PaymentTransaction markPaymentSuccess(UUID bookingId, String paymentId, String signature) {
        PaymentTransaction tx = paymentTransactionRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new RuntimeException("Payment transaction not found for booking"));
        tx.setGatewayPaymentId(paymentId);
        tx.setGatewaySignature(signature);
        tx.setStatus(PaymentStatus.SUCCESS);
        return paymentTransactionRepository.save(tx);
    }

    @Transactional
    public PaymentTransaction markPaymentSuccessByOrderId(String gatewayOrderId, String paymentId, String signature) {
        PaymentTransaction tx = paymentTransactionRepository.findByGatewayOrderId(gatewayOrderId)
                .orElseThrow(() -> new RuntimeException("Payment transaction not found for order"));
        tx.setGatewayPaymentId(paymentId);
        tx.setGatewaySignature(signature);
        tx.setStatus(PaymentStatus.SUCCESS);
        return paymentTransactionRepository.save(tx);
    }

    @Transactional
    public PaymentTransaction markCashPaymentSuccess(UUID bookingId, BigDecimal amount, String cashPaymentId) {
        Booking booking = bookingRepository.findById(bookingId).orElseThrow(() -> new RuntimeException("Booking not found"));
        PaymentTransaction tx = paymentTransactionRepository.findByBookingId(bookingId).orElseGet(PaymentTransaction::new);

        BigDecimal therapistEarning = paymentService.calculateTherapistPayout(amount);
        BigDecimal commission = amount.subtract(therapistEarning);

        tx.setBooking(booking);
        tx.setUser(booking.getUser());
        tx.setTherapist(booking.getTherapist());
        tx.setAmount(amount);
        tx.setPlatformCommission(commission);
        tx.setTherapistEarning(therapistEarning);
        tx.setGatewayOrderId(null);
        tx.setGatewayPaymentId(cashPaymentId);
        tx.setGatewaySignature(null);
        tx.setGateway("CASH");
        tx.setStatus(PaymentStatus.SUCCESS);
        return paymentTransactionRepository.save(tx);
    }

    @Transactional
    public PaymentTransaction markPaymentFailure(UUID bookingId) {
        PaymentTransaction tx = paymentTransactionRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new RuntimeException("Payment transaction not found for booking"));
        tx.setStatus(PaymentStatus.FAILED);
        return paymentTransactionRepository.save(tx);
    }

    @Transactional
    public PaymentTransaction markPaymentFailureByOrderId(String gatewayOrderId) {
        PaymentTransaction tx = paymentTransactionRepository.findByGatewayOrderId(gatewayOrderId)
                .orElseThrow(() -> new RuntimeException("Payment transaction not found for order"));
        tx.setStatus(PaymentStatus.FAILED);
        return paymentTransactionRepository.save(tx);
    }

    @Transactional(readOnly = true)
    public UUID getBookingIdByGatewayOrderId(String gatewayOrderId) {
        return paymentTransactionRepository.findByGatewayOrderId(gatewayOrderId)
                .map(tx -> tx.getBooking().getId())
                .orElseThrow(() -> new RuntimeException("Payment transaction not found for order"));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUserPaymentHistory(UUID userId) {
        return paymentTransactionRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toPaymentMap)
                .collect(Collectors.toList());
    }

    @Transactional
    public Refund requestRefund(UUID bookingId, BigDecimal amount, String reason, User requestedBy) {
        PaymentTransaction tx = paymentTransactionRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new RuntimeException("Payment transaction not found for booking"));
        if (!tx.getUser().getId().equals(requestedBy.getId())) {
            throw new RuntimeException("You can only request refund for your own booking.");
        }
        if (tx.getStatus() != PaymentStatus.SUCCESS && tx.getStatus() != PaymentStatus.REFUNDED) {
            throw new RuntimeException("Refund is available only for successful payments.");
        }
        BigDecimal refundableRemaining = getRefundableRemaining(tx);
        if (amount.compareTo(BigDecimal.ZERO) <= 0 || amount.compareTo(refundableRemaining) > 0) {
            throw new RuntimeException("Refund amount must be greater than 0 and within the refundable remaining balance.");
        }

        Refund refund = new Refund();
        refund.setPaymentTransaction(tx);
        refund.setBooking(tx.getBooking());
        refund.setRequestedBy(requestedBy);
        refund.setAmount(amount);
        refund.setReason(reason);
        refund.setStatus(RefundStatus.PENDING);
        return refundRepository.save(refund);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUserRefunds(UUID userId) {
        return refundRepository.findByRequestedByIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toRefundMap)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getUserPaymentOverview(UUID userId) {
        List<PaymentTransaction> transactions = paymentTransactionRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<Refund> refunds = refundRepository.findByRequestedByIdOrderByCreatedAtDesc(userId);

        BigDecimal totalPaid = sumAmounts(transactions.stream()
                .filter(tx -> tx.getStatus() == PaymentStatus.SUCCESS || tx.getStatus() == PaymentStatus.REFUNDED)
                .map(PaymentTransaction::getAmount)
                .toList());
        BigDecimal totalRefunded = sumAmounts(refunds.stream()
                .filter(refund -> refund.getStatus() == RefundStatus.PROCESSED)
                .map(Refund::getAmount)
                .toList());

        Map<String, Long> byGateway = transactions.stream()
                .collect(Collectors.groupingBy(tx -> {
                    String gateway = tx.getGateway();
                    return gateway == null || gateway.isBlank() ? "UNKNOWN" : gateway;
                }, Collectors.counting()));

        Map<String, Object> result = new HashMap<>();
        result.put("totalPaid", totalPaid);
        result.put("totalRefunded", totalRefunded);
        result.put("netSpend", totalPaid.subtract(totalRefunded));
        result.put("successfulPayments", transactions.stream().filter(tx -> tx.getStatus() == PaymentStatus.SUCCESS).count());
        result.put("refundRequests", refunds.size());
        result.put("processedRefunds", refunds.stream().filter(refund -> refund.getStatus() == RefundStatus.PROCESSED).count());
        result.put("paymentMethods", byGateway);
        result.put("pendingBookings", bookingRepository.findByUserId(userId).stream()
                .filter(booking -> booking.getStatus() == BookingStatus.PENDING)
                .count());
        result.put("refundableBookings", getRefundEligibleBookings(userId));
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRefundEligibleBookings(UUID userId) {
        return paymentTransactionRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(tx -> tx.getStatus() == PaymentStatus.SUCCESS || tx.getStatus() == PaymentStatus.REFUNDED)
                .map(tx -> {
                    BigDecimal refundableRemaining = getRefundableRemaining(tx);
                    if (refundableRemaining.compareTo(BigDecimal.ZERO) <= 0) {
                        return null;
                    }

                    Booking booking = tx.getBooking();
                    Map<String, Object> row = new HashMap<>();
                    row.put("bookingId", booking.getId());
                    row.put("paymentId", tx.getId());
                    row.put("therapistName", booking.getTherapist().getUser().getName());
                    row.put("bookingStatus", booking.getStatus());
                    row.put("sessionStart", booking.getAvailabilitySlot().getStartTime());
                    row.put("paidAmount", tx.getAmount());
                    row.put("refundableRemaining", refundableRemaining);
                    row.put("lateCancellationFee", booking.getCancellationFeeAmount());
                    row.put("message", booking.getStatus() == BookingStatus.CANCELLED
                            ? "Cancelled bookings may keep late-cancellation fees according to platform policy."
                            : "Refund eligibility depends on review status and the therapist session state.");
                    return row;
                })
                .filter(row -> row != null)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getBookingQuote(UUID bookingId, User requester) {
        PaymentTransaction existing = paymentTransactionRepository.findByBookingId(bookingId).orElse(null);
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        if (!booking.getUser().getId().equals(requester.getId())) {
            throw new RuntimeException("You can only access payment quotes for your own bookings.");
        }

        BigDecimal sessionFee = existing != null ? existing.getAmount() : booking.getTherapist().getHourlyRate();
        BigDecimal therapistEarning = paymentService.calculateTherapistPayout(sessionFee);
        BigDecimal platformFee = sessionFee.subtract(therapistEarning);

        Map<String, Object> quote = new HashMap<>();
        quote.put("bookingId", booking.getId());
        quote.put("bookingStatus", booking.getStatus());
        quote.put("therapistName", booking.getTherapist().getUser().getName());
        quote.put("sessionFee", sessionFee);
        quote.put("platformFee", platformFee);
        quote.put("therapistEarning", therapistEarning);
        quote.put("supportedMethods", List.of("RAZORPAY", "STRIPE", "CASH"));
        quote.put("cancellationPolicy", "Sessions cancelled within 24 hours may incur a 50% cancellation fee.");
        return quote;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPendingRefundsForAdmin() {
        return refundRepository.findByStatusOrderByCreatedAtAsc(RefundStatus.PENDING).stream()
                .map(this::toRefundMap)
                .collect(Collectors.toList());
    }

    @Transactional
    public Refund approveRefund(UUID refundId, User admin) {
        Refund refund = refundRepository.findById(refundId).orElseThrow(() -> new RuntimeException("Refund request not found"));
        if (refund.getStatus() != RefundStatus.PENDING) {
            throw new RuntimeException("Refund request is not pending.");
        }
        PaymentTransaction tx = refund.getPaymentTransaction();
        boolean isCashPayment = "CASH".equalsIgnoreCase(tx.getGateway());
        if (!isCashPayment) {
            boolean success = paymentService.refundPayment(tx.getGatewayPaymentId(), refund.getAmount());
            if (!success) {
                throw new RuntimeException("Refund gateway processing failed.");
            }
        }

        refund.setStatus(RefundStatus.PROCESSED);
        refund.setProcessedBy(admin);
        refund.setProcessedAt(LocalDateTime.now());
        tx.setStatus(PaymentStatus.REFUNDED);
        paymentTransactionRepository.save(tx);
        return refundRepository.save(refund);
    }

    @Transactional
    public Refund rejectRefund(UUID refundId, User admin) {
        Refund refund = refundRepository.findById(refundId).orElseThrow(() -> new RuntimeException("Refund request not found"));
        if (refund.getStatus() != RefundStatus.PENDING) {
            throw new RuntimeException("Refund request is not pending.");
        }
        refund.setStatus(RefundStatus.REJECTED);
        refund.setProcessedBy(admin);
        refund.setProcessedAt(LocalDateTime.now());
        return refundRepository.save(refund);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTherapistEarnings(UUID therapistUserId) {
        BigDecimal gross = paymentTransactionRepository.sumTherapistEarningByTherapistUserIdAndStatus(
                therapistUserId, PaymentStatus.SUCCESS);
        BigDecimal refunded = paymentTransactionRepository.sumTherapistEarningByTherapistUserIdAndStatus(
                therapistUserId, PaymentStatus.REFUNDED);
        BigDecimal paid = payoutRepository.sumAmountByTherapistUserIdAndStatus(therapistUserId, PayoutStatus.PAID);
        BigDecimal net = gross.subtract(refunded);
        BigDecimal pending = net.subtract(paid);

        Map<String, Object> response = new HashMap<>();
        response.put("grossEarnings", gross);
        response.put("refundedEarnings", refunded);
        response.put("netEarnings", net);
        response.put("paidOut", paid);
        response.put("pendingPayout", pending.max(BigDecimal.ZERO));
        response.put("transactions", paymentTransactionRepository.findByTherapist_User_IdOrderByCreatedAtDesc(therapistUserId)
                .stream().map(this::toPaymentMap).collect(Collectors.toList()));
        return response;
    }

    @Transactional
    public Payout requestPayout(UUID therapistUserId) {
        BigDecimal net = paymentTransactionRepository.sumTherapistEarningByTherapistUserIdAndStatus(
                therapistUserId, PaymentStatus.SUCCESS)
                .subtract(paymentTransactionRepository.sumTherapistEarningByTherapistUserIdAndStatus(
                        therapistUserId, PaymentStatus.REFUNDED));
        BigDecimal paid = payoutRepository.sumAmountByTherapistUserIdAndStatus(therapistUserId, PayoutStatus.PAID);
        BigDecimal requested = payoutRepository.sumAmountByTherapistUserIdAndStatus(therapistUserId, PayoutStatus.REQUESTED);
        BigDecimal available = net.subtract(paid).subtract(requested);

        if (available.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("No available payout amount.");
        }

        Payout payout = new Payout();
        payout.setTherapist(therapistRepository.findByUserId(therapistUserId)
                .orElseThrow(() -> new RuntimeException("Therapist profile not found")));
        payout.setAmount(available);
        payout.setStatus(PayoutStatus.REQUESTED);
        return payoutRepository.save(payout);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTherapistPayouts(UUID therapistUserId) {
        return payoutRepository.findByTherapist_User_IdOrderByCreatedAtDesc(therapistUserId)
                .stream()
                .map(this::toPayoutMap)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPendingPayoutsForAdmin() {
        return payoutRepository.findByStatusOrderByCreatedAtAsc(PayoutStatus.REQUESTED).stream()
                .map(this::toPayoutMap)
                .collect(Collectors.toList());
    }

    @Transactional
    public Payout markPayoutPaid(UUID payoutId, User admin) {
        Payout payout = payoutRepository.findById(payoutId).orElseThrow(() -> new RuntimeException("Payout request not found"));
        if (payout.getStatus() != PayoutStatus.REQUESTED) {
            throw new RuntimeException("Payout is not pending.");
        }
        payout.setStatus(PayoutStatus.PAID);
        payout.setProcessedBy(admin);
        payout.setProcessedAt(LocalDateTime.now());
        return payoutRepository.save(payout);
    }

    private Map<String, Object> toPaymentMap(PaymentTransaction tx) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", tx.getId());
        row.put("bookingId", tx.getBooking().getId());
        row.put("userName", tx.getUser().getName());
        row.put("therapistName", tx.getTherapist().getUser().getName());
        row.put("amount", tx.getAmount());
        row.put("platformCommission", tx.getPlatformCommission());
        row.put("therapistEarning", tx.getTherapistEarning());
        row.put("gatewayOrderId", tx.getGatewayOrderId());
        row.put("gatewayPaymentId", tx.getGatewayPaymentId());
        row.put("gateway", tx.getGateway());
        row.put("status", tx.getStatus());
        row.put("createdAt", tx.getCreatedAt());
        row.put("updatedAt", tx.getUpdatedAt());
        row.put("refundableRemaining", getRefundableRemaining(tx));
        return row;
    }

    private Map<String, Object> toRefundMap(Refund refund) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", refund.getId());
        row.put("bookingId", refund.getBooking().getId());
        row.put("userName", refund.getRequestedBy().getName());
        row.put("therapistName", refund.getBooking().getTherapist().getUser().getName());
        row.put("amount", refund.getAmount());
        row.put("reason", refund.getReason());
        row.put("status", refund.getStatus());
        row.put("createdAt", refund.getCreatedAt());
        return row;
    }

    private Map<String, Object> toPayoutMap(Payout payout) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", payout.getId());
        row.put("therapistName", payout.getTherapist().getUser().getName());
        row.put("amount", payout.getAmount());
        row.put("status", payout.getStatus());
        row.put("createdAt", payout.getCreatedAt());
        row.put("processedAt", payout.getProcessedAt());
        return row;
    }

    private BigDecimal getRefundableRemaining(PaymentTransaction tx) {
        BigDecimal reserved = sumAmounts(refundRepository.findByBookingIdOrderByCreatedAtDesc(tx.getBooking().getId()).stream()
                .filter(refund -> refund.getStatus() == RefundStatus.PENDING || refund.getStatus() == RefundStatus.PROCESSED)
                .map(Refund::getAmount)
                .toList());
        return tx.getAmount().subtract(reserved).max(BigDecimal.ZERO);
    }

    private BigDecimal sumAmounts(List<BigDecimal> amounts) {
        return amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}

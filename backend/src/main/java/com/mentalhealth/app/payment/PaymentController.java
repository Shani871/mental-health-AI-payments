package com.mentalhealth.app.payment;

import com.mentalhealth.app.booking.Booking;
import com.mentalhealth.app.booking.BookingStatus;
import com.mentalhealth.app.booking.BookingRepository;
import com.mentalhealth.app.booking.BookingService;
import com.mentalhealth.app.notification.EmailService;
import com.mentalhealth.app.user.User;
import com.razorpay.RazorpayException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import org.json.JSONObject;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/payment")
@Validated
public class PaymentController {

    private final PaymentService paymentService;
    private final BookingService bookingService;
    private final BookingRepository bookingRepository;
    private final InvoiceService invoiceService;
    private final EmailService emailService;
    private final PaymentLedgerService paymentLedgerService;

    public PaymentController(PaymentService paymentService, BookingService bookingService,
            BookingRepository bookingRepository, InvoiceService invoiceService,
            EmailService emailService, PaymentLedgerService paymentLedgerService) {
        this.paymentService = paymentService;
        this.bookingService = bookingService;
        this.bookingRepository = bookingRepository;
        this.invoiceService = invoiceService;
        this.emailService = emailService;
        this.paymentLedgerService = paymentLedgerService;
    }

    @PostMapping("/create-order")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> createOrder(
            @RequestParam UUID bookingId,
            @RequestParam @DecimalMin(value = "0.01", inclusive = true) BigDecimal amount,
            @RequestParam(defaultValue = "RAZORPAY") String gateway) {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Booking booking = getOwnedBookingOrThrow(bookingId, requester);
        ensurePendingBooking(booking);

        String normalizedGateway = gateway.trim().toUpperCase();
        if ("STRIPE".equals(normalizedGateway)) {
            String sessionId = "stripe_session_" + UUID.randomUUID();
            paymentLedgerService.upsertPendingTransaction(bookingId, amount, sessionId, "STRIPE");
            return ResponseEntity.ok(Map.of("gateway", "STRIPE", "sessionId", sessionId));
        }

        try {
            String orderId = paymentService.createOrder(amount, "INR", "receipt_" + bookingId);
            paymentLedgerService.upsertPendingTransaction(bookingId, amount, orderId, "RAZORPAY");
            return ResponseEntity.ok(Map.of("gateway", "RAZORPAY", "orderId", orderId));
        } catch (RazorpayException e) {
            return ResponseEntity.internalServerError().body("Error creating Razorpay order: " + e.getMessage());
        }
    }

    @PostMapping("/verify")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> verifyPayment(@Valid @RequestBody PaymentVerificationRequest request) {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Booking booking = getOwnedBookingOrThrow(request.getBookingId(), requester);
        ensurePendingBooking(booking);

        boolean isValid = paymentService.verifyPayment(
                request.getRazorpayOrderId(),
                request.getRazorpayPaymentId(),
                request.getRazorpaySignature());

        if (isValid) {
            // 1. Confirm Booking
            bookingService.confirmBooking(request.getBookingId(), request.getRazorpayPaymentId());
            paymentLedgerService.markPaymentSuccess(
                    request.getBookingId(),
                    request.getRazorpayPaymentId(),
                    request.getRazorpaySignature());
            Booking confirmedBooking = bookingRepository.findById(request.getBookingId()).orElseThrow();

            // 2. Generate and Send Invoice
            byte[] invoicePdf = invoiceService.generateInvoicePdf(confirmedBooking);

            try {
                emailService.sendEmailWithAttachment(
                        confirmedBooking.getUser().getEmail(),
                        "Booking Confirmation & Invoice",
                        "Hello " + confirmedBooking.getUser().getName() + ",\n\nYour session with " +
                                confirmedBooking.getTherapist().getUser().getName()
                                + " has been confirmed.\nPlease find your invoice attached.",
                        invoicePdf,
                        "invoice_" + confirmedBooking.getId() + ".pdf");
            } catch (Exception e) {
                // Log error but don't fail the payment verification response
                System.err.println("Failed to send invoice email: " + e.getMessage());
            }

            return ResponseEntity.ok(Map.of("status", "success", "message", "Payment verified and booking confirmed."));
        } else {
            bookingService.handleFailedPayment(request.getBookingId());
            paymentLedgerService.markPaymentFailure(request.getBookingId());
            return ResponseEntity.badRequest()
                    .body(Map.of("status", "failure", "message", "Invalid payment signature."));
        }
    }

    @PostMapping("/cash/confirm")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> confirmCashPayment(
            @RequestParam UUID bookingId,
            @RequestParam @DecimalMin(value = "0.01", inclusive = true) BigDecimal amount) {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Booking booking = getOwnedBookingOrThrow(bookingId, requester);
        ensurePendingBooking(booking);

        String cashPaymentId = "cash_" + UUID.randomUUID();
        bookingService.confirmBooking(bookingId, cashPaymentId);
        paymentLedgerService.markCashPaymentSuccess(bookingId, amount, cashPaymentId);
        Booking confirmedBooking = bookingRepository.findById(bookingId).orElseThrow();

        byte[] invoicePdf = invoiceService.generateInvoicePdf(confirmedBooking);
        try {
            emailService.sendEmailWithAttachment(
                    confirmedBooking.getUser().getEmail(),
                    "Booking Confirmation & Invoice",
                    "Hello " + confirmedBooking.getUser().getName() + ",\n\nYour session with " +
                            confirmedBooking.getTherapist().getUser().getName()
                            + " has been confirmed with cash payment.\nPlease find your invoice attached.",
                    invoicePdf,
                    "invoice_" + confirmedBooking.getId() + ".pdf");
        } catch (Exception e) {
            System.err.println("Failed to send invoice email: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Cash payment recorded and booking confirmed."));
    }

    @PostMapping("/stripe/confirm")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> confirmStripePayment(
            @RequestParam UUID bookingId,
            @RequestParam @NotBlank String sessionId) {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Booking booking = getOwnedBookingOrThrow(bookingId, requester);
        ensurePendingBooking(booking);

        bookingService.confirmBooking(bookingId, sessionId);
        paymentLedgerService.markPaymentSuccess(bookingId, sessionId, "stripe-confirmed");
        return ResponseEntity.ok(Map.of("status", "success", "message", "Stripe payment confirmed."));
    }

    @PostMapping("/webhook/razorpay")
    public ResponseEntity<?> handleRazorpayWebhook(
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature,
            @RequestBody String payload) {
        if (!paymentService.verifyWebhookSignature(payload, signature)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid webhook signature"));
        }

        JSONObject root = new JSONObject(payload);
        String event = root.optString("event", "");
        if (event.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Missing event"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("event", event);

        if ("payment.captured".equals(event)) {
            JSONObject entity = root.getJSONObject("payload")
                    .getJSONObject("payment")
                    .getJSONObject("entity");
            String orderId = entity.optString("order_id");
            String paymentId = entity.optString("id");
            String webhookSig = signature == null ? "" : signature;

            paymentLedgerService.markPaymentSuccessByOrderId(orderId, paymentId, webhookSig);
            UUID bookingId = paymentLedgerService.getBookingIdByGatewayOrderId(orderId);
            Booking booking = bookingRepository.findById(bookingId)
                    .orElseThrow(() -> new RuntimeException("Booking not found"));
            if (booking.getStatus() == BookingStatus.PENDING) {
                bookingService.confirmBooking(bookingId, paymentId);
            }
            response.put("status", "processed");
            response.put("bookingId", bookingId);
            return ResponseEntity.ok(response);
        }

        if ("payment.failed".equals(event)) {
            JSONObject entity = root.getJSONObject("payload")
                    .getJSONObject("payment")
                    .getJSONObject("entity");
            String orderId = entity.optString("order_id");
            paymentLedgerService.markPaymentFailureByOrderId(orderId);
            UUID bookingId = paymentLedgerService.getBookingIdByGatewayOrderId(orderId);
            bookingService.handleFailedPayment(bookingId);
            response.put("status", "processed");
            response.put("bookingId", bookingId);
            return ResponseEntity.ok(response);
        }

        response.put("status", "ignored");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/invoice/{bookingId}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ByteArrayResource> downloadInvoice(@PathVariable UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!booking.getUser().getId().equals(requester.getId())) {
            throw new RuntimeException("You can only download your own invoices.");
        }
        if (booking.getPaymentId() == null || booking.getPaymentId().isBlank()) {
            throw new RuntimeException("Invoice is available only after successful payment.");
        }

        byte[] invoicePdf = invoiceService.generateInvoicePdf(booking);
        ByteArrayResource resource = new ByteArrayResource(invoicePdf);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=invoice_" + bookingId + ".pdf")
                .contentLength(invoicePdf.length)
                .body(resource);
    }

    @GetMapping("/history")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getMyPaymentHistory() {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(paymentLedgerService.getUserPaymentHistory(requester.getId()));
    }

    @PostMapping("/refund-request")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> requestRefund(
            @RequestParam UUID bookingId,
            @RequestParam @DecimalMin(value = "0.01", inclusive = true) BigDecimal amount,
            @RequestParam @NotBlank String reason) {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Refund refund = paymentLedgerService.requestRefund(bookingId, amount, reason, requester);
        return ResponseEntity.ok(Map.of("id", refund.getId(), "status", refund.getStatus(), "message", "Refund request submitted"));
    }

    @GetMapping("/refunds/my")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getMyRefunds() {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(paymentLedgerService.getUserRefunds(requester.getId()));
    }

    @GetMapping("/earnings")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> getTherapistEarnings() {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(paymentLedgerService.getTherapistEarnings(requester.getId()));
    }

    @PostMapping("/payouts/request")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> requestPayout() {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Payout payout = paymentLedgerService.requestPayout(requester.getId());
        return ResponseEntity.ok(Map.of("id", payout.getId(), "status", payout.getStatus(), "amount", payout.getAmount()));
    }

    @GetMapping("/payouts/my")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> getMyPayouts() {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(paymentLedgerService.getTherapistPayouts(requester.getId()));
    }

    @GetMapping("/admin/refunds/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getPendingRefundRequests() {
        return ResponseEntity.ok(paymentLedgerService.getPendingRefundsForAdmin());
    }

    @PutMapping("/admin/refunds/{refundId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> approveRefund(@PathVariable UUID refundId) {
        User admin = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Refund refund = paymentLedgerService.approveRefund(refundId, admin);
        return ResponseEntity.ok(Map.of("id", refund.getId(), "status", refund.getStatus(), "message", "Refund processed"));
    }

    @PutMapping("/admin/refunds/{refundId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> rejectRefund(@PathVariable UUID refundId) {
        User admin = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Refund refund = paymentLedgerService.rejectRefund(refundId, admin);
        return ResponseEntity.ok(Map.of("id", refund.getId(), "status", refund.getStatus(), "message", "Refund rejected"));
    }

    @GetMapping("/admin/payouts/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getPendingPayoutRequests() {
        return ResponseEntity.ok(paymentLedgerService.getPendingPayoutsForAdmin());
    }

    @PutMapping("/admin/payouts/{payoutId}/mark-paid")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> markPayoutPaid(@PathVariable UUID payoutId) {
        User admin = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Payout payout = paymentLedgerService.markPayoutPaid(payoutId, admin);
        return ResponseEntity.ok(Map.of("id", payout.getId(), "status", payout.getStatus(), "message", "Payout marked as paid"));
    }

    private Booking getOwnedBookingOrThrow(UUID bookingId, User requester) {
        if (bookingId == null) {
            throw new RuntimeException("Booking ID is required.");
        }
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        if (!booking.getUser().getId().equals(requester.getId())) {
            throw new RuntimeException("You can only pay for your own booking.");
        }
        return booking;
    }

    private void ensurePendingBooking(Booking booking) {
        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new RuntimeException("Payment is allowed only for pending bookings.");
        }
    }
}

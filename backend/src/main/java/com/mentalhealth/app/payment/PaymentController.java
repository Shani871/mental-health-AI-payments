package com.mentalhealth.app.payment;

import com.mentalhealth.app.booking.Booking;
import com.mentalhealth.app.booking.BookingRepository;
import com.mentalhealth.app.booking.BookingService;
import com.mentalhealth.app.notification.EmailService;
import com.razorpay.RazorpayException;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/payment")
public class PaymentController {

    private final PaymentService paymentService;
    private final BookingService bookingService;
    private final BookingRepository bookingRepository;
    private final InvoiceService invoiceService;
    private final EmailService emailService;

    public PaymentController(PaymentService paymentService, BookingService bookingService,
            BookingRepository bookingRepository, InvoiceService invoiceService,
            EmailService emailService) {
        this.paymentService = paymentService;
        this.bookingService = bookingService;
        this.bookingRepository = bookingRepository;
        this.invoiceService = invoiceService;
        this.emailService = emailService;
    }

    @PostMapping("/create-order")
    public ResponseEntity<?> createOrder(@RequestParam UUID bookingId, @RequestParam BigDecimal amount) {
        try {
            String orderId = paymentService.createOrder(amount, "INR", "receipt_" + bookingId);
            return ResponseEntity.ok(Map.of("orderId", orderId));
        } catch (RazorpayException e) {
            return ResponseEntity.internalServerError().body("Error creating Razorpay order: " + e.getMessage());
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyPayment(@Valid @RequestBody PaymentVerificationRequest request) {
        boolean isValid = paymentService.verifyPayment(
                request.getRazorpayOrderId(),
                request.getRazorpayPaymentId(),
                request.getRazorpaySignature());

        if (isValid) {
            // 1. Confirm Booking
            bookingService.confirmBooking(request.getBookingId(), request.getRazorpayPaymentId());

            // 2. Generate and Send Invoice
            Booking booking = bookingRepository.findById(request.getBookingId()).orElseThrow();
            byte[] invoicePdf = invoiceService.generateInvoicePdf(booking);

            try {
                emailService.sendEmailWithAttachment(
                        booking.getUser().getEmail(),
                        "Booking Confirmation & Invoice",
                        "Hello " + booking.getUser().getName() + ",\n\nYour session with " +
                                booking.getTherapist().getUser().getName()
                                + " has been confirmed.\nPlease find your invoice attached.",
                        invoicePdf,
                        "invoice_" + booking.getId() + ".pdf");
            } catch (Exception e) {
                // Log error but don't fail the payment verification response
                System.err.println("Failed to send invoice email: " + e.getMessage());
            }

            return ResponseEntity.ok(Map.of("status", "success", "message", "Payment verified and booking confirmed."));
        } else {
            return ResponseEntity.badRequest()
                    .body(Map.of("status", "failure", "message", "Invalid payment signature."));
        }
    }
}

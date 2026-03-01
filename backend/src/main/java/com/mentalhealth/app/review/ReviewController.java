package com.mentalhealth.app.review;

import com.mentalhealth.app.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/reviews")
@Validated
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> submitReview(@RequestBody Map<String, Object> payload) {
        User requester = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        UUID bookingId = UUID.fromString(String.valueOf(payload.get("bookingId")));
        int rating = Integer.parseInt(String.valueOf(payload.get("rating")));
        String comment = payload.get("comment") == null ? null : String.valueOf(payload.get("comment"));
        if (rating < 1 || rating > 5) {
            throw new RuntimeException("Rating must be between 1 and 5.");
        }
        return ResponseEntity.ok(reviewService.submitReview(bookingId, rating, comment, requester));
    }

    @GetMapping("/therapist/{therapistId}")
    public ResponseEntity<?> getPublicReviews(@PathVariable UUID therapistId) {
        return ResponseEntity.ok(reviewService.getPublicTherapistReviews(therapistId));
    }

    @GetMapping("/admin/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getPendingReviews() {
        return ResponseEntity.ok(reviewService.getPendingReviewsForAdmin());
    }

    @PutMapping("/admin/{reviewId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> approveReview(@PathVariable UUID reviewId) {
        return ResponseEntity.ok(reviewService.approveReview(reviewId));
    }

    @PutMapping("/admin/{reviewId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> rejectReview(@PathVariable UUID reviewId) {
        return ResponseEntity.ok(reviewService.rejectReview(reviewId));
    }
}

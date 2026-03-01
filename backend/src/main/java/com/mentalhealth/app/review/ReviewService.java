package com.mentalhealth.app.review;

import com.mentalhealth.app.booking.Booking;
import com.mentalhealth.app.booking.BookingRepository;
import com.mentalhealth.app.booking.BookingStatus;
import com.mentalhealth.app.notification.InAppNotificationService;
import com.mentalhealth.app.therapist.TherapistProfile;
import com.mentalhealth.app.therapist.TherapistProfileRepository;
import com.mentalhealth.app.therapist.TherapistRepository;
import com.mentalhealth.app.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReviewService {

    private final TherapistReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final TherapistProfileRepository therapistProfileRepository;
    private final TherapistRepository therapistRepository;
    private final InAppNotificationService notificationService;

    public ReviewService(TherapistReviewRepository reviewRepository,
            BookingRepository bookingRepository,
            TherapistProfileRepository therapistProfileRepository,
            TherapistRepository therapistRepository,
            InAppNotificationService notificationService) {
        this.reviewRepository = reviewRepository;
        this.bookingRepository = bookingRepository;
        this.therapistProfileRepository = therapistProfileRepository;
        this.therapistRepository = therapistRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public TherapistReview submitReview(UUID bookingId, int rating, String comment, User requester) {
        if (rating < 1 || rating > 5) {
            throw new RuntimeException("Rating must be between 1 and 5.");
        }
        if (reviewRepository.existsByBookingId(bookingId)) {
            throw new RuntimeException("A review already exists for this booking.");
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        if (!booking.getUser().getId().equals(requester.getId())) {
            throw new RuntimeException("You can only review your own booking.");
        }
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new RuntimeException("Review can be submitted only after completed session.");
        }

        TherapistReview review = new TherapistReview();
        review.setBooking(booking);
        review.setUser(requester);
        review.setTherapist(booking.getTherapist());
        review.setRating(rating);
        review.setComment(comment);
        review.setStatus(ReviewStatus.PENDING);
        TherapistReview saved = reviewRepository.save(review);

        notificationService.create(
                booking.getTherapist().getUser(),
                "NEW_REVIEW_PENDING",
                "A new review was submitted and is awaiting admin moderation.",
                Map.of("bookingId", booking.getId().toString(), "reviewId", saved.getId().toString()));
        return saved;
    }

    @Transactional
    public TherapistReview approveReview(UUID reviewId) {
        TherapistReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new RuntimeException("Review not found"));
        review.setStatus(ReviewStatus.APPROVED);
        review.setModeratedAt(LocalDateTime.now());
        TherapistReview saved = reviewRepository.save(review);
        refreshTherapistRating(review.getTherapist().getId());

        notificationService.create(
                review.getUser(),
                "REVIEW_APPROVED",
                "Your review has been approved and published.",
                Map.of("reviewId", review.getId().toString()));
        return saved;
    }

    @Transactional
    public TherapistReview rejectReview(UUID reviewId) {
        TherapistReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new RuntimeException("Review not found"));
        review.setStatus(ReviewStatus.REJECTED);
        review.setModeratedAt(LocalDateTime.now());
        TherapistReview saved = reviewRepository.save(review);
        refreshTherapistRating(review.getTherapist().getId());

        notificationService.create(
                review.getUser(),
                "REVIEW_REJECTED",
                "Your review was rejected by admin moderation.",
                Map.of("reviewId", review.getId().toString()));
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPublicTherapistReviews(UUID therapistId) {
        return reviewRepository.findByTherapistIdAndStatusOrderByCreatedAtDesc(therapistId, ReviewStatus.APPROVED)
                .stream()
                .map(this::toReviewMap)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPendingReviewsForAdmin() {
        return reviewRepository.findByStatusOrderByCreatedAtAsc(ReviewStatus.PENDING)
                .stream()
                .map(this::toReviewMap)
                .collect(Collectors.toList());
    }

    private void refreshTherapistRating(UUID therapistId) {
        TherapistProfile profile = therapistProfileRepository.findByTherapistId(therapistId)
                .orElseGet(() -> {
                    TherapistProfile created = new TherapistProfile();
                    created.setTherapist(therapistRepository.findById(therapistId)
                            .orElseThrow(() -> new RuntimeException("Therapist not found")));
                    return created;
                });
        Double avg = reviewRepository.averageRatingByTherapistAndStatus(therapistId, ReviewStatus.APPROVED);
        profile.setRating(avg == null ? 0.0 : Math.round(avg * 100.0) / 100.0);
        therapistProfileRepository.save(profile);
    }

    private Map<String, Object> toReviewMap(TherapistReview review) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", review.getId());
        row.put("bookingId", review.getBooking().getId());
        row.put("therapistId", review.getTherapist().getId());
        row.put("therapistName", review.getTherapist().getUser().getName());
        row.put("userName", review.getUser().getName());
        row.put("rating", review.getRating());
        row.put("comment", review.getComment());
        row.put("status", review.getStatus());
        row.put("createdAt", review.getCreatedAt());
        row.put("moderatedAt", review.getModeratedAt());
        return row;
    }
}

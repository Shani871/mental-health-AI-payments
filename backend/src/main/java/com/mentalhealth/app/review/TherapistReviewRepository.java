package com.mentalhealth.app.review;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TherapistReviewRepository extends JpaRepository<TherapistReview, UUID> {
    boolean existsByBookingId(UUID bookingId);

    List<TherapistReview> findByTherapistIdAndStatusOrderByCreatedAtDesc(UUID therapistId, ReviewStatus status);

    List<TherapistReview> findByStatusOrderByCreatedAtAsc(ReviewStatus status);

    @Query("select coalesce(avg(r.rating), 0.0) from TherapistReview r where r.therapist.id = :therapistId and r.status = :status")
    Double averageRatingByTherapistAndStatus(@Param("therapistId") UUID therapistId, @Param("status") ReviewStatus status);
}

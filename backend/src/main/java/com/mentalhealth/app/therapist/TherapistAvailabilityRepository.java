package com.mentalhealth.app.therapist;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface TherapistAvailabilityRepository extends JpaRepository<TherapistAvailability, UUID> {
    List<TherapistAvailability> findByTherapistIdAndIsBookedFalseAndStartTimeAfter(UUID therapistId,
            LocalDateTime startTime);

    boolean existsByTherapistIdAndStartTimeBetween(UUID therapistId, LocalDateTime start, LocalDateTime end);
}

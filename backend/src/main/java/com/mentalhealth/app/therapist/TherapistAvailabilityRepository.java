package com.mentalhealth.app.therapist;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface TherapistAvailabilityRepository extends JpaRepository<TherapistAvailability, UUID> {
    List<TherapistAvailability> findByTherapistIdAndBookedFalseAndStartTimeAfter(UUID therapistId,
            LocalDateTime startTime);

    boolean existsByTherapistIdAndStartTimeBetween(UUID therapistId, LocalDateTime start, LocalDateTime end);

    long countByTherapistId(UUID therapistId);

    long countByTherapistIdAndBookedTrue(UUID therapistId);

    List<TherapistAvailability> findByTherapistIdOrderByStartTimeAsc(UUID therapistId);

    @Query("select (count(a) > 0) from TherapistAvailability a where a.therapist.id = :therapistId and a.startTime < :endTime and a.endTime > :startTime and (:excludeSlotId is null or a.id <> :excludeSlotId)")
    boolean existsOverlappingSlot(
            @Param("therapistId") UUID therapistId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("excludeSlotId") UUID excludeSlotId);
}

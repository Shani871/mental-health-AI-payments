package com.mentalhealth.app.booking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {
    List<Booking> findByUserId(UUID userId);

    List<Booking> findByTherapistId(UUID therapistId);

    List<Booking> findByTherapist_User_Id(UUID therapistUserId);

    List<Booking> findByTherapist_User_IdAndStatusIn(UUID therapistUserId, List<BookingStatus> statuses);

    List<Booking> findByStatusAndAvailabilitySlot_StartTimeBetween(BookingStatus status, LocalDateTime start,
            LocalDateTime end);

    List<Booking> findByStatusAndCreatedAtBefore(BookingStatus status, LocalDateTime createdBefore);
}

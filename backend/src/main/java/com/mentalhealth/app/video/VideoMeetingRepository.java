package com.mentalhealth.app.video;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VideoMeetingRepository extends JpaRepository<VideoMeeting, UUID> {
    Optional<VideoMeeting> findByBookingId(UUID bookingId);

    List<VideoMeeting> findByBookingUserIdOrderByCreatedAtDesc(UUID userId);

    List<VideoMeeting> findByBookingTherapistUserIdOrderByCreatedAtDesc(UUID therapistUserId);
}

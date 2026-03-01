package com.mentalhealth.app.ai;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface MoodCheckinRepository extends JpaRepository<MoodCheckin, UUID> {
    List<MoodCheckin> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<MoodCheckin> findByUserIdAndCreatedAtAfterOrderByCreatedAtAsc(UUID userId, LocalDateTime createdAt);
}

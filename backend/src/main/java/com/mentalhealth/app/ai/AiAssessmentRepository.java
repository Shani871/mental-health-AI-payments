package com.mentalhealth.app.ai;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AiAssessmentRepository extends JpaRepository<AiAssessment, UUID> {
    List<AiAssessment> findAllByUserId(UUID userId);
}

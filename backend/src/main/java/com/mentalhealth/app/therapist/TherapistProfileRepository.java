package com.mentalhealth.app.therapist;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TherapistProfileRepository extends JpaRepository<TherapistProfile, UUID> {
    Optional<TherapistProfile> findByTherapistId(UUID therapistId);
}

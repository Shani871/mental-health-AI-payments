package com.mentalhealth.app.therapist;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class TherapistService {

    private final TherapistRepository therapistRepository;
    private final TherapistProfileRepository profileRepository;
    private final TherapistAvailabilityRepository availabilityRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String LOCK_PREFIX = "lock:slot:";

    public TherapistService(TherapistRepository therapistRepository,
            TherapistProfileRepository profileRepository,
            TherapistAvailabilityRepository availabilityRepository,
            RedisTemplate<String, Object> redisTemplate) {
        this.therapistRepository = therapistRepository;
        this.profileRepository = profileRepository;
        this.availabilityRepository = availabilityRepository;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    public TherapistProfile createOrUpdateProfile(UUID therapistId, String bio, String profilePictureUrl) {
        Therapist therapist = therapistRepository.findById(therapistId)
                .orElseThrow(() -> new RuntimeException("Therapist not found"));

        TherapistProfile profile = profileRepository.findByTherapistId(therapistId)
                .orElse(new TherapistProfile());

        profile.setTherapist(therapist);
        profile.setBio(bio);
        profile.setProfilePictureUrl(profilePictureUrl);

        return profileRepository.save(profile);
    }

    @Transactional
    public TherapistAvailability addAvailabilitySlot(UUID therapistId, LocalDateTime start, LocalDateTime end) {
        Therapist therapist = therapistRepository.findById(therapistId)
                .orElseThrow(() -> new RuntimeException("Therapist not found"));

        // Production refinement: Prevent overlapping slots
        boolean exists = availabilityRepository.existsByTherapistIdAndStartTimeBetween(therapistId, start, end);
        if (exists) {
            throw new RuntimeException("An availability slot already exists during this period.");
        }

        TherapistAvailability availability = new TherapistAvailability(therapist, start, end);
        return availabilityRepository.save(availability);
    }

    public List<TherapistAvailability> getAvailableSlots(UUID therapistId) {
        return availabilityRepository.findByTherapistIdAndIsBookedFalseAndStartTimeAfter(therapistId,
                LocalDateTime.now());
    }

    public boolean lockSlot(UUID slotId) {
        String key = LOCK_PREFIX + slotId.toString();
        // Try to acquire lock for 10 minutes
        Boolean success = redisTemplate.opsForValue().setIfAbsent(key, "LOCKED", 10, TimeUnit.MINUTES);
        return Boolean.TRUE.equals(success);
    }

    public void unlockSlot(UUID slotId) {
        String key = LOCK_PREFIX + slotId.toString();
        redisTemplate.delete(key);
    }
}

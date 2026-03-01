package com.mentalhealth.app.therapist;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

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
        return createOrUpdateProfile(therapistId, bio, profilePictureUrl, null, null);
    }

    @Transactional
    public TherapistProfile createOrUpdateProfile(UUID therapistId, String bio, String profilePictureUrl,
            String licenseDocumentUrl, String idDocumentUrl) {
        Therapist therapist = therapistRepository.findById(therapistId)
                .orElseThrow(() -> new RuntimeException("Therapist not found"));

        TherapistProfile profile = profileRepository.findByTherapistId(therapistId)
                .orElse(new TherapistProfile());

        profile.setTherapist(therapist);
        if (bio != null) {
            profile.setBio(bio);
        }
        if (profilePictureUrl != null) {
            profile.setProfilePictureUrl(profilePictureUrl);
        }
        if (licenseDocumentUrl != null) {
            profile.setLicenseDocumentUrl(licenseDocumentUrl);
        }
        if (idDocumentUrl != null) {
            profile.setIdDocumentUrl(idDocumentUrl);
        }

        return profileRepository.save(profile);
    }

    @Transactional
    public TherapistAvailability addAvailabilitySlot(UUID therapistId, LocalDateTime start, LocalDateTime end) {
        Therapist therapist = therapistRepository.findById(therapistId)
                .orElseThrow(() -> new RuntimeException("Therapist not found"));

        if (!start.isBefore(end)) {
            throw new RuntimeException("Slot end time must be after start time.");
        }

        boolean exists = availabilityRepository.existsOverlappingSlot(therapistId, start, end, null);
        if (exists) {
            throw new RuntimeException("An availability slot already exists during this period.");
        }

        TherapistAvailability availability = new TherapistAvailability(therapist, start, end);
        return availabilityRepository.save(availability);
    }

    @Transactional
    public TherapistAvailability updateAvailabilitySlot(UUID therapistId, UUID slotId, LocalDateTime start, LocalDateTime end) {
        if (!start.isBefore(end)) {
            throw new RuntimeException("Slot end time must be after start time.");
        }

        TherapistAvailability slot = availabilityRepository.findById(slotId)
                .orElseThrow(() -> new RuntimeException("Availability slot not found"));
        if (!slot.getTherapist().getId().equals(therapistId)) {
            throw new RuntimeException("You can only update your own slots.");
        }
        if (Boolean.TRUE.equals(slot.getBooked())) {
            throw new RuntimeException("Booked slots cannot be updated.");
        }

        boolean overlap = availabilityRepository.existsOverlappingSlot(therapistId, start, end, slotId);
        if (overlap) {
            throw new RuntimeException("An overlapping availability slot already exists.");
        }

        slot.setStartTime(start);
        slot.setEndTime(end);
        return availabilityRepository.save(slot);
    }

    public List<TherapistAvailability> getAvailableSlots(UUID therapistId) {
        return availabilityRepository.findByTherapistIdAndBookedFalseAndStartTimeAfter(therapistId,
                LocalDateTime.now());
    }

    public List<TherapistAvailability> getTherapistSlots(UUID therapistId) {
        return availabilityRepository.findByTherapistIdOrderByStartTimeAsc(therapistId);
    }

    public boolean lockSlot(UUID slotId) {
        return lockSlot(slotId, 5);
    }

    public boolean lockSlot(UUID slotId, int minutes) {
        String key = LOCK_PREFIX + slotId.toString();
        Boolean success = redisTemplate.opsForValue().setIfAbsent(key, "LOCKED", minutes, TimeUnit.MINUTES);
        return Boolean.TRUE.equals(success);
    }

    public void unlockSlot(UUID slotId) {
        String key = LOCK_PREFIX + slotId.toString();
        redisTemplate.delete(key);
    }

    public Map<String, Object> getSlotUtilization(UUID therapistId) {
        long total = availabilityRepository.countByTherapistId(therapistId);
        long booked = availabilityRepository.countByTherapistIdAndBookedTrue(therapistId);
        double utilization = total == 0 ? 0.0 : (booked * 100.0) / total;

        Map<String, Object> response = new HashMap<>();
        response.put("therapistId", therapistId);
        response.put("totalSlots", total);
        response.put("bookedSlots", booked);
        response.put("utilizationPercent", Math.round(utilization * 100.0) / 100.0);
        return response;
    }

    public List<Map<String, Object>> searchTherapists(
            String specialization,
            Double minRating,
            BigDecimal maxPrice,
            String keyword,
            String language,
            LocalDateTime availableAfter) {

        LocalDateTime availabilityStart = availableAfter == null ? LocalDateTime.now() : availableAfter;
        String keywordQuery = keyword == null ? "" : keyword.toLowerCase();
        String languageQuery = language == null ? "" : language.toLowerCase();
        String specializationQuery = specialization == null ? "" : specialization.toLowerCase();
        double requiredRating = minRating == null ? 0.0 : minRating;

        return therapistRepository.findAll().stream()
                .filter(t -> t.getApprovalStatus() == TherapistApprovalStatus.VERIFIED)
                .filter(t -> specializationQuery.isBlank()
                        || (t.getSpecialization() != null
                                && t.getSpecialization().toLowerCase().contains(specializationQuery)))
                .filter(t -> languageQuery.isBlank()
                        || (t.getLanguage() != null && t.getLanguage().toLowerCase().contains(languageQuery)))
                .filter(t -> maxPrice == null
                        || (t.getHourlyRate() != null && t.getHourlyRate().compareTo(maxPrice) <= 0))
                .map(therapist -> toTherapistSearchResponse(therapist, availabilityStart))
                .filter(item -> availableAfter == null || ((Integer) item.get("availableSlotCount")) > 0)
                .filter(item -> ((Double) item.get("rating")) >= requiredRating)
                .filter(item -> keywordQuery.isBlank()
                        || item.get("therapistName").toString().toLowerCase().contains(keywordQuery)
                        || item.get("specialization").toString().toLowerCase().contains(keywordQuery)
                        || item.get("bio").toString().toLowerCase().contains(keywordQuery))
                .sorted(Comparator.comparing(item -> (Double) item.get("rating"), Comparator.reverseOrder()))
                .collect(Collectors.toList());
    }

    public Map<String, Object> getTherapistProfileDetails(UUID therapistId) {
        Therapist therapist = therapistRepository.findById(therapistId)
                .orElseThrow(() -> new RuntimeException("Therapist not found"));
        return toTherapistSearchResponse(therapist, LocalDateTime.now());
    }

    private Map<String, Object> toTherapistSearchResponse(Therapist therapist, LocalDateTime availableAfter) {
        TherapistProfile profile = profileRepository.findByTherapistId(therapist.getId()).orElse(new TherapistProfile());
        List<TherapistAvailability> nextSlots = availabilityRepository.findByTherapistIdAndBookedFalseAndStartTimeAfter(
                therapist.getId(), availableAfter);

        String nextAvailableSlot = nextSlots.isEmpty() ? null : nextSlots.get(0).getStartTime().toString();

        Map<String, Object> item = new HashMap<>();
        item.put("therapistId", therapist.getId());
        item.put("therapistName", therapist.getUser().getName());
        item.put("specialization", therapist.getSpecialization() == null ? "" : therapist.getSpecialization());
        item.put("language", therapist.getLanguage() == null ? "" : therapist.getLanguage());
        item.put("hourlyRate", therapist.getHourlyRate());
        item.put("experienceYears", therapist.getExperienceYears());
        item.put("rating", profile.getRating() == null ? 0.0 : profile.getRating());
        item.put("bio", profile.getBio() == null ? "" : profile.getBio());
        item.put("profilePictureUrl", profile.getProfilePictureUrl());
        item.put("licenseDocumentUrl", profile.getLicenseDocumentUrl());
        item.put("idDocumentUrl", profile.getIdDocumentUrl());
        item.put("approvalStatus", therapist.getApprovalStatus().name());
        item.put("nextAvailableSlot", nextAvailableSlot);
        item.put("availableSlotCount", nextSlots.size());
        return item;
    }
}

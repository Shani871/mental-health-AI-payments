package com.mentalhealth.app.video;

import com.mentalhealth.app.booking.Booking;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class VideoMeetingService {

    private final VideoMeetingRepository videoMeetingRepository;

    public VideoMeetingService(VideoMeetingRepository videoMeetingRepository) {
        this.videoMeetingRepository = videoMeetingRepository;
    }

    @Transactional
    public VideoMeeting upsertForBooking(Booking booking, ZoomService.MeetingDetails details) {
        VideoMeeting meeting = videoMeetingRepository.findByBookingId(booking.getId()).orElseGet(VideoMeeting::new);
        meeting.setBooking(booking);
        meeting.setMeetingId(details.getMeetingId());
        meeting.setJoinUrl(details.getJoinUrl());
        meeting.setHostUrl(details.getHostUrl());
        meeting.setSessionDuration(details.getSessionDuration());
        meeting.setProvider(details.getProvider());
        meeting.setAttendanceStatus(MeetingAttendanceStatus.SCHEDULED);
        meeting.setUpdatedAt(LocalDateTime.now());
        return videoMeetingRepository.save(meeting);
    }

    @Transactional
    public void markAttendance(UUID bookingId, MeetingAttendanceStatus status) {
        videoMeetingRepository.findByBookingId(bookingId).ifPresent(meeting -> {
            meeting.setAttendanceStatus(status);
            meeting.setUpdatedAt(LocalDateTime.now());
            videoMeetingRepository.save(meeting);
        });
    }

    @Transactional
    public VideoMeeting upsertGoogleMeetForBooking(Booking booking, String joinUrl) {
        VideoMeeting meeting = videoMeetingRepository.findByBookingId(booking.getId()).orElseGet(VideoMeeting::new);
        meeting.setBooking(booking);
        meeting.setMeetingId(extractGoogleMeetCode(joinUrl));
        meeting.setJoinUrl(joinUrl);
        meeting.setHostUrl(joinUrl);

        int minutes = 60;
        if (booking.getAvailabilitySlot() != null
                && booking.getAvailabilitySlot().getStartTime() != null
                && booking.getAvailabilitySlot().getEndTime() != null) {
            long slotMinutes = Duration.between(
                    booking.getAvailabilitySlot().getStartTime(),
                    booking.getAvailabilitySlot().getEndTime()).toMinutes();
            if (slotMinutes > 0) {
                minutes = (int) slotMinutes;
            }
        }

        meeting.setSessionDuration(minutes);
        meeting.setProvider("GOOGLE_MEET");
        meeting.setAttendanceStatus(MeetingAttendanceStatus.SCHEDULED);
        meeting.setUpdatedAt(LocalDateTime.now());
        return videoMeetingRepository.save(meeting);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUserMeetings(UUID userId) {
        return getUserMeetings(userId, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUserMeetings(
            UUID userId,
            String query,
            String provider,
            String attendanceStatus,
            LocalDateTime from,
            LocalDateTime to) {
        return videoMeetingRepository.findByBookingUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .filter(meeting -> matchesFilters(meeting, query, provider, attendanceStatus, from, to))
                .sorted(Comparator.comparing(this::meetingStartTimeOrCreatedAt, Comparator.reverseOrder()))
                .map(this::toMap)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTherapistMeetings(UUID therapistUserId) {
        return getTherapistMeetings(therapistUserId, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTherapistMeetings(
            UUID therapistUserId,
            String query,
            String provider,
            String attendanceStatus,
            LocalDateTime from,
            LocalDateTime to) {
        return videoMeetingRepository.findByBookingTherapistUserIdOrderByCreatedAtDesc(therapistUserId)
                .stream()
                .filter(meeting -> matchesFilters(meeting, query, provider, attendanceStatus, from, to))
                .sorted(Comparator.comparing(this::meetingStartTimeOrCreatedAt, Comparator.reverseOrder()))
                .map(this::toMap)
                .collect(Collectors.toList());
    }

    private String extractGoogleMeetCode(String joinUrl) {
        if (joinUrl == null || joinUrl.isBlank()) {
            return "meet-" + UUID.randomUUID();
        }
        String[] parts = joinUrl.split("/");
        String last = parts[parts.length - 1];
        int queryIndex = last.indexOf('?');
        if (queryIndex >= 0) {
            last = last.substring(0, queryIndex);
        }
        return (last == null || last.isBlank()) ? "meet-" + UUID.randomUUID() : last;
    }

    private Map<String, Object> toMap(VideoMeeting meeting) {
        LocalDateTime startTime = meeting.getBooking().getAvailabilitySlot() == null
                ? null
                : meeting.getBooking().getAvailabilitySlot().getStartTime();
        LocalDateTime endTime = meeting.getBooking().getAvailabilitySlot() == null
                ? null
                : meeting.getBooking().getAvailabilitySlot().getEndTime();
        Map<String, Object> row = new HashMap<>();
        row.put("id", meeting.getId());
        row.put("bookingId", meeting.getBooking().getId());
        row.put("bookingStatus", meeting.getBooking().getStatus());
        row.put("meetingId", meeting.getMeetingId());
        row.put("joinUrl", meeting.getJoinUrl());
        row.put("hostUrl", meeting.getHostUrl() == null ? "" : meeting.getHostUrl());
        row.put("provider", meeting.getProvider());
        row.put("sessionDuration", meeting.getSessionDuration());
        row.put("attendanceStatus", meeting.getAttendanceStatus());
        row.put("userName", meeting.getBooking().getUser().getName());
        row.put("userEmail", meeting.getBooking().getUser().getEmail());
        row.put("therapistName", meeting.getBooking().getTherapist().getUser().getName());
        row.put("therapistEmail", meeting.getBooking().getTherapist().getUser().getEmail());
        row.put("startTime", startTime);
        row.put("endTime", endTime);
        row.put("createdAt", meeting.getCreatedAt());
        return row;
    }

    private boolean matchesFilters(
            VideoMeeting meeting,
            String query,
            String provider,
            String attendanceStatus,
            LocalDateTime from,
            LocalDateTime to) {
        if (provider != null && !provider.isBlank()
                && !meeting.getProvider().equalsIgnoreCase(provider.trim())) {
            return false;
        }

        if (attendanceStatus != null && !attendanceStatus.isBlank()) {
            MeetingAttendanceStatus expected;
            try {
                expected = MeetingAttendanceStatus.valueOf(attendanceStatus.trim().toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new RuntimeException("Invalid attendanceStatus. Use one of: SCHEDULED, ATTENDED, NO_SHOW.");
            }
            if (meeting.getAttendanceStatus() != expected) {
                return false;
            }
        }

        LocalDateTime startTime = meeting.getBooking().getAvailabilitySlot() == null
                ? null
                : meeting.getBooking().getAvailabilitySlot().getStartTime();
        if (from != null && (startTime == null || startTime.isBefore(from))) {
            return false;
        }
        if (to != null && (startTime == null || startTime.isAfter(to))) {
            return false;
        }

        if (query == null || query.isBlank()) {
            return true;
        }
        String normalized = query.trim().toLowerCase();
        return contains(meeting.getMeetingId(), normalized)
                || contains(meeting.getJoinUrl(), normalized)
                || contains(meeting.getBooking().getUser().getName(), normalized)
                || contains(meeting.getBooking().getUser().getEmail(), normalized)
                || contains(meeting.getBooking().getTherapist().getUser().getName(), normalized)
                || contains(meeting.getBooking().getTherapist().getUser().getEmail(), normalized);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase().contains(query);
    }

    private LocalDateTime meetingStartTimeOrCreatedAt(VideoMeeting meeting) {
        if (meeting.getBooking().getAvailabilitySlot() != null
                && meeting.getBooking().getAvailabilitySlot().getStartTime() != null) {
            return meeting.getBooking().getAvailabilitySlot().getStartTime();
        }
        return meeting.getCreatedAt();
    }
}

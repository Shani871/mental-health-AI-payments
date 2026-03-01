package com.mentalhealth.app.video;

import com.mentalhealth.app.booking.Booking;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUserMeetings(UUID userId) {
        return videoMeetingRepository.findByBookingUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toMap).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTherapistMeetings(UUID therapistUserId) {
        return videoMeetingRepository.findByBookingTherapistUserIdOrderByCreatedAtDesc(therapistUserId)
                .stream().map(this::toMap).collect(Collectors.toList());
    }

    private Map<String, Object> toMap(VideoMeeting meeting) {
        return Map.of(
                "id", meeting.getId(),
                "bookingId", meeting.getBooking().getId(),
                "meetingId", meeting.getMeetingId(),
                "joinUrl", meeting.getJoinUrl(),
                "hostUrl", meeting.getHostUrl() == null ? "" : meeting.getHostUrl(),
                "provider", meeting.getProvider(),
                "sessionDuration", meeting.getSessionDuration(),
                "attendanceStatus", meeting.getAttendanceStatus(),
                "createdAt", meeting.getCreatedAt());
    }
}

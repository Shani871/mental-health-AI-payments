package com.mentalhealth.app.notification;

import com.mentalhealth.app.booking.Booking;
import com.mentalhealth.app.booking.BookingRepository;
import com.mentalhealth.app.booking.BookingStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Component
public class ReminderTask {

    private final BookingRepository bookingRepository;
    private final JavaMailSender mailSender;
    private final SmsService smsService;
    private final InAppNotificationService notificationService;

    public ReminderTask(BookingRepository bookingRepository,
            JavaMailSender mailSender,
            SmsService smsService,
            InAppNotificationService notificationService) {
        this.bookingRepository = bookingRepository;
        this.mailSender = mailSender;
        this.smsService = smsService;
        this.notificationService = notificationService;
    }

    // Run every minute
    @Scheduled(cron = "0 * * * * *")
    public void sendReminders() {
        sendWindowReminders(
                24,
                "SESSION_REMINDER_24H",
                "Reminder: Your session is in 24 hours",
                "This is a 24-hour reminder for your upcoming therapy session.");
        sendWindowReminders(
                1,
                "SESSION_REMINDER_1H",
                "Reminder: Your session starts in 1 hour",
                "This is a 1-hour reminder for your upcoming therapy session.");
    }

    private void sendWindowReminders(int hoursAhead, String type, String subject, String messagePrefix) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime reminderWindowStart = now.plusHours(hoursAhead).minusMinutes(1);
        LocalDateTime reminderWindowEnd = now.plusHours(hoursAhead).plusMinutes(1);

        List<Booking> upcomingBookings = bookingRepository.findByStatusAndAvailabilitySlot_StartTimeBetween(
                BookingStatus.CONFIRMED, reminderWindowStart, reminderWindowEnd);

        for (Booking booking : upcomingBookings) {
            if (booking.getUser() == null || booking.getTherapist() == null || booking.getTherapist().getUser() == null) {
                continue;
            }
            String meetingLink = booking.getMeetingLink() == null ? "" : booking.getMeetingLink();
            String userMessage = messagePrefix + "\nMeeting Link: " + meetingLink;

            if (!notificationService.existsForBooking(booking.getUser().getId(), type, booking.getId())) {
                notificationService.create(
                        booking.getUser(),
                        type,
                        userMessage,
                        Map.of("bookingId", booking.getId().toString(), "hoursAhead", String.valueOf(hoursAhead)));
                sendReminderEmail(booking.getUser().getEmail(), booking.getUser().getName(), subject, userMessage);
                smsService.sendSms(
                        booking.getUser().getPhone(),
                        "MindBridge reminder: session starts in about " + hoursAhead + " hour(s).");
            }

            String therapistMessage = messagePrefix + "\nClient: " + booking.getUser().getName()
                    + "\nMeeting Link: " + meetingLink;
            if (!notificationService.existsForBooking(booking.getTherapist().getUser().getId(), type, booking.getId())) {
                notificationService.create(
                        booking.getTherapist().getUser(),
                        type,
                        therapistMessage,
                        Map.of("bookingId", booking.getId().toString(), "hoursAhead", String.valueOf(hoursAhead)));
                sendReminderEmail(
                        booking.getTherapist().getUser().getEmail(),
                        booking.getTherapist().getUser().getName(),
                        subject,
                        therapistMessage);
            }
        }
    }

    private void sendReminderEmail(String to, String name, String subject, String content) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject(subject);
        message.setText("Hello " + name + ",\n\n" +
                content + "\n\n" +
                "Thank you.");
        mailSender.send(message);
    }
}

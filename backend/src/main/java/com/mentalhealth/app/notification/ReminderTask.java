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

@Component
public class ReminderTask {

    private final BookingRepository bookingRepository;
    private final JavaMailSender mailSender;
    private final SmsService smsService;

    public ReminderTask(BookingRepository bookingRepository, JavaMailSender mailSender, SmsService smsService) {
        this.bookingRepository = bookingRepository;
        this.mailSender = mailSender;
        this.smsService = smsService;
    }

    // Run every minute
    @Scheduled(cron = "0 * * * * *")
    public void sendReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime reminderWindowStart = now.plusMinutes(59);
        LocalDateTime reminderWindowEnd = now.plusMinutes(61);

        List<Booking> upcomingBookings = bookingRepository.findByStatusAndAvailabilitySlot_StartTimeBetween(
                BookingStatus.CONFIRMED, reminderWindowStart, reminderWindowEnd);

        for (Booking booking : upcomingBookings) {
            sendReminderEmail(booking.getUser().getEmail(), booking.getUser().getName(), booking);
            sendReminderEmail(booking.getTherapist().getUser().getEmail(), booking.getTherapist().getUser().getName(),
                    booking);
            smsService.sendSms(
                    booking.getUser().getPhone(),
                    "MindBridge reminder: your therapy session starts in about 1 hour.");
        }
    }

    private void sendReminderEmail(String to, String name, Booking booking) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Reminder: Your Session starts in 1 hour");
        message.setText("Hello " + name + ",\n\n" +
                "This is a reminder that your session is scheduled to start in about 1 hour.\n" +
                "Meeting Link: " + booking.getMeetingLink() + "\n\n" +
                "Thank you.");
        mailSender.send(message);
    }
}

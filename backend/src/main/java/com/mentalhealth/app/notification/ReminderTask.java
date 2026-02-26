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

    public ReminderTask(BookingRepository bookingRepository, JavaMailSender mailSender) {
        this.bookingRepository = bookingRepository;
        this.mailSender = mailSender;
    }

    // Run every minute
    @Scheduled(cron = "0 * * * * *")
    public void sendReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime reminderWindowStart = now.plusMinutes(14);
        LocalDateTime reminderWindowEnd = now.plusMinutes(16);

        List<Booking> upcomingBookings = bookingRepository.findByStatusAndAvailabilitySlot_StartTimeBetween(
                BookingStatus.CONFIRMED, reminderWindowStart, reminderWindowEnd);

        for (Booking booking : upcomingBookings) {
            sendReminderEmail(booking.getUser().getEmail(), booking.getUser().getName(), booking);
            sendReminderEmail(booking.getTherapist().getUser().getEmail(), booking.getTherapist().getUser().getName(),
                    booking);
        }
    }

    private void sendReminderEmail(String to, String name, Booking booking) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Reminder: Your Session starts in 15 minutes");
        message.setText("Hello " + name + ",\n\n" +
                "This is a reminder that your session is scheduled to start in 15 minutes.\n" +
                "Meeting Link: " + booking.getMeetingLink() + "\n\n" +
                "Thank you.");
        mailSender.send(message);
    }
}

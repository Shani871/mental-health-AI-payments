package com.mentalhealth.app.booking;

import com.mentalhealth.app.therapist.Therapist;
import com.mentalhealth.app.therapist.TherapistAvailability;
import com.mentalhealth.app.user.User;
import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "bookings")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "therapist_id", nullable = false)
    private Therapist therapist;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "slot_id", nullable = false)
    private TherapistAvailability availabilitySlot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingStatus status;

    private String paymentId;

    private String meetingLink;

    public Booking() {
    }

    public Booking(User user, Therapist therapist, TherapistAvailability availabilitySlot, BookingStatus status) {
        this.user = user;
        this.therapist = therapist;
        this.availabilitySlot = availabilitySlot;
        this.status = status;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Therapist getTherapist() {
        return therapist;
    }

    public void setTherapist(Therapist therapist) {
        this.therapist = therapist;
    }

    public TherapistAvailability getAvailabilitySlot() {
        return availabilitySlot;
    }

    public void setAvailabilitySlot(TherapistAvailability availabilitySlot) {
        this.availabilitySlot = availabilitySlot;
    }

    public BookingStatus getStatus() {
        return status;
    }

    public void setStatus(BookingStatus status) {
        this.status = status;
    }

    public String getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(String paymentId) {
        this.paymentId = paymentId;
    }

    public String getMeetingLink() {
        return meetingLink;
    }

    public void setMeetingLink(String meetingLink) {
        this.meetingLink = meetingLink;
    }
}

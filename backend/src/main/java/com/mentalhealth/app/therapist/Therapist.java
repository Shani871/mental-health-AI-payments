package com.mentalhealth.app.therapist;

import com.mentalhealth.app.user.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "therapists")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Therapist {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private String specialization;
    private String language;

    private Integer experienceYears;

    private BigDecimal hourlyRate;

    private Boolean verified = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TherapistApprovalStatus approvalStatus = TherapistApprovalStatus.PENDING;

    public Therapist() {
    }

    public Therapist(User user, String specialization, Integer experienceYears, BigDecimal hourlyRate) {
        this.user = user;
        this.specialization = specialization;
        this.experienceYears = experienceYears;
        this.hourlyRate = hourlyRate;
        this.verified = false;
        this.approvalStatus = TherapistApprovalStatus.PENDING;
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

    public String getSpecialization() {
        return specialization;
    }

    public void setSpecialization(String specialization) {
        this.specialization = specialization;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(Integer experienceYears) {
        this.experienceYears = experienceYears;
    }

    public BigDecimal getHourlyRate() {
        return hourlyRate;
    }

    public void setHourlyRate(BigDecimal hourlyRate) {
        this.hourlyRate = hourlyRate;
    }

    public Boolean getVerified() {
        return verified;
    }

    public void setVerified(Boolean verified) {
        this.verified = verified;
        if (Boolean.TRUE.equals(verified)) {
            this.approvalStatus = TherapistApprovalStatus.VERIFIED;
        } else if (this.approvalStatus == TherapistApprovalStatus.VERIFIED) {
            this.approvalStatus = TherapistApprovalStatus.PENDING;
        }
    }

    public TherapistApprovalStatus getApprovalStatus() {
        return approvalStatus;
    }

    public void setApprovalStatus(TherapistApprovalStatus approvalStatus) {
        this.approvalStatus = approvalStatus;
        this.verified = approvalStatus == TherapistApprovalStatus.VERIFIED;
    }
}

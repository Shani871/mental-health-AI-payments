package com.mentalhealth.app.therapist;

import com.mentalhealth.app.common.util.AttributeEncryptionConverter;
import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "therapist_profiles")
public class TherapistProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "therapist_id", nullable = false)
    private Therapist therapist;

    @Convert(converter = AttributeEncryptionConverter.class)
    @Column(columnDefinition = "TEXT")
    private String bio;

    private String profilePictureUrl;
    private String licenseDocumentUrl;
    private String idDocumentUrl;

    private Double rating = 0.0;

    public TherapistProfile() {
    }

    public TherapistProfile(Therapist therapist, String bio, String profilePictureUrl) {
        this.therapist = therapist;
        this.bio = bio;
        this.profilePictureUrl = profilePictureUrl;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Therapist getTherapist() {
        return therapist;
    }

    public void setTherapist(Therapist therapist) {
        this.therapist = therapist;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getProfilePictureUrl() {
        return profilePictureUrl;
    }

    public void setProfilePictureUrl(String profilePictureUrl) {
        this.profilePictureUrl = profilePictureUrl;
    }

    public String getLicenseDocumentUrl() {
        return licenseDocumentUrl;
    }

    public void setLicenseDocumentUrl(String licenseDocumentUrl) {
        this.licenseDocumentUrl = licenseDocumentUrl;
    }

    public String getIdDocumentUrl() {
        return idDocumentUrl;
    }

    public void setIdDocumentUrl(String idDocumentUrl) {
        this.idDocumentUrl = idDocumentUrl;
    }

    public Double getRating() {
        return rating;
    }

    public void setRating(Double rating) {
        this.rating = rating;
    }
}

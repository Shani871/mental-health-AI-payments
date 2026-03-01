package com.mentalhealth.app.ai;

import com.mentalhealth.app.user.User;
import com.mentalhealth.app.common.util.AttributeEncryptionConverter;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_assessments")
public class AiAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    private RiskLevel riskLevel;

    private Boolean aiDisclaimerAccepted = false;

    private Integer score;

    @Column(columnDefinition = "TEXT")
    private String summary;

    private Integer phq9Score;

    private Integer gad7Score;

    private String assessmentTool = "COMBINED";

    @Convert(converter = AttributeEncryptionConverter.class)
    @Column(columnDefinition = "TEXT")
    private String responsePayload;

    private Boolean emergencyAlerted = false;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private Boolean completed = false;

    public AiAssessment() {
    }

    public AiAssessment(User user) {
        this.user = user;
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

    public RiskLevel getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(RiskLevel riskLevel) {
        this.riskLevel = riskLevel;
    }

    public Boolean getAiDisclaimerAccepted() {
        return aiDisclaimerAccepted;
    }

    public void setAiDisclaimerAccepted(Boolean aiDisclaimerAccepted) {
        this.aiDisclaimerAccepted = aiDisclaimerAccepted;
    }

    public Integer getScore() {
        return score;
    }

    public void setScore(Integer score) {
        this.score = score;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Boolean getCompleted() {
        return completed;
    }

    public void setCompleted(Boolean completed) {
        this.completed = completed;
    }

    public Integer getPhq9Score() {
        return phq9Score;
    }

    public void setPhq9Score(Integer phq9Score) {
        this.phq9Score = phq9Score;
    }

    public Integer getGad7Score() {
        return gad7Score;
    }

    public void setGad7Score(Integer gad7Score) {
        this.gad7Score = gad7Score;
    }

    public String getAssessmentTool() {
        return assessmentTool;
    }

    public void setAssessmentTool(String assessmentTool) {
        this.assessmentTool = assessmentTool;
    }

    public String getResponsePayload() {
        return responsePayload;
    }

    public void setResponsePayload(String responsePayload) {
        this.responsePayload = responsePayload;
    }

    public Boolean getEmergencyAlerted() {
        return emergencyAlerted;
    }

    public void setEmergencyAlerted(Boolean emergencyAlerted) {
        this.emergencyAlerted = emergencyAlerted;
    }
}

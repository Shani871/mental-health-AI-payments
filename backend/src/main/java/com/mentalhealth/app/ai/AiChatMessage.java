package com.mentalhealth.app.ai;

import com.mentalhealth.app.common.util.AttributeEncryptionConverter;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_chat_messages")
public class AiChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assessment_id", nullable = false)
    private AiAssessment assessment;

    @Column(nullable = false)
    private String role; // USER or ASSISTANT

    @Convert(converter = AttributeEncryptionConverter.class)
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    public AiChatMessage() {
    }

    public AiChatMessage(AiAssessment assessment, String role, String content) {
        this.assessment = assessment;
        this.role = role;
        this.content = content;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public AiAssessment getAssessment() {
        return assessment;
    }

    public void setAssessment(AiAssessment assessment) {
        this.assessment = assessment;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}

package com.mentalhealth.app.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiService {

    private final AiAssessmentRepository assessmentRepository;
    private final AiChatMessageRepository chatMessageRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.openai.apiKey}")
    private String apiKey;

    @Value("${ai.openai.model}")
    private String model;

    private static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";

    public AiService(AiAssessmentRepository assessmentRepository,
            AiChatMessageRepository chatMessageRepository,
            RestTemplate restTemplate) {
        this.assessmentRepository = assessmentRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.restTemplate = restTemplate;
    }

    @Transactional
    public String processUserMessage(UUID assessmentId, String userMessageContent) {
        AiAssessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));

        if (Boolean.TRUE.equals(assessment.getCompleted())) {
            throw new RuntimeException("Assessment is already completed");
        }

        // 1. Save User Message
        AiChatMessage userMessage = new AiChatMessage(assessment, "user", userMessageContent);
        chatMessageRepository.save(userMessage);

        // 2. Check for Emergency Keywords in User Message
        if (isEmergencyMessage(userMessageContent)) {
            assessment.setRiskLevel(RiskLevel.EMERGENCY);
            assessmentRepository.save(assessment);
            return "IMMEDIATE ACTION REQUIRED: If you are in immediate danger or feeling suicidal, please contact emergency services or a crisis helpline immediately. (e.g., 988 in US, 112 in EU, 911 in US/Canada). Our AI is not equipped for crisis intervention.";
        }

        // 3. Prepare OpenAI Request with History and Structured Guidelines
        List<AiChatMessage> history = chatMessageRepository.findAllByAssessmentIdOrderByTimestampAsc(assessmentId);

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content",
                "You are a mental health triage assistant. Your goal is to guide the user through a preliminary assessment using structured screening questions similar to PHQ-9 (Depression) and GAD-7 (Anxiety).\n"
                        +
                        "RULES:\n" +
                        "1. DO NOT DIAGNOSE. Use phrases like 'Based on your responses, it may be beneficial to speak with a licensed therapist'.\n"
                        +
                        "2. Ask ONE question at a time.\n" +
                        "3. If the user mentions self-harm or immediate danger, IMMEDIATELY stop and provide emergency helpline numbers.\n"
                        +
                        "4. Be empathetic but professional.\n" +
                        "5. Focus on identifying risk levels: Low, Moderate, High."));

        for (AiChatMessage msg : history) {
            messages.add(Map.of("role", msg.getRole(), "content", msg.getContent()));
        }

        String aiResponseContent = callOpenAi(messages);

        // 4. Check AI response for Risk classification (internal logic or score parsing
        // could go here)

        // 5. Save AI Message
        AiChatMessage aiMessage = new AiChatMessage(assessment, "assistant", aiResponseContent);
        chatMessageRepository.save(aiMessage);

        return aiResponseContent;
    }

    private boolean isEmergencyMessage(String message) {
        String lower = message.toLowerCase();
        return lower.contains("suicide") || lower.contains("kill myself") || lower.contains("hurt myself")
                || lower.contains("end my life") || lower.contains("self-harm");
    }

    @Transactional
    public void finalizeAssessment(UUID assessmentId) {
        AiAssessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));

        List<AiChatMessage> history = chatMessageRepository.findAllByAssessmentIdOrderByTimestampAsc(assessmentId);

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content",
                "Based on the conversation history provided, generate a mental health assessment. " +
                        "Provide a numeric score (0-100), a risk level (LOW, MODERATE, HIGH), and a brief clinical summary for a therapist. "
                        +
                        "Format your response exactly as: 'Score: [number] | Risk: [LEVEL] | Summary: [text]'"));

        String historyText = history.stream()
                .map(m -> m.getRole() + ": " + m.getContent())
                .collect(Collectors.joining("\n"));

        messages.add(Map.of("role", "user", "content", "Analyze this conversation:\n" + historyText));

        String analysis = callOpenAi(messages);

        // Enhanced parsing of "Score: X | Risk: [LOW/MODERATE/HIGH] | Summary: Y"
        try {
            String[] parts = analysis.split("\\|");
            int score = 0;
            RiskLevel risk = RiskLevel.LOW;
            String summary = analysis;

            for (String part : parts) {
                if (part.toLowerCase().contains("score:")) {
                    score = Integer.parseInt(part.replaceAll("[^0-9]", ""));
                } else if (part.toLowerCase().contains("risk:")) {
                    String rStr = part.split(":")[1].trim().toUpperCase();
                    risk = RiskLevel.valueOf(rStr);
                } else if (part.toLowerCase().contains("summary:")) {
                    summary = part.split(":")[1].trim();
                }
            }

            assessment.setScore(score);
            assessment.setRiskLevel(risk);
            assessment.setSummary(summary);
            assessment.setCompleted(true);
            assessmentRepository.save(assessment);
        } catch (Exception e) {
            assessment.setSummary("Analysis fallback: " + analysis);
            assessment.setRiskLevel(RiskLevel.MODERATE); // Default for failed parsing
            assessment.setCompleted(true);
            assessmentRepository.save(assessment);
        }
    }

    private String callOpenAi(List<Map<String, String>> messages) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(OPENAI_URL, entity, Map.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) response.getBody().get("choices");
                Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                return (String) message.get("content");
            }
        } catch (Exception e) {
            return "AI Service is currently unavailable. Please try again later.";
        }
        return "Sorry, I couldn't process your request.";
    }
}

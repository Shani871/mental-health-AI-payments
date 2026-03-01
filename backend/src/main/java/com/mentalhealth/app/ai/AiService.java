package com.mentalhealth.app.ai;

import com.mentalhealth.app.audit.AuditService;
import com.mentalhealth.app.booking.Booking;
import com.mentalhealth.app.booking.BookingRepository;
import com.mentalhealth.app.booking.BookingStatus;
import com.mentalhealth.app.user.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiService {

    private final AiAssessmentRepository assessmentRepository;
    private final AiChatMessageRepository chatMessageRepository;
    private final MoodCheckinRepository moodCheckinRepository;
    private final BookingRepository bookingRepository;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${ai.openai.apiKey}")
    private String apiKey;

    @Value("${ai.openai.model}")
    private String model;

    private static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";
    private static final List<Map<String, String>> PHQ9_QUESTIONS = List.of(
            Map.of("key", "phq1", "text", "Little interest or pleasure in doing things"),
            Map.of("key", "phq2", "text", "Feeling down, depressed, or hopeless"),
            Map.of("key", "phq3", "text", "Trouble falling or staying asleep, or sleeping too much"),
            Map.of("key", "phq4", "text", "Feeling tired or having little energy"),
            Map.of("key", "phq5", "text", "Poor appetite or overeating"),
            Map.of("key", "phq6", "text", "Feeling bad about yourself or that you are a failure"),
            Map.of("key", "phq7", "text", "Trouble concentrating on things"),
            Map.of("key", "phq8", "text", "Moving/speaking slowly or being restless"),
            Map.of("key", "phq9", "text", "Thoughts that you would be better off dead or self-harm"));
    private static final List<Map<String, String>> GAD7_QUESTIONS = List.of(
            Map.of("key", "gad1", "text", "Feeling nervous, anxious, or on edge"),
            Map.of("key", "gad2", "text", "Not being able to stop or control worrying"),
            Map.of("key", "gad3", "text", "Worrying too much about different things"),
            Map.of("key", "gad4", "text", "Trouble relaxing"),
            Map.of("key", "gad5", "text", "Being so restless that it is hard to sit still"),
            Map.of("key", "gad6", "text", "Becoming easily annoyed or irritable"),
            Map.of("key", "gad7", "text", "Feeling afraid as if something awful might happen"));

    public AiService(AiAssessmentRepository assessmentRepository,
            AiChatMessageRepository chatMessageRepository,
            MoodCheckinRepository moodCheckinRepository,
            BookingRepository bookingRepository,
            AuditService auditService,
            ObjectMapper objectMapper,
            RestTemplate restTemplate) {
        this.assessmentRepository = assessmentRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.moodCheckinRepository = moodCheckinRepository;
        this.bookingRepository = bookingRepository;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
    }

    @Transactional(readOnly = true)
    public List<Map<String, String>> getStructuredQuestions(String tool) {
        String normalized = normalizeTool(tool);
        if ("PHQ9".equals(normalized)) {
            return PHQ9_QUESTIONS;
        }
        if ("GAD7".equals(normalized)) {
            return GAD7_QUESTIONS;
        }
        List<Map<String, String>> combined = new ArrayList<>();
        combined.addAll(PHQ9_QUESTIONS);
        combined.addAll(GAD7_QUESTIONS);
        return combined;
    }

    @Transactional
    public AiAssessment submitStructuredAssessment(UUID assessmentId, Map<String, Integer> responses, String note) {
        AiAssessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));

        if (!Boolean.TRUE.equals(assessment.getAiDisclaimerAccepted())) {
            throw new RuntimeException("Consent is required before assessment submission.");
        }
        if (Boolean.TRUE.equals(assessment.getCompleted())) {
            throw new RuntimeException("Assessment is already completed.");
        }

        String tool = normalizeTool(assessment.getAssessmentTool());
        int phq9Score = sumResponses(responses, PHQ9_QUESTIONS, "PHQ-9");
        int gad7Score = sumResponses(responses, GAD7_QUESTIONS, "GAD-7");

        if ("PHQ9".equals(tool)) {
            gad7Score = 0;
        } else if ("GAD7".equals(tool)) {
            phq9Score = 0;
        }

        int riskInputScore = "GAD7".equals(tool) ? gad7Score : Math.max(phq9Score, gad7Score);
        RiskLevel risk = classifyRiskFromPhqLikeScore(riskInputScore);

        assessment.setAssessmentTool(tool);
        assessment.setPhq9Score(phq9Score);
        assessment.setGad7Score(gad7Score);
        assessment.setScore(riskInputScore);
        assessment.setRiskLevel(risk);
        assessment.setSummary(buildStructuredSummary(tool, phq9Score, gad7Score, risk, note));
        assessment.setResponsePayload(toJsonSafe(responses));
        assessment.setCompleted(true);

        if (risk == RiskLevel.HIGH || risk == RiskLevel.EMERGENCY) {
            assessment.setEmergencyAlerted(true);
            auditService.log("AI_HIGH_RISK_ALERT", "SYSTEM",
                    "Assessment " + assessment.getId() + " classified as " + risk);
        }

        return assessmentRepository.save(assessment);
    }

    @Transactional
    public MoodCheckin recordMoodCheckin(User user, int moodScore, String note) {
        if (moodScore < 1 || moodScore > 10) {
            throw new RuntimeException("Mood score must be between 1 and 10.");
        }
        MoodCheckin checkin = new MoodCheckin();
        checkin.setUser(user);
        checkin.setMoodScore(moodScore);
        checkin.setNote(note);
        return moodCheckinRepository.save(checkin);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMoodHistory(UUID userId, int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(Math.max(days, 1));
        return moodCheckinRepository.findByUserIdAndCreatedAtAfterOrderByCreatedAtAsc(userId, since)
                .stream()
                .map(item -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("id", item.getId());
                    row.put("score", item.getMoodScore());
                    row.put("note", item.getNote());
                    row.put("createdAt", item.getCreatedAt());
                    return row;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getMoodTrend(UUID userId, int days) {
        List<MoodCheckin> checkins = moodCheckinRepository.findByUserIdAndCreatedAtAfterOrderByCreatedAtAsc(
                userId, LocalDateTime.now().minusDays(Math.max(days, 1)));
        double avg = checkins.stream().mapToInt(MoodCheckin::getMoodScore).average().orElse(0.0);
        int min = checkins.stream().mapToInt(MoodCheckin::getMoodScore).min().orElse(0);
        int max = checkins.stream().mapToInt(MoodCheckin::getMoodScore).max().orElse(0);

        Map<String, Object> result = new HashMap<>();
        result.put("averageMood", Math.round(avg * 100.0) / 100.0);
        result.put("minMood", min);
        result.put("maxMood", max);
        result.put("entries", checkins.size());
        result.put("history", getMoodHistory(userId, days));
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTherapistSummaries(UUID therapistUserId) {
        List<BookingStatus> visibleStatuses = List.of(
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.COMPLETED,
                BookingStatus.NO_SHOW);
        List<Booking> bookings = bookingRepository.findByTherapist_User_IdAndStatusIn(therapistUserId, visibleStatuses);

        Set<UUID> userIds = bookings.stream()
                .map(booking -> booking.getUser().getId())
                .collect(Collectors.toSet());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (UUID userId : userIds) {
            Optional<AiAssessment> latest = assessmentRepository.findTopByUserIdAndCompletedTrueOrderByCreatedAtDesc(userId);
            if (latest.isEmpty()) {
                continue;
            }
            AiAssessment assessment = latest.get();
            Map<String, Object> row = new HashMap<>();
            row.put("userId", userId);
            row.put("userName", assessment.getUser().getName());
            row.put("riskLevel", assessment.getRiskLevel());
            row.put("score", assessment.getScore());
            row.put("phq9Score", assessment.getPhq9Score());
            row.put("gad7Score", assessment.getGad7Score());
            row.put("summary", assessment.getSummary());
            row.put("createdAt", assessment.getCreatedAt());
            rows.add(row);
        }

        rows.sort((a, b) -> ((LocalDateTime) b.get("createdAt")).compareTo((LocalDateTime) a.get("createdAt")));
        return rows;
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

    private int sumResponses(Map<String, Integer> responses, List<Map<String, String>> questions, String formName) {
        int total = 0;
        for (Map<String, String> question : questions) {
            Integer value = responses.get(question.get("key"));
            if (value == null) {
                continue;
            }
            if (value < 0 || value > 3) {
                throw new RuntimeException(formName + " responses must be between 0 and 3.");
            }
            total += value;
        }
        return total;
    }

    private RiskLevel classifyRiskFromPhqLikeScore(int score) {
        if (score >= 20) {
            return RiskLevel.EMERGENCY;
        }
        if (score >= 15) {
            return RiskLevel.HIGH;
        }
        if (score >= 5) {
            return RiskLevel.MODERATE;
        }
        return RiskLevel.LOW;
    }

    private String buildStructuredSummary(String tool, int phq9Score, int gad7Score, RiskLevel risk, String note) {
        StringBuilder sb = new StringBuilder();
        sb.append("Structured ").append(tool).append(" assessment completed. ");
        sb.append("PHQ-9: ").append(phq9Score).append(", GAD-7: ").append(gad7Score).append(". ");
        sb.append("Risk level: ").append(risk).append(". ");
        if (note != null && !note.isBlank()) {
            sb.append("User note: ").append(note.trim());
        } else {
            sb.append("Recommendation: follow up with a licensed therapist.");
        }
        return sb.toString();
    }

    private String normalizeTool(String tool) {
        if (tool == null || tool.isBlank()) {
            return "COMBINED";
        }
        String normalized = tool.trim().toUpperCase();
        if (!Set.of("PHQ9", "GAD7", "COMBINED").contains(normalized)) {
            throw new RuntimeException("Unsupported assessment tool. Use PHQ9, GAD7, or COMBINED.");
        }
        return normalized;
    }

    private String toJsonSafe(Object data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}

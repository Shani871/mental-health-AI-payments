package com.mentalhealth.app.ai;

import com.mentalhealth.app.user.User;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ai")
@Validated
public class AiController {

    private final AiService aiService;
    private final AiAssessmentRepository assessmentRepository;

    public AiController(AiService aiService,
            AiAssessmentRepository assessmentRepository) {
        this.aiService = aiService;
        this.assessmentRepository = assessmentRepository;
    }

    @PostMapping("/start")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> startAssessment() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        AiAssessment assessment = new AiAssessment(user);
        return ResponseEntity.ok(toAssessmentMap(assessmentRepository.save(assessment)));
    }

    @PostMapping("/accept-disclaimer/{id}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> acceptDisclaimer(@PathVariable UUID id) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        AiAssessment assessment = assessmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        ensureAssessmentOwnership(assessment, user);
        assessment.setAiDisclaimerAccepted(true);
        return ResponseEntity.ok(toAssessmentMap(assessmentRepository.save(assessment)));
    }

    @PostMapping("/chat/{id}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<Map<String, String>> chat(@PathVariable UUID id, @RequestBody Map<String, String> request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        AiAssessment assessment = assessmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        ensureAssessmentOwnership(assessment, user);

        if (!Boolean.TRUE.equals(assessment.getAiDisclaimerAccepted())) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "AI Disclaimer must be accepted before using the chat."));
        }

        String userMessage = request.get("message");
        if (userMessage == null || userMessage.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Message cannot be empty"));
        }

        String response = aiService.processUserMessage(id, userMessage);
        return ResponseEntity.ok(Map.of("response", response));
    }

    @PostMapping("/complete/{id}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> completeAssessment(@PathVariable UUID id) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        AiAssessment assessment = assessmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        ensureAssessmentOwnership(assessment, user);
        aiService.finalizeAssessment(id);
        return ResponseEntity.ok("Assessment finalized.");
    }

    @PostMapping("/structured/start")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> startStructuredAssessment(
            @RequestParam(defaultValue = "COMBINED") String tool) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        AiAssessment assessment = new AiAssessment(user);
        assessment.setAssessmentTool(tool.toUpperCase());
        assessment.setAiDisclaimerAccepted(false);
        assessment.setCompleted(false);
        return ResponseEntity.ok(toAssessmentMap(assessmentRepository.save(assessment)));
    }

    @GetMapping("/structured/questions")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<List<Map<String, String>>> getStructuredQuestions(
            @RequestParam(defaultValue = "COMBINED") String tool) {
        return ResponseEntity.ok(aiService.getStructuredQuestions(tool));
    }

    @PostMapping("/structured/{id}/submit")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> submitStructuredAssessment(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        AiAssessment assessment = assessmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        ensureAssessmentOwnership(assessment, user);

        Object rawResponses = request.get("responses");
        if (!(rawResponses instanceof Map<?, ?> responseMap)) {
            throw new RuntimeException("responses payload is required.");
        }
        Map<String, Integer> responses = responseMap.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(
                        entry -> String.valueOf(entry.getKey()),
                        entry -> Integer.parseInt(String.valueOf(entry.getValue()))));
        String note = request.get("note") == null ? null : String.valueOf(request.get("note"));
        return ResponseEntity.ok(toAssessmentMap(aiService.submitStructuredAssessment(id, responses, note)));
    }

    @PostMapping("/mood/checkin")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> checkinMood(
            @RequestParam @Min(1) @Max(10) int score,
            @RequestParam(required = false) String note) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        MoodCheckin checkin = aiService.recordMoodCheckin(user, score, note);
        return ResponseEntity.ok(Map.of(
                "id", checkin.getId(),
                "score", checkin.getMoodScore(),
                "note", checkin.getNote(),
                "createdAt", checkin.getCreatedAt()));
    }

    @GetMapping("/mood/history")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getMoodHistory(@RequestParam(defaultValue = "30") int days) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(aiService.getMoodHistory(user.getId(), days));
    }

    @GetMapping("/mood/trend")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getMoodTrend(@RequestParam(defaultValue = "30") int days) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(aiService.getMoodTrend(user.getId(), days));
    }

    @GetMapping("/care-insights")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getCareInsights() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(aiService.getUserCareInsights(user.getId()));
    }

    @GetMapping("/therapist/summaries")
    @PreAuthorize("hasRole('THERAPIST')")
    public ResponseEntity<?> getTherapistSummaries() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(aiService.getTherapistSummaries(user.getId()));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getMyAssessments() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(assessmentRepository.findAllByUserId(user.getId()).stream()
                .map(this::toAssessmentMap)
                .collect(Collectors.toList()));
    }

    private void ensureAssessmentOwnership(AiAssessment assessment, User user) {
        if (!assessment.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("You can only access your own assessments.");
        }
    }

    private Map<String, Object> toAssessmentMap(AiAssessment assessment) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", assessment.getId());
        payload.put("riskLevel", assessment.getRiskLevel());
        payload.put("aiDisclaimerAccepted", assessment.getAiDisclaimerAccepted());
        payload.put("score", assessment.getScore());
        payload.put("summary", assessment.getSummary());
        payload.put("phq9Score", assessment.getPhq9Score());
        payload.put("gad7Score", assessment.getGad7Score());
        payload.put("assessmentTool", assessment.getAssessmentTool());
        payload.put("responsePayload", assessment.getResponsePayload());
        payload.put("emergencyAlerted", assessment.getEmergencyAlerted());
        payload.put("createdAt", assessment.getCreatedAt());
        payload.put("completed", assessment.getCompleted());
        payload.put("userId", assessment.getUser() == null ? null : assessment.getUser().getId());
        return payload;
    }
}

package com.mentalhealth.app.ai;

import com.mentalhealth.app.user.User;
import com.mentalhealth.app.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiService aiService;
    private final AiAssessmentRepository assessmentRepository;
    private final UserRepository userRepository;

    public AiController(AiService aiService,
            AiAssessmentRepository assessmentRepository,
            UserRepository userRepository) {
        this.aiService = aiService;
        this.assessmentRepository = assessmentRepository;
        this.userRepository = userRepository;
    }

    @PostMapping("/start")
    public ResponseEntity<AiAssessment> startAssessment() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        AiAssessment assessment = new AiAssessment(user);
        return ResponseEntity.ok(assessmentRepository.save(assessment));
    }

    @PostMapping("/accept-disclaimer/{id}")
    public ResponseEntity<AiAssessment> acceptDisclaimer(@PathVariable UUID id) {
        AiAssessment assessment = assessmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        assessment.setAiDisclaimerAccepted(true);
        return ResponseEntity.ok(assessmentRepository.save(assessment));
    }

    @PostMapping("/chat/{id}")
    public ResponseEntity<Map<String, String>> chat(@PathVariable UUID id, @RequestBody Map<String, String> request) {
        AiAssessment assessment = assessmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));

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
    public ResponseEntity<?> completeAssessment(@PathVariable UUID id) {
        aiService.finalizeAssessment(id);
        return ResponseEntity.ok("Assessment finalized.");
    }

    @GetMapping("/my")
    public ResponseEntity<List<AiAssessment>> getMyAssessments() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(assessmentRepository.findAllByUserId(user.getId()));
    }
}

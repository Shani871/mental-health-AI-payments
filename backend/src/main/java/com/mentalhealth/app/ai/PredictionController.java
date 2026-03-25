package com.mentalhealth.app.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api")
public class PredictionController {

    private static final Duration SCRIPT_TIMEOUT = Duration.ofSeconds(120);
    private final ObjectMapper objectMapper;

    public PredictionController(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @GetMapping("/predict/options")
    public ResponseEntity<?> options() {
        try {
            Map<String, Object> result = executePredictScript("--options");
            if (result.containsKey("error")) {
                return ResponseEntity.badRequest().body(result);
            }
            return ResponseEntity.ok(result);
        } catch (Exception ex) {
            String details = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to load prediction options", "details", details));
        }
    }

    @PostMapping("/predict")
    public ResponseEntity<?> predict(@RequestBody Map<String, Object> payload) {
        try {
            String inputJson = objectMapper.writeValueAsString(payload);
            Map<String, Object> result = executePredictScript(inputJson);
            if (result.containsKey("error")) {
                return ResponseEntity.badRequest().body(result);
            }

            return ResponseEntity.ok(result);
        } catch (Exception ex) {
            String details = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to run prediction model", "details", details));
        }
    }

    private Path resolveScriptPath() {
        List<Path> candidates = List.of(
                Path.of("..", "api", "predict.py"),
                Path.of("api", "predict.py"));
        return candidates.stream()
                .filter(Files::exists)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Prediction script not found."));
    }

    private Map<String, Object> executePredictScript(String argument) throws Exception {
        Path scriptPath = resolveScriptPath();
        String pythonExecutable = resolvePythonExecutable();

        ProcessBuilder processBuilder = new ProcessBuilder(
                pythonExecutable,
                scriptPath.toAbsolutePath().toString(),
                argument);
        processBuilder.redirectErrorStream(true);

        Process process = processBuilder.start();
        boolean exited = process.waitFor(SCRIPT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
        if (!exited) {
            process.destroyForcibly();
            return Map.of("error", "Prediction timed out. Please try again.");
        }

        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        String jsonLine = extractJsonLine(output);
        if (jsonLine == null || jsonLine.isBlank()) {
            return Map.of("error", "Prediction service returned an empty response.");
        }

        return objectMapper.readValue(jsonLine, new TypeReference<>() {
        });
    }

    private String resolvePythonExecutable() {
        String explicit = System.getenv("PYTHON_EXECUTABLE");
        if (explicit != null && !explicit.isBlank()) {
            return explicit;
        }

        boolean windows = System.getProperty("os.name")
                .toLowerCase(Locale.ROOT)
                .contains("win");

        List<Path> candidates = windows
                ? List.of(Path.of("..", "venv", "Scripts", "python.exe"), Path.of("venv", "Scripts", "python.exe"))
                : List.of(Path.of("..", "venv", "bin", "python"), Path.of("venv", "bin", "python"));

        return candidates.stream()
                .filter(Files::exists)
                .map(Path::toAbsolutePath)
                .map(Path::toString)
                .findFirst()
                .orElse(windows ? "python" : "python3");
    }

    private String extractJsonLine(String output) {
        if (output == null || output.isBlank()) {
            return null;
        }
        String[] lines = output.split("\\R");
        for (int i = lines.length - 1; i >= 0; i--) {
            String line = lines[i].trim();
            if (line.startsWith("{") && line.endsWith("}")) {
                return line;
            }
        }
        return null;
    }
}

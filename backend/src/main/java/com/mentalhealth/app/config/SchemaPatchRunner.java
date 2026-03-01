package com.mentalhealth.app.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class SchemaPatchRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaPatchRunner.class);
    private final JdbcTemplate jdbcTemplate;

    public SchemaPatchRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        try {
            // Backward-compatible patch for existing databases created before approval_status.
            jdbcTemplate.execute(
                    "ALTER TABLE therapists ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) DEFAULT 'PENDING'");
            jdbcTemplate.execute(
                    "UPDATE therapists SET approval_status = CASE WHEN verified = true THEN 'VERIFIED' ELSE 'PENDING' END WHERE approval_status IS NULL");
            jdbcTemplate.execute(
                    "ALTER TABLE therapists ALTER COLUMN approval_status SET NOT NULL");
        } catch (Exception ex) {
            // Non-blocking because environments may use different DB engines/permissions.
            log.warn("Schema patch for therapists.approval_status was not applied: {}", ex.getMessage());
        }
    }
}

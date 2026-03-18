package com.mentalhealth.app.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

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
            if (!columnExists("therapists", "approval_status")) {
                jdbcTemplate.execute("ALTER TABLE therapists ADD COLUMN approval_status VARCHAR(32) DEFAULT 'PENDING'");
            }

            jdbcTemplate.execute(
                    "UPDATE therapists SET approval_status = CASE WHEN verified = true THEN 'VERIFIED' ELSE 'PENDING' END WHERE approval_status IS NULL");

            if (isMySql()) {
                jdbcTemplate.execute(
                        "ALTER TABLE therapists MODIFY COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'");
            } else {
                jdbcTemplate.execute(
                        "ALTER TABLE therapists ALTER COLUMN approval_status SET NOT NULL");
            }
        } catch (Exception ex) {
            // Non-blocking because environments may use different DB engines/permissions.
            log.warn("Schema patch for therapists.approval_status was not applied: {}", ex.getMessage());
        }
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = ?",
                Integer.class, tableName, columnName);
        return count != null && count > 0;
    }

    private boolean isMySql() {
        try {
            DataSource dataSource = jdbcTemplate.getDataSource();
            if (dataSource == null) {
                return false;
            }
            try (Connection connection = dataSource.getConnection()) {
                String dbName = connection.getMetaData().getDatabaseProductName();
                return dbName != null && dbName.toLowerCase().contains("mysql");
            }
        } catch (Exception ex) {
            return false;
        }
    }
}

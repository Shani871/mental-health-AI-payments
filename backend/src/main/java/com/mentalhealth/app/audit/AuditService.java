package com.mentalhealth.app.audit;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Async // Run in background to not block the main process
    public void log(String action, String actor, String details) {
        AuditLog log = new AuditLog(action, actor, details);
        auditLogRepository.save(log);
    }
}

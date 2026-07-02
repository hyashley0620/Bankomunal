package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data @Builder
public class AuditLogResponse {
    private Long id;
    private AuditUserRef usuario;
    private String eventType;
    private String objectType;
    private String ipAddress;
    private LocalDateTime createdAt;
    private String userEmail;
    private String details;

    @Data @AllArgsConstructor
    public static class AuditUserRef {
        private Long id;
        private String email;
    }
}

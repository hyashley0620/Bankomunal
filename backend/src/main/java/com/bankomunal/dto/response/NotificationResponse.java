package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class NotificationResponse {
    private Long id;
    private String titulo;
    private String mensaje;
    private boolean leida;
    private LocalDateTime fecha;
}

package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class SupportTicketResponse {
    private Long id;
    private LocalDateTime fechaCreacion;
    private String asunto;
    private String categoria;
    private String estado;
}

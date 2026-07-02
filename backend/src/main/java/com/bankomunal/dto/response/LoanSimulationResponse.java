package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class LoanSimulationResponse {
    private BigDecimal cuotaMensual;
    private BigDecimal totalPagar;
    private BigDecimal totalIntereses;
}

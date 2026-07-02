package com.bankomunal.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class LoanRequest {
    @NotNull
    @Positive
    private BigDecimal montoSolicitado;
    @NotNull
    @Min(1)
    @Max(120)
    private int plazoMeses;
    private String motivo;
}

package com.bankomunal.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class TransferRequest {
    @NotBlank
    private String origen;
    @NotBlank
    private String destino;
    @NotNull
    @Positive
    private BigDecimal monto;
    private String descripcion;
}

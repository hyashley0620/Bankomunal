package com.bankomunal.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CambiarPasswordRequest {
    @NotBlank
    private String passwordActual;
    @NotBlank
    @Size(min = 6)
    private String passwordNueva;
}

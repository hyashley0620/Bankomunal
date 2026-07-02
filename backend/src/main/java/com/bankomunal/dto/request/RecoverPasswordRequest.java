package com.bankomunal.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class RecoverPasswordRequest {
    @NotBlank
    @Email
    private String email;
}

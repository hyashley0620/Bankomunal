package com.bankomunal.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank
    @Email
    private String email;
    @NotBlank
    private String password;
    /** IP del cliente — inyectada por el controller desde HttpServletRequest */
    private String ip;
}

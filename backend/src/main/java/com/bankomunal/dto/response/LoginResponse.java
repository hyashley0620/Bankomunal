package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private Long id;
    private String nombre;
    private String email;
    private String rol;
    private String genero;
    private String cuenta;
    private String iniciales;
    private BigDecimal saldoTotal;
    private boolean mfaRequired;
    private String fotoUrl;
    private String createdAt;
    private boolean mfaEnabled;
}

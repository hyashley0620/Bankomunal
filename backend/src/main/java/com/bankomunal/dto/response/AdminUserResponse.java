package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class AdminUserResponse {
    private Long id;
    private String nombre;
    private String apellido;
    private String email;
    private String cedula;
    private String estado;
    private String rol;
}

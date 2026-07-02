package com.bankomunal.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
public class FrequentContactResponse {
    private Long id;
    private String nombre;
    private String email;
    private String cuentaNumero;
    private LocalDateTime createdAt;
}

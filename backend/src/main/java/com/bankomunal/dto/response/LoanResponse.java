package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class LoanResponse {
    private Long id;
    private String estado;
    private BigDecimal montoSolicitado;
    private int plazoMeses;
    private BigDecimal cuotaMensual;
    private LocalDateTime fechaSolicitud;
    private BigDecimal saldoPendiente;
    private int cuotasPagadas;
}

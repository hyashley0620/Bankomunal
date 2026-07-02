package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class AdminLoanResponse {
    private Long id;
    private String loanCode;
    private String solicitante;
    private String emailSolicitante;
    private BigDecimal montoSolicitado;
    private int plazoMeses;
    private BigDecimal cuotaMensual;
    private String estado;
    private LocalDateTime fechaSolicitud;
}

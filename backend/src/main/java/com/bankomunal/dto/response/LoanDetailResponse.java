package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class LoanDetailResponse {
    private Long id;
    private String loanCode;
    private String estado;
    private BigDecimal montoSolicitado;
    private BigDecimal principal;
    private BigDecimal cuotaMensual;
    private int plazoMeses;
    private BigDecimal tasaInteresMensual;
    private LocalDateTime fechaSolicitud;
    private LocalDateTime fechaDesembolso;
    private BigDecimal totalPagar;
    private BigDecimal totalIntereses;
    private BigDecimal saldoPendiente;
    private BigDecimal montoPagado;
    private int cuotasPagadas;
    private int cuotasPendientes;
    private int porcentajePagado;
    private LocalDate proximoVencimiento;
    private List<AmortizacionCuota> amortizacion;
}

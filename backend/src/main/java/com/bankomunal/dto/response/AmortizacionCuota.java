package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class AmortizacionCuota {
    private int numeroCuota;
    private LocalDate vencimiento;
    private BigDecimal capital;
    private BigDecimal interes;
    private BigDecimal totalCuota;
    private BigDecimal saldoRestante;
    private String estado;
    private LocalDate fechaPago;
}

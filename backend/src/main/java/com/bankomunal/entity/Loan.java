package com.bankomunal.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "loans")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class Loan {

    public enum LoanStatus {
        pending, approved, active, paid, rejected, defaulted
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "loan_code", length = 80)
    private String loanCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "borrower_user_id", nullable = false)
    private User borrowerUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private Group group;

    @Column(name = "monto_solicitado", nullable = false, precision = 18, scale = 2)
    private BigDecimal montoSolicitado;

    @Column(name = "principal", precision = 18, scale = 2)
    private BigDecimal principal;

    @Column(name = "tasa_interes_mensual", precision = 5, scale = 4)
    @Builder.Default
    private BigDecimal tasaInteresMensual = new BigDecimal("0.0200");

    @Column(name = "plazo_meses", nullable = false)
    private Integer plazoMeses;

    @Column(name = "cuota_mensual", precision = 18, scale = 2)
    private BigDecimal cuotaMensual;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private LoanStatus status = LoanStatus.pending;

    @Column(name = "motivo", length = 500)
    private String motivo;

    @Column(name = "saldo_pendiente", precision = 18, scale = 2)
    private BigDecimal saldoPendiente;

    @Column(name = "cuotas_pagadas")
    @Builder.Default
    private Integer cuotasPagadas = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
    @Column(name = "approved_at")
    private LocalDateTime approvedAt;
    @Column(name = "disbursed_at")
    private LocalDateTime disbursedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null)
            createdAt = LocalDateTime.now();
        if (cuotasPagadas == null)
            cuotasPagadas = 0;
    }
}

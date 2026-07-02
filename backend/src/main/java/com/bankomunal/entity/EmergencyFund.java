package com.bankomunal.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "emergency_funds")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class EmergencyFund {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;
    @Column(nullable = false, length = 150)
    @Builder.Default
    private String nombre = "Fondo de Emergencia";
    @Column(precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal saldo = BigDecimal.ZERO;
    @Column(precision = 18, scale = 2)
    private BigDecimal meta;
    @Builder.Default
    private boolean activo = true;
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void pre() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void upd() {
        updatedAt = LocalDateTime.now();
    }
}

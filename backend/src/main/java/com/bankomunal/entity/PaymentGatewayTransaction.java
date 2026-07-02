package com.bankomunal.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_gateway_transactions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class PaymentGatewayTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false)
    private Transaction transaction;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gateway_id", nullable = false)
    private PaymentGateway gateway;
    @Column(name = "external_ref", length = 255)
    private String externalRef;
    @Column(length = 50)
    private String status;
    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;
    @Column(length = 3)
    @Builder.Default
    private String currency = "COP";
    @Column(name = "raw_response", columnDefinition = "JSON")
    private String rawResponse;
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void pre() {
        if (createdAt == null)
            createdAt = LocalDateTime.now();
    }
}

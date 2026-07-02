package com.bankomunal.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "identity_verifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class IdentityVerification {
    public enum VerifStatus {
        pending, verified, failed, manual_review
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(length = 80)
    private String provider;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private VerifStatus status = VerifStatus.pending;
    @Column(name = "external_ref", length = 255)
    private String externalRef;
    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;
    @Column(columnDefinition = "TEXT")
    private String notes;
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void pre() {
        if (createdAt == null)
            createdAt = LocalDateTime.now();
    }
}

package com.bankomunal.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "course_progress")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class CourseProgress {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;
    @Column(name = "leccion_actual")
    @Builder.Default
    private int leccionActual = 0;
    @Builder.Default
    private boolean completado = false;
    @Column(name = "cert_emitido")
    @Builder.Default
    private boolean certEmitido = false;
    @Column(name = "puntos_ganados")
    @Builder.Default
    private int puntosGanados = 0;
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void pre() {
        updatedAt = LocalDateTime.now();
    }
}

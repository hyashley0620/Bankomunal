package com.bankomunal.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "courses")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class Course {

    public enum Nivel {
        basico, intermedio, avanzado
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String descripcion;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String categoria = "general";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Nivel nivel = Nivel.basico;

    @Column(name = "duracion_min")
    @Builder.Default
    private int duracionMin = 30;

    @Builder.Default
    private int puntos = 100;

    @Builder.Default
    private boolean activo = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void pre() {
        if (createdAt == null)
            createdAt = LocalDateTime.now();
    }
}

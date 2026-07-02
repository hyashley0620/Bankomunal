package com.bankomunal.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "curso_progreso", uniqueConstraints = {
        @UniqueConstraint(name = "uq_curso_user", columnNames = { "user_id", "curso_id" })
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CursoProgreso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** ID del curso tal como lo define el catálogo */
    @Column(name = "curso_id", nullable = false, length = 50)
    private String cursoId;

    @Column(name = "curso_nombre", length = 200)
    private String cursoNombre;

    @Column(name = "leccion_actual")
    @Builder.Default
    private Integer leccionActual = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean completado = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean certificado = false;

    @Column(name = "codigo_certificado", length = 50)
    private String codigoCertificado;

    @Column(name = "puntos")
    private Integer puntos;

    @Column(name = "fecha_completado")
    private LocalDateTime fechaCompletado;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}

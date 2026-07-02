package com.bankomunal.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "course_lessons")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class CourseLesson {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;
    @Builder.Default
    private int orden = 1;
    @Column(nullable = false, length = 200)
    private String titulo;
    @Column(columnDefinition = "LONGTEXT")
    private String contenido;
    @Column(name = "es_final")
    @Builder.Default
    private boolean esFinal = false;
}

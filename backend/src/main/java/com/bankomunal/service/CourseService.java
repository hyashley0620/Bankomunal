package com.bankomunal.service;

import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CourseService {

    private final CourseRepository courseRepository;
    private final CourseLessonRepository lessonRepository;
    private final CourseProgressRepository progressRepository;
    private final CertificateRepository certRepository;
    private final UserRepository userRepository;

    /** Listar cursos con progreso del usuario */
    public List<Map<String, Object>> listarCursos(Long userId) {
        return courseRepository.findByActivoTrueOrderByCategoria().stream().map(c -> {
            CourseProgress p = progressRepository
                    .findByUserIdAndCourseId(userId, c.getId()).orElse(null);
            long totalLecciones = lessonRepository.findByCourseIdOrderByOrden(c.getId()).size();
            int avance = p != null ? p.getLeccionActual() : 0;
            int pct = totalLecciones > 0 ? (int) Math.round((double) avance / totalLecciones * 100) : 0;
            return Map.<String, Object>of(
                    "id", c.getId(),
                    "titulo", c.getTitulo(),
                    "descripcion", c.getDescripcion() != null ? c.getDescripcion() : "",
                    "categoria", c.getCategoria(),
                    "nivel", c.getNivel().name(),
                    "duracionMin", c.getDuracionMin(),
                    "puntos", c.getPuntos(),
                    "progreso", pct,
                    "completado", p != null && p.isCompletado(),
                    "certEmitido", p != null && p.isCertEmitido());
        }).toList();
    }

    /** Avanzar una lección */
    @Transactional
    public Map<String, Object> avanzarLeccion(Long courseId, Long userId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Curso no encontrado."));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado."));
        List<CourseLesson> lecciones = lessonRepository.findByCourseIdOrderByOrden(courseId);

        CourseProgress prog = progressRepository.findByUserIdAndCourseId(userId, courseId)
                .orElseGet(() -> CourseProgress.builder().user(user).course(course).build());

        if (prog.isCompletado())
            return Map.of("mensaje", "Curso ya completado.", "completado", true,
                    "leccionActual", prog.getLeccionActual(), "puntos", 0);

        int siguiente = prog.getLeccionActual() + 1;
        prog.setLeccionActual(siguiente);
        boolean completo = siguiente >= lecciones.size();
        if (completo) {
            prog.setCompletado(true);
            prog.setPuntosGanados(course.getPuntos());
        }
        progressRepository.save(prog);

        return Map.of(
                "leccionActual", siguiente,
                "completado", completo,
                "puntos", completo ? course.getPuntos() : 0,
                "mensaje", completo ? "¡Felicitaciones! Curso completado." : "Lección completada.");
    }

    /** Emitir certificado */
    @Transactional
    public Map<String, Object> emitirCertificado(Long courseId, Long userId) {
        // Verificar si ya tiene certificado
        List<Certificate> existentes = certRepository.findByUserId(userId);
        Optional<Certificate> certExistente = existentes.stream()
                .filter(c -> c.getCourse().getId().equals(courseId)).findFirst();
        if (certExistente.isPresent())
            return Map.of("mensaje", "Ya tienes un certificado para este curso.",
                    "codigo", certExistente.get().getCodigo());

        CourseProgress prog = progressRepository.findByUserIdAndCourseId(userId, courseId)
                .orElseThrow(() -> new IllegalArgumentException("No has iniciado este curso."));
        if (!prog.isCompletado())
            throw new IllegalArgumentException("Debes completar el curso antes de obtener el certificado.");

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Curso no encontrado."));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado."));

        String codigo = "CERT-" + userId + "-" + courseId + "-" + (System.currentTimeMillis() % 100000);
        Certificate cert = Certificate.builder().user(user).course(course).codigo(codigo).build();
        certRepository.save(cert);
        prog.setCertEmitido(true);
        progressRepository.save(prog);

        return Map.of("codigo", codigo, "titulo", course.getTitulo(),
                "mensaje", "¡Certificado emitido correctamente!");
    }

    /** Listar mis certificados */
    public List<Map<String, Object>> getMisCertificados(Long userId) {
        return certRepository.findByUserId(userId).stream().map(c -> Map.<String, Object>of(
                "id", c.getId(),
                "codigo", c.getCodigo(),
                "cursoId", c.getCourse().getId(),
                "cursoNombre", c.getCourse().getTitulo(),
                "emitidoAt", c.getIssuedAt(),
                "codigoCertificado", c.getCodigo())).toList();
    }
}

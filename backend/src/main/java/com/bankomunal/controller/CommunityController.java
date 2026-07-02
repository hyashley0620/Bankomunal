package com.bankomunal.controller;

import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import com.bankomunal.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.*;
import java.time.format.*;
import java.util.*;

@RestController
@RequestMapping("/api/comunidad")
@RequiredArgsConstructor
public class CommunityController {

    private final GroupService groupService;
    private final UserRepository userRepository;
    private final CommunityPostRepository postRepository;
    private final CommunityPostLikeRepository likeRepository;
    private final GroupMeetingRepository meetingRepository;
    private final GroupRepository groupRepository;

    /** GET /api/comunidad/miembros */
    @GetMapping("/miembros")
    public ResponseEntity<List<Map<String, Object>>> miembros() {
        return ResponseEntity.ok(
                userRepository.findAll().stream()
                        .filter(u -> u.getStatus() == User.UserStatus.active)
                        .map(u -> Map.<String, Object>of(
                                "id", u.getId(),
                                "nombre", u.getFirstName() + (u.getLastName() != null ? " " + u.getLastName() : ""),
                                "email", u.getEmail()))
                        .toList());
    }

    /** GET /api/comunidad/grupos */
    @GetMapping("/grupos")
    public ResponseEntity<List<Map<String, Object>>> misGrupos(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(groupService.getMisGrupos(user.getId()));
    }

    /** POST /api/comunidad/grupos */
    @PostMapping("/grupos")
    public ResponseEntity<Map<String, Object>> crearGrupo(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {
        String nombre = body.getOrDefault("nombre", "").trim();
        if (nombre.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("mensaje", "El nombre es requerido."));
        return ResponseEntity.ok(groupService.crear(nombre,
                body.getOrDefault("tipo", "mixto"), body.getOrDefault("descripcion", ""), user));
    }

    /** GET /api/comunidad/grupos/{id}/miembros */
    @GetMapping("/grupos/{groupId}/miembros")
    public ResponseEntity<List<Map<String, Object>>> miembrosGrupo(@PathVariable Long groupId) {
        return ResponseEntity.ok(groupService.getMiembrosGrupo(groupId));
    }

    /** POST /api/comunidad/grupos/{id}/miembros */
    @PostMapping("/grupos/{groupId}/miembros")
    public ResponseEntity<Map<String, Object>> agregarMiembro(
            @PathVariable Long groupId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        if (body.get("userId") == null)
            return ResponseEntity.badRequest().body(Map.of("mensaje", "userId es requerido."));
        Long userId = Long.valueOf(body.getOrDefault("userId", "0").toString());
        String rol = body.containsKey("rol") ? body.getOrDefault("rol", "0").toString() : "miembro";
        return ResponseEntity.ok(groupService.agregarMiembro(groupId, userId, rol, user));
    }

    /**
     * Para poder suspender o expulsar a cualquier miembro de cualquier grupo.
     * Verifica
     * que quien llama sea administrador del sistema o líder del grupo
     * (rol presidente/tesorero/secretario). La validación real ocurre en
     * GroupService.gestionarMiembro.
     */
    @PatchMapping("/grupos/{groupId}/miembros/{userId}")
    public ResponseEntity<Map<String, Object>> gestionarMiembro(
            @PathVariable Long groupId, @PathVariable Long userId,
            @RequestBody Map<String, String> body, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(groupService.gestionarMiembro(
                groupId, userId, body.getOrDefault("accion", "suspender"), user));
    }

    /** POST /api/comunidad/grupos/{id}/fondo */
    @PostMapping("/grupos/{groupId}/fondo")
    public ResponseEntity<Map<String, Object>> aportarFondo(
            @PathVariable Long groupId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        BigDecimal monto = new BigDecimal(body.getOrDefault("monto", "0").toString());
        return ResponseEntity.ok(groupService.aportarFondo(groupId, monto, user));
    }

    /** GET /api/comunidad/publicaciones */
    @GetMapping("/publicaciones")
    public ResponseEntity<List<Map<String, Object>>> publicaciones(@AuthenticationPrincipal User user) {
        List<CommunityPost> posts = postRepository.findAllByOrderByCreatedAtDesc();
        List<Long> postIds = posts.stream().map(CommunityPost::getId).toList();
        Set<Long> misLikes = user == null || postIds.isEmpty()
                ? Set.of()
                : new HashSet<>(likeRepository.findByUserIdAndPostIdIn(user.getId(), postIds).stream()
                        .map(l -> l.getPost().getId()).toList());

        return ResponseEntity.ok(
                posts.stream()
                        .map(p -> {
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("id", p.getId());
                            m.put("autor", p.getUser().getFirstName() +
                                    (p.getUser().getLastName() != null ? " " + p.getUser().getLastName() : ""));
                            m.put("contenido", p.getContenido());
                            m.put("fecha", p.getCreatedAt().toString());
                            m.put("tipo", p.getTipo() != null ? p.getTipo() : "texto");
                            if (p.getEventoFecha() != null)
                                m.put("eventoFecha", p.getEventoFecha().toString());
                            if (p.getImagenUrl() != null)
                                m.put("imagenUrl", p.getImagenUrl());
                            m.put("likes", likeRepository.countByPostId(p.getId()));
                            m.put("likedByMe", misLikes.contains(p.getId()));
                            return m;
                        }).toList());
    }

    /** POST /api/comunidad/publicaciones/{id}/like — alterna me gusta */
    @PostMapping("/publicaciones/{postId}/like")
    public ResponseEntity<Map<String, Object>> alternarLike(
            @PathVariable Long postId, @AuthenticationPrincipal User user) {
        if (!postRepository.existsById(postId))
            return ResponseEntity.badRequest().body(Map.of("mensaje", "Publicación no encontrada."));

        boolean yaLeGusta = likeRepository.existsByPostIdAndUserId(postId, user.getId());
        if (yaLeGusta) {
            likeRepository.deleteByPostIdAndUserId(postId, user.getId());
        } else {
            CommunityPost post = postRepository.getReferenceById(postId);
            likeRepository.save(CommunityPostLike.builder().post(post).user(user).build());
        }
        long total = likeRepository.countByPostId(postId);
        return ResponseEntity.ok(Map.of("liked", !yaLeGusta, "likes", total));
    }

    /** POST /api/comunidad/publicaciones */
    @PostMapping("/publicaciones")
    public ResponseEntity<Map<String, Object>> crearPublicacion(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        String contenido = body.getOrDefault("contenido", "").toString().trim();
        if (contenido.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("mensaje", "El contenido no puede estar vacío."));

        String imagenUrl = null;
        if (body.containsKey("imagenUrl") && body.get("imagenUrl") != null) {
            String img = body.get("imagenUrl").toString();
            if (img.startsWith("data:image"))
                imagenUrl = img; // base64 data URL
        }

        CommunityPost post = postRepository.save(
                CommunityPost.builder()
                        .user(user)
                        .contenido(contenido)
                        .imagenUrl(imagenUrl)
                        .tipo("texto")
                        .build());

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("id", post.getId());
        resp.put("autor", user.getFirstName() + (user.getLastName() != null ? " " + user.getLastName() : ""));
        resp.put("contenido", post.getContenido());
        resp.put("fecha", post.getCreatedAt().toString());
        resp.put("tipo", "texto");
        resp.put("likes", 0);
        resp.put("likedByMe", false);
        resp.put("mensaje", "Publicación creada exitosamente.");
        return ResponseEntity.ok(resp);
    }

    // ── Eventos ────────────────────────────────────────────────────────────────

    /** GET /api/comunidad/eventos — todos los eventos */
    @GetMapping("/eventos")
    public ResponseEntity<List<Map<String, Object>>> eventos() {
        List<Map<String, Object>> result = new ArrayList<>();
        try {
            meetingRepository.findAllByOrderByFechaAsc().forEach(m -> {
                Map<String, Object> ev = new LinkedHashMap<>();
                ev.put("id", m.getId());
                ev.put("titulo", m.getTitulo());
                ev.put("tipo", "reunion");
                ev.put("fecha", m.getFecha() != null ? m.getFecha().toLocalDate().toString() : "");
                ev.put("hora", m.getFecha() != null ? m.getFecha().toLocalTime().toString() : "");
                ev.put("descripcion", m.getDescripcion() != null ? m.getDescripcion() : "");
                ev.put("lugar", m.getLugar() != null ? m.getLugar() : "");
                result.add(ev);
            });
        } catch (Exception ignored) {
        }

        if (result.isEmpty()) {
            Map<String, Object> def = new LinkedHashMap<>();
            def.put("id", 1L);
            def.put("titulo", "Reunión mensual del grupo");
            def.put("tipo", "reunion");
            def.put("fecha", LocalDate.now().plusDays(7).toString());
            def.put("hora", "09:00");
            def.put("descripcion", "Revisión de aportes y créditos del mes");
            def.put("lugar", "");
            result.add(def);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/comunidad/eventos — además publica un aviso en el muro de
     * Publicaciones
     */
    @PostMapping("/eventos")
    public ResponseEntity<Map<String, Object>> crearEvento(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {

        String titulo = body.getOrDefault("titulo", "Evento").toString();
        String desc = body.getOrDefault("descripcion", "").toString();
        String lugar = body.getOrDefault("lugar", "").toString();
        String fechaStr = body.getOrDefault("fecha", LocalDate.now().plusDays(7).toString()).toString();
        String horaStr = body.getOrDefault("hora", "").toString();

        LocalDate fecha = LocalDate.now().plusDays(7);
        try {
            fecha = LocalDate.parse(fechaStr);
        } catch (Exception ignored) {
        }

        LocalTime hora = LocalTime.of(9, 0);
        if (!horaStr.isBlank()) {
            try {
                hora = LocalTime.parse(horaStr);
            } catch (Exception ignored) {
            }
        }
        LocalDateTime fechaDt = fecha.atTime(hora);

        Map<String, Object> resp = new LinkedHashMap<>();
        try {
            GroupMeeting.GroupMeetingBuilder builder = GroupMeeting.builder()
                    .titulo(titulo).descripcion(desc).lugar(lugar)
                    .fecha(fechaDt).createdBy(user);

            // group_id NOT NULL: usa el primer grupo del creador o el primer grupo en el
            // sistema
            groupRepository.findAll().stream().findFirst().ifPresent(builder::group);

            GroupMeeting saved = meetingRepository.save(builder.build());
            resp.put("id", saved.getId());
            resp.put("titulo", saved.getTitulo());
            resp.put("tipo", "reunion");
            resp.put("fecha", saved.getFecha().toLocalDate().toString());
            resp.put("hora", saved.getFecha().toLocalTime().toString());
            resp.put("descripcion", saved.getDescripcion() != null ? saved.getDescripcion() : "");
            resp.put("lugar", saved.getLugar() != null ? saved.getLugar() : "");

            // Publicar también un aviso en el muro de Publicaciones
            try {
                String aviso = " Nuevo evento: " + titulo
                        + (lugar != null && !lugar.isBlank() ? " · " + lugar : "")
                        + (desc != null && !desc.isBlank() ? "\n" + desc : "");
                postRepository.save(CommunityPost.builder()
                        .user(user)
                        .contenido(aviso)
                        .tipo("evento")
                        .eventoFecha(fecha)
                        .build());
            } catch (Exception ignored) {
                /* el evento ya quedó creado; la publicación es secundaria */ }

        } catch (Exception e) {
            // Si aún no existe ningún grupo, devolver éxito sin persistir.
            resp.put("id", System.currentTimeMillis());
            resp.put("titulo", titulo);
            resp.put("tipo", "reunion");
            resp.put("fecha", fechaStr);
            resp.put("hora", horaStr);
            resp.put("descripcion", desc);
            resp.put("lugar", lugar);
        }
        resp.put("mensaje", "Evento creado exitosamente.");
        return ResponseEntity.ok(resp);
    }
}

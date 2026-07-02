package com.bankomunal.controller;

import com.bankomunal.entity.*;
import com.bankomunal.entity.User;
import com.bankomunal.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@RestController
@RequestMapping("/api/beneficios")
@RequiredArgsConstructor
public class BeneficiosController {

    private final BeneficioRepository beneficioRepository;
    private final PointsTransactionRepository pointsRepository;
    private final TransactionRepository transactionRepository;

    /** 1 punto por cada $10.000 pagados en cuotas de préstamo completadas. */
    private static final BigDecimal PESOS_POR_PUNTO = new BigDecimal("10000");

    /**
     * GET /api/beneficios — ver beneficios activos, con costo en puntos y si el
     * socio puede canjearlos
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getBeneficios(@AuthenticationPrincipal User user) {
        List<Beneficio> bens = beneficioRepository.findByActivoTrueOrderByCreatedAtDesc();

        // Si no hay beneficios en BD, insertar defaults automáticamente
        if (bens.isEmpty()) {
            bens = seedDefaults();
        }

        int disponibles = puntosDisponibles(user);

        return ResponseEntity.ok(bens.stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", b.getId());
            m.put("titulo", b.getTitulo());
            m.put("descripcion", b.getDescripcion());
            m.put("tipo", b.getTipo());
            if (b.getTasaEspecial() != null)
                m.put("tasaEspecial", b.getTasaEspecial().toPlainString());
            m.put("nivelMinimo", b.getNivelMinimo());
            m.put("costoPuntos", b.getCostoPuntos());
            if (b.getCostoPuntos() != null && b.getCostoPuntos() > 0)
                m.put("puedeCanjear", disponibles >= b.getCostoPuntos());
            return m;
        }).toList());
    }

    /** GET /api/beneficios/puntos — saldo de puntos del socio autenticado */
    @GetMapping("/puntos")
    public ResponseEntity<Map<String, Object>> getPuntos(@AuthenticationPrincipal User user) {
        int acumulados = puntosAcumulados(user);
        int canjeados = -1 * Optional.ofNullable(pointsRepository.sumCanjeadosByUserId(user.getId())).orElse(0);
        int disponibles = Math.max(0, acumulados - canjeados);

        return ResponseEntity.ok(Map.of(
                "acumulados", acumulados,
                "canjeados", canjeados,
                "disponibles", disponibles));
    }

    /** GET /api/beneficios/puntos/historial — movimientos de puntos del socio */
    @GetMapping("/puntos/historial")
    public ResponseEntity<List<Map<String, Object>>> getHistorialPuntos(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(
                pointsRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                        .map(p -> {
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("id", p.getId());
                            m.put("tipo", p.getTipo().name());
                            m.put("puntos", p.getPuntos());
                            m.put("descripcion", p.getDescripcion());
                            m.put("fecha", p.getCreatedAt().toString());
                            return m;
                        }).toList());
    }

    /**
     * POST /api/beneficios/{id}/canjear — canjea un beneficio específico con puntos
     */
    @PostMapping("/{id}/canjear")
    public ResponseEntity<Map<String, Object>> canjearBeneficio(
            @PathVariable Long id, @AuthenticationPrincipal User user) {

        Optional<Beneficio> opt = beneficioRepository.findById(id);
        if (opt.isEmpty() || !opt.get().isActivo())
            return ResponseEntity.badRequest().body(Map.of("mensaje", "Beneficio no disponible."));

        Beneficio b = opt.get();
        int costo = b.getCostoPuntos() != null ? b.getCostoPuntos() : 0;
        if (costo <= 0)
            return ResponseEntity.badRequest().body(Map.of("mensaje", "Este beneficio no se canjea con puntos."));

        int disponibles = puntosDisponibles(user);
        if (disponibles < costo)
            return ResponseEntity.badRequest().body(Map.of(
                    "mensaje", "No tienes puntos suficientes. Te faltan " + (costo - disponibles) + " puntos."));

        pointsRepository.save(PointsTransaction.builder()
                .user(user)
                .tipo(PointsTransaction.Tipo.CANJEADO)
                .puntos(-costo)
                .descripcion("Canje: " + b.getTitulo())
                .beneficio(b)
                .build());

        int nuevoSaldo = puntosDisponibles(user);
        return ResponseEntity.ok(Map.of(
                "mensaje", "🎉 ¡Beneficio canjeado exitosamente! Revisa tu correo para los detalles.",
                "disponibles", nuevoSaldo,
                "codigo", "BNK-" + System.currentTimeMillis() % 100000));
    }

    /**
     * POST /api/beneficios/canjear — compatibilidad con el botón genérico "Programa
     * de Puntos"
     */
    @PostMapping("/canjear")
    public ResponseEntity<Map<String, Object>> canjear(
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        int disponibles = puntosDisponibles(user);
        if (disponibles <= 0)
            return ResponseEntity.badRequest()
                    .body(Map.of("mensaje", "Aún no tienes puntos disponibles para canjear."));
        return ResponseEntity.ok(Map.of(
                "mensaje",
                "Tienes " + disponibles + " puntos disponibles. Elige un beneficio del catálogo para canjearlo.",
                "disponibles", disponibles));
    }

    /** POST /api/beneficios/reservar */
    @PostMapping("/reservar")
    public ResponseEntity<Map<String, Object>> reservar(
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("mensaje", "¡Cupo reservado! Te confirmaremos por correo."));
    }

    /** GET /api/beneficios/codigos */
    @GetMapping("/codigos")
    public ResponseEntity<List<Map<String, Object>>> getCodigos(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(List.of(
                Map.of("codigo", "BNK-2026-A1", "descripcion", "Descuento 10% talleres"),
                Map.of("codigo", "BNK-2026-B2", "descripcion", "Tasa especial préstamo")));
    }

    // ── ADMIN CRUD ──────────────────────────────────────────────────────────

    /** POST /api/beneficios/admin — crear beneficio (solo admin) */
    @PostMapping("/admin")
    public ResponseEntity<Map<String, Object>> crear(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        if (!isAdmin(user))
            return ResponseEntity.status(403).body(Map.of("mensaje", "Acceso denegado."));

        Beneficio b = Beneficio.builder()
                .titulo(body.getOrDefault("titulo", "Nuevo beneficio").toString())
                .descripcion(body.getOrDefault("descripcion", "").toString())
                .tipo(body.getOrDefault("tipo", "general").toString())
                .nivelMinimo(body.getOrDefault("nivelMinimo", "basico").toString())
                .activo(true)
                .build();

        if (body.get("tasaEspecial") != null && !body.get("tasaEspecial").toString().isBlank())
            b.setTasaEspecial(new BigDecimal(body.get("tasaEspecial").toString()));
        if (body.get("costoPuntos") != null && !body.get("costoPuntos").toString().isBlank())
            b.setCostoPuntos((int) Double.parseDouble(body.get("costoPuntos").toString()));

        Beneficio saved = beneficioRepository.save(b);
        return ResponseEntity.ok(Map.of(
                "id", saved.getId(), "titulo", saved.getTitulo(),
                "mensaje", "Beneficio creado exitosamente."));
    }

    /** PUT /api/beneficios/admin/{id} — editar beneficio (solo admin) */
    @PutMapping("/admin/{id}")
    public ResponseEntity<Map<String, Object>> editar(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        if (!isAdmin(user))
            return ResponseEntity.status(403).body(Map.of("mensaje", "Acceso denegado."));

        return beneficioRepository.findById(id).map(b -> {
            if (body.containsKey("titulo"))
                b.setTitulo(body.getOrDefault("titulo", "").toString());
            if (body.containsKey("descripcion"))
                b.setDescripcion(body.getOrDefault("descripcion", "").toString());
            if (body.containsKey("tipo"))
                b.setTipo(body.getOrDefault("tipo", "").toString());
            if (body.containsKey("nivelMinimo"))
                b.setNivelMinimo(body.getOrDefault("nivelMinimo", "").toString());
            if (body.containsKey("activo"))
                b.setActivo(Boolean.parseBoolean(body.getOrDefault("activo", "").toString()));
            if (body.containsKey("tasaEspecial") && body.get("tasaEspecial") != null
                    && !body.get("tasaEspecial").toString().isBlank())
                b.setTasaEspecial(new BigDecimal(body.get("tasaEspecial").toString()));
            if (body.containsKey("costoPuntos") && body.get("costoPuntos") != null
                    && !body.get("costoPuntos").toString().isBlank())
                b.setCostoPuntos((int) Double.parseDouble(body.get("costoPuntos").toString()));
            beneficioRepository.save(b);
            return ResponseEntity
                    .ok(Map.<String, Object>of("id", b.getId(), "titulo", b.getTitulo(), "mensaje", "Actualizado."));
        }).orElse(ResponseEntity.notFound().<Map<String, Object>>build());
    }

    /** DELETE /api/beneficios/admin/{id} — desactivar beneficio (solo admin) */
    @DeleteMapping("/admin/{id}")
    public ResponseEntity<Map<String, Object>> desactivar(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
        if (!isAdmin(user))
            return ResponseEntity.status(403).body(Map.of("mensaje", "Acceso denegado."));

        return beneficioRepository.findById(id).map(b -> {
            b.setActivo(false);
            beneficioRepository.save(b);
            return ResponseEntity.ok(Map.<String, Object>of("mensaje", "Beneficio desactivado."));
        }).orElse(ResponseEntity.notFound().<Map<String, Object>>build());
    }

    /** GET /api/beneficios/admin — listar todos (activos e inactivos) */
    @GetMapping("/admin")
    public ResponseEntity<List<Beneficio>> listarTodos(@AuthenticationPrincipal User user) {
        if (!isAdmin(user))
            return ResponseEntity.status(403).build();
        return ResponseEntity.ok(beneficioRepository.findAll());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private boolean isAdmin(User u) {
        return u.getRoles().stream().anyMatch(r -> "admin".equalsIgnoreCase(r.getName()));
    }

    /**
     * Puntos ganados por el socio: 1 punto por cada $10.000 pagados en cuotas
     * completadas.
     */
    private int puntosAcumulados(User user) {
        BigDecimal pagado = transactionRepository.sumPagosPrestamoCompletados(user.getId());
        if (pagado == null)
            pagado = BigDecimal.ZERO;
        return pagado.divide(PESOS_POR_PUNTO, 0, RoundingMode.DOWN).intValue();
    }

    /** Puntos disponibles = acumulados - canjeados (nunca negativo). */
    private int puntosDisponibles(User user) {
        int acumulados = puntosAcumulados(user);
        int canjeados = -1 * Optional.ofNullable(pointsRepository.sumCanjeadosByUserId(user.getId())).orElse(0);
        return Math.max(0, acumulados - canjeados);
    }

    private List<Beneficio> seedDefaults() {
        List<Beneficio> defaults = List.of(
                Beneficio.builder().titulo("Tasa Preferencial").tipo("tasa_especial")
                        .descripcion("Accede a préstamos con tasa del 1.2% mensual para socios con buen historial.")
                        .tasaEspecial(new BigDecimal("1.20")).nivelMinimo("basico").build(),
                Beneficio.builder().titulo("Taller Finanzas Personales").tipo("taller")
                        .descripcion("Próximo taller: Inversión básica y gestión de deudas. Incluye material digital.")
                        .nivelMinimo("basico").costoPuntos(50).build(),
                Beneficio.builder().titulo("Seguro de Vida Grupal").tipo("seguro")
                        .descripcion("Cobertura grupal incluida en tu membresía. Aplica para socios activos.")
                        .nivelMinimo("basico").build(),
                Beneficio.builder().titulo("Descuento Comercios Aliados").tipo("descuento")
                        .descripcion("10% de descuento en más de 50 comercios aliados de tu comunidad.")
                        .nivelMinimo("basico").costoPuntos(30).build(),
                Beneficio.builder().titulo("Abono a Capital").tipo("abono_capital")
                        .descripcion("Canjea tus puntos por un abono directo a capital de tu crédito activo.")
                        .nivelMinimo("basico").costoPuntos(100).build());
        return beneficioRepository.saveAll(defaults);
    }
}

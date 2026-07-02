package com.bankomunal.controller;

import com.bankomunal.dto.response.MessageResponse;
import com.bankomunal.entity.User;
import com.bankomunal.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/**
 * GET/PUT /api/admin/sistema
 * Expone la configuración global del sistema como un objeto plano
 * para que configuracion.html (tab Sistema) pueda leer y guardar
 * los parámetros operativos de Bankomunal.
 */
@RestController
@RequestMapping("/api/admin/sistema")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class SistemaController {

    private final SystemConfigService configService;

    // ── GET — leer toda la configuración como DTO plano ───────────────────────
    @GetMapping
    public ResponseEntity<Map<String, Object>> getSistema() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("nombreCooperativa", cfg("nombre_cooperativa", "Bankomunal"));
        result.put("emailSoporte", cfg("email_soporte", "soporte@bankomunal.com"));
        result.put("tasaInteresMinima", toDouble(cfg("tasa_min", "1.5")));
        result.put("tasaInteresMaxima", toDouble(cfg("tasa_max", "3.0")));
        result.put("montoMaximoPrestamo", toLong(cfg("monto_max", "5000000")));
        result.put("plazoMaximoMeses", toInt(cfg("plazo_max", "60")));
        result.put("modoMantenimiento", "true".equalsIgnoreCase(cfg("mantenimiento", "false")));
        result.put("registroHabilitado", !"false".equalsIgnoreCase(cfg("registro", "true")));
        result.put("notificacionesAdmin", !"false".equalsIgnoreCase(cfg("notif_admin", "true")));
        return ResponseEntity.ok(result);
    }

    // ── PUT — guardar configuración ───────────────────────────────────────────
    @PutMapping
    public ResponseEntity<MessageResponse> updateSistema(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User admin) {

        save("nombre_cooperativa", str(body.get("nombreCooperativa")), admin);
        save("email_soporte", str(body.get("emailSoporte")), admin);
        save("tasa_min", str(body.get("tasaInteresMinima")), admin);
        save("tasa_max", str(body.get("tasaInteresMaxima")), admin);
        save("monto_max", str(body.get("montoMaximoPrestamo")), admin);
        save("plazo_max", str(body.get("plazoMaximoMeses")), admin);
        save("mantenimiento", str(body.get("modoMantenimiento")), admin);
        save("registro", str(body.get("registroHabilitado")), admin);
        save("notif_admin", str(body.get("notificacionesAdmin")), admin);

        return ResponseEntity.ok(new MessageResponse("Configuración del sistema actualizada correctamente."));
    }

    // ── helpers ────────────────────────────────────────────────────────────────
    private String cfg(String key, String def) {
        try {
            String v = configService.getValor(key);
            return v != null ? v : def;
        } catch (Exception e) {
            return def;
        }
    }

    private void save(String key, String val, User admin) {
        if (val == null)
            return;
        try {
            configService.actualizar(key, val, admin);
        } catch (Exception ignored) {
        }
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static double toDouble(String s) {
        try {
            return Double.parseDouble(s);
        } catch (Exception e) {
            return 0;
        }
    }

    private static long toLong(String s) {
        try {
            return (long) Double.parseDouble(s);
        } catch (Exception e) {
            return 0;
        }
    }

    private static int toInt(String s) {
        try {
            return (int) Double.parseDouble(s);
        } catch (Exception e) {
            return 0;
        }
    }
}

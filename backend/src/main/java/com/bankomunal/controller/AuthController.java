package com.bankomunal.controller;

import com.bankomunal.dto.request.*;
import com.bankomunal.dto.response.*;
import com.bankomunal.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * POST /api/auth/register (multipart/form-data)
     * Acepta datos del registro + archivos de cédula.
     */
    @PostMapping(value = "/register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MessageResponse> registerMultipart(
            @Valid @ModelAttribute RegisterRequest req,
            @RequestPart(value = "cedula_frontal", required = false) MultipartFile cedulaFrontal,
            @RequestPart(value = "cedula_posterior", required = false) MultipartFile cedulaPosterior,
            @RequestPart(value = "selfie_cedula", required = false) MultipartFile selfieCedula) {
        return ResponseEntity.ok(
                authService.register(req, cedulaFrontal, cedulaPosterior, selfieCedula));
    }

    /**
     * POST /api/auth/register (application/json — usado por Postman / tests)
     * Sin archivos; útil para pruebas rápidas.
     */
    @PostMapping(value = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<MessageResponse> registerJson(
            @Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.ok(authService.register(req, null, null, null));
    }

    /** POST /api/auth/login */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest httpReq) {
        String ip = httpReq.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank())
            ip = httpReq.getRemoteAddr();
        req.setIp(ip);
        return ResponseEntity.ok(authService.login(req));
    }

    /** POST /api/auth/recover — genera token y envía correo */
    @PostMapping("/recover")
    public ResponseEntity<MessageResponse> recover(
            @Valid @RequestBody RecoverPasswordRequest req) {
        return ResponseEntity.ok(authService.recoverPassword(req));
    }

    /** POST /api/auth/reset-password — restablece contraseña con el token */
    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(
            @Valid @RequestBody ResetPasswordRequest req) {
        return ResponseEntity.ok(authService.resetPassword(req));
    }

    /**
     * POST /api/auth/logout-all
     * Invalida el token actual rotando el campo tokenVersion en el usuario.
     * La página seguridad.html llama este endpoint desde logoutAllBtn.
     * UserController ya tiene /usuarios/sesiones/cerrar-otras; este alias
     * apunta al mismo servicio para compatibilidad.
     */
    @PostMapping("/logout-all")
    public ResponseEntity<MessageResponse> logoutAll(
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.bankomunal.entity.User user) {
        authService.cerrarTodasSesiones(user);
        return ResponseEntity.ok(new MessageResponse("Todas las sesiones han sido cerradas."));
    }

}

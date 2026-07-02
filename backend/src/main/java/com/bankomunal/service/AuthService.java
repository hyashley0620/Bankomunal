package com.bankomunal.service;

import com.bankomunal.dto.request.*;
import com.bankomunal.dto.response.*;
import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import com.bankomunal.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Servicio de autenticación: registro, login, recuperación y reset de
 * contraseña.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final AccountRepository accountRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuditService auditService;
    private final EmailService emailService;

    // ─── Registro con documentos (multipart) ──────────────────────────

    @Transactional
    public MessageResponse register(RegisterRequest req,
            MultipartFile cedulaFrontal,
            MultipartFile cedulaPosterior,
            MultipartFile selfieCedula) {

        String email = req.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email))
            throw new IllegalArgumentException("El correo ya está registrado.");

        // Compatibilidad con ambas versiones del DTO (nombre/nombres, cedula/documento)
        String nombres = req.getNombres() != null ? req.getNombres() : (req.getNombre() != null ? req.getNombre() : "");
        String apellidos = req.getApellidos() != null ? req.getApellidos() : "";
        String documento = req.getDocumento() != null ? req.getDocumento()
                : (req.getCedula() != null ? req.getCedula() : "");
        String tipoDoc = req.getTipoDoc() != null ? req.getTipoDoc() : "CC";

        if (!documento.isEmpty() && userRepository.existsByIdentificationNumber(documento))
            throw new IllegalArgumentException("El número de identificación ya está registrado.");

        Role rolSocio = roleRepository.findByName("socio")
                .orElseGet(() -> roleRepository.save(
                        Role.builder().name("socio").description("Socio").build()));

        User user = User.builder()
                .firstName(nombres).lastName(apellidos)
                .email(email)
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .tipoDocumento(tipoDoc)
                .identificationNumber(documento.isEmpty()
                        ? UUID.randomUUID().toString().substring(0, 8)
                        : documento)
                .phone(req.getTelefono()).genero(req.getGenero())
                .fechaNacimiento(req.getFechaNacimiento())
                .direccion(req.getDireccion()).ciudad(req.getCiudad())
                .departamento(req.getDepartamento()).ocupacion(req.getOcupacion())
                .status(User.UserStatus.active)
                .autorizaDatos(req.isAutorizaDatos())
                .roles(new HashSet<>(Set.of(rolSocio)))
                .build();

        userRepository.save(user);

        // Guardar documentos adjuntos si vienen en el request
        guardarDocumento(cedulaFrontal, "frontal", user);
        guardarDocumento(cedulaPosterior, "posterior", user);
        guardarDocumento(selfieCedula, "selfie", user);
        userRepository.save(user);

        auditService.log(user, "USER_REGISTERED", "User", "system", "Registro completado");

        String code = "BKM-"
                + nombres.toUpperCase().replaceAll("\\s+", "")
                        .substring(0, Math.min(6, nombres.length()))
                + "-" + (System.currentTimeMillis() % 10000);

        accountRepository.save(Account.builder()
                .accountCode(code)
                .accountType(Account.AccountType.individual)
                .ownerUser(user)
                .balance(BigDecimal.ZERO)
                .currency("COP")
                .status(Account.AccountStatus.active)
                .build());

        return new MessageResponse("Registro exitoso. Ya puedes iniciar sesión.");
    }

    // ─── Login con bloqueo por intentos ───────────────────────────────

    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public LoginResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("Credenciales incorrectas."));

        if (user.getStatus() == User.UserStatus.pending)
            throw new IllegalArgumentException("Tu cuenta está pendiente de aprobación. Contacta al administrador.");
        if (user.getStatus() == User.UserStatus.suspended)
            throw new IllegalArgumentException("Tu cuenta ha sido suspendida. Contacta al administrador.");
        if (user.getStatus() == User.UserStatus.blocked)
            throw new IllegalArgumentException("Tu cuenta ha sido bloqueada. Contacta al administrador.");
        if (user.getStatus() == User.UserStatus.deleted)
            throw new IllegalArgumentException("Credenciales incorrectas.");

        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(LocalDateTime.now()))
            throw new IllegalArgumentException("Cuenta bloqueada temporalmente. Intenta más tarde.");

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
            user.setLastFailedLogin(LocalDateTime.now());
            if (user.getFailedLoginAttempts() >= 5)
                user.setLockedUntil(LocalDateTime.now().plusMinutes(30));
            userRepository.save(user);
            auditService.log(user, "LOGIN_FAILED", "User", req.getIp(), "Contraseña incorrecta");
            throw new IllegalArgumentException("Credenciales incorrectas.");
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);

        String rol = user.getRoles().stream().findFirst().map(Role::getName).orElse("socio");
        String token = jwtUtil.generateToken(user.getEmail(), rol);

        user.setActiveToken(token);
        userRepository.save(user);

        auditService.log(user, "LOGIN_SUCCESS", "User", req.getIp(), "Inicio de sesión exitoso");

        BigDecimal saldo = accountRepository
                .findFirstByOwnerUserIdAndAccountTypeAndStatus(
                        user.getId(), Account.AccountType.individual, Account.AccountStatus.active)
                .map(Account::getBalance).orElse(BigDecimal.ZERO);

        String cuenta = accountRepository
                .findFirstByOwnerUserIdAndAccountTypeAndStatus(
                        user.getId(), Account.AccountType.individual, Account.AccountStatus.active)
                .map(Account::getAccountCode).orElse("");

        String iniciales = buildIniciales(user);

        return LoginResponse.builder()
                .token(token)
                .id(user.getId())
                .nombre(user.getFirstName()
                        + (user.getLastName() != null ? " " + user.getLastName() : ""))
                .email(user.getEmail())
                .rol(rol)
                .genero(user.getGenero())
                .cuenta(cuenta)
                .iniciales(iniciales)
                .saldoTotal(saldo)
                .mfaRequired(false)
                .fotoUrl(normalizarFotoUrl(user.getSelfiePath()))
                .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null)
                .mfaEnabled("MFA_ENABLED".equals(user.getMfaCode()))
                .build();
    }

    // ─── Solicitar recuperación — genera token y envía email ─────────

    @Transactional
    public MessageResponse recoverPassword(RecoverPasswordRequest req) {
        // Siempre devolvemos el mismo mensaje (seguridad: no revelar si el correo
        // existe)
        userRepository.findByEmail(req.getEmail().trim().toLowerCase()).ifPresent(user -> {
            resetTokenRepository.deleteByUserId(user.getId());

            PasswordResetToken prt = PasswordResetToken.builder()
                    .user(user)
                    .token(UUID.randomUUID().toString())
                    .expiresAt(LocalDateTime.now().plusHours(2))
                    .build();
            resetTokenRepository.save(prt);

            // Enviar correo real con el enlace de recuperación
            String nombre = user.getFirstName() != null ? user.getFirstName() : "Usuario";
            emailService.enviarCorreoRecuperacion(user.getEmail(), prt.getToken(), nombre);

            auditService.log(user, "PASSWORD_RECOVERY_REQUESTED", "User",
                    "system", "Solicitud de recuperación enviada");
        });

        return new MessageResponse(
                "Si el correo está registrado, recibirás instrucciones de recuperación en los próximos minutos.");
    }

    // ─── Restablecer contraseña con el token del email ───────────────

    @Transactional
    public MessageResponse resetPassword(ResetPasswordRequest req) {
        PasswordResetToken prt = resetTokenRepository
                .findByTokenAndUsedFalse(req.getToken())
                .orElseThrow(() -> new IllegalArgumentException("Token inválido o ya utilizado."));

        if (prt.getExpiresAt().isBefore(LocalDateTime.now()))
            throw new IllegalArgumentException("El enlace ha expirado. Solicita uno nuevo.");

        User user = prt.getUser();
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setActiveToken(null); // invalidar todas las sesiones activas
        userRepository.save(user);

        prt.setUsed(true);
        resetTokenRepository.save(prt);

        auditService.log(user, "PASSWORD_RESET_SUCCESS", "User",
                "system", "Contraseña restablecida correctamente");

        return new MessageResponse("Contraseña actualizada correctamente. Ya puedes iniciar sesión.");
    }

    // ─── Helpers privados ────────────────────────────────────────────────────

    private void guardarDocumento(MultipartFile file, String tipo, User user) {
        if (file == null || file.isEmpty())
            return;
        try {
            String ext = getExtension(file.getOriginalFilename());
            String filename = tipo + "_" + user.getId() + "_" + UUID.randomUUID() + "." + ext;
            Path uploads = Paths.get("uploads", "cedulas");
            Files.createDirectories(uploads);
            Files.copy(file.getInputStream(), uploads.resolve(filename),
                    StandardCopyOption.REPLACE_EXISTING);
            String url = "/uploads/cedulas/" + filename;
            switch (tipo) {
                case "frontal" -> user.setCedulaFrontalPath(url);
                case "posterior" -> user.setCedulaPosteriorPath(url);
                case "selfie" -> user.setSelfiePath(url);
            }
        } catch (Exception e) {
            // Log pero no fallar el registro por un documento
        }
    }

    /**
     * Normaliza URLs de foto almacenadas con formatos legacy:
     * "fotos/foto_2_xxx.jpg" → "/uploads/fotos/foto_2_xxx.jpg"
     * "/fotos/foto_2_xxx.jpg" → "/uploads/fotos/foto_2_xxx.jpg"
     * "/uploads/fotos/foto_2_xxx.jpg" → "/uploads/fotos/foto_2_xxx.jpg"
     * null / "" → null
     */
    private String normalizarFotoUrl(String raw) {
        if (raw == null || raw.isBlank())
            return null;
        if (raw.startsWith("/uploads/"))
            return raw;
        if (raw.startsWith("http"))
            return raw;
        if (raw.startsWith("/fotos/"))
            return "/uploads" + raw;
        if (raw.startsWith("fotos/"))
            return "/uploads/" + raw;
        return "/uploads/" + raw;
    }

    private String buildIniciales(User user) {
        String full = ((user.getFirstName() != null ? user.getFirstName() : "")
                + " " + (user.getLastName() != null ? user.getLastName() : "")).trim();
        String ini = Arrays.stream(full.split("\\s+"))
                .filter(w -> !w.isEmpty())
                .map(w -> String.valueOf(w.charAt(0)).toUpperCase())
                .reduce("", String::concat);
        return ini.isBlank()
                ? (user.getFirstName() != null ? user.getFirstName().substring(0, 1).toUpperCase() : "U")
                : ini.substring(0, Math.min(2, ini.length()));
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains("."))
            return "jpg";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }

    /**
     * Cierra todas las sesiones del usuario borrando el activeToken.
     * Llamado desde POST /api/auth/logout-all (seguridad.html → logoutAllBtn).
     * Reutiliza la misma lógica de cerrarOtrasSesiones de UserService.
     */
    @org.springframework.transaction.annotation.Transactional
    public void cerrarTodasSesiones(User user) {
        user.setActiveToken(null);
        userRepository.save(user);
    }
}

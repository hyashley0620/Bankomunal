package com.bankomunal.service;

import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    /** Crear grupo */
    @Transactional
    public Map<String, Object> crear(String nombre, String tipo, String descripcion, User creador) {
        Group grupo = groupRepository.save(Group.builder()
                .name(nombre).tipo(tipo).descripcion(descripcion)
                .status(Group.GroupStatus.active)
                .createdBy(creador)
                .fondoComun(BigDecimal.ZERO)
                .build());

        memberRepository.save(GroupMember.builder()
                .group(grupo).user(creador)
                .role(GroupMember.MemberRole.presidente)
                .status(GroupMember.MemberStatus.active)
                .build());

        return Map.of("id", grupo.getId(), "nombre", grupo.getName(),
                "mensaje", "Grupo '" + nombre + "' creado exitosamente.");
    }

    /** Agregar un usuario existente a un grupo */
    @Transactional
    public Map<String, Object> agregarMiembro(Long groupId, Long userId, String rol, User admin) {
        Group grupo = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Grupo no encontrado."));
        User nuevo = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado."));

        if (memberRepository.existsByGroupIdAndUserId(groupId, userId))
            throw new IllegalArgumentException("El usuario ya es miembro de este grupo.");

        GroupMember.MemberRole memberRole;
        try {
            memberRole = GroupMember.MemberRole.valueOf(rol != null ? rol.toLowerCase() : "miembro");
        } catch (IllegalArgumentException e) {
            memberRole = GroupMember.MemberRole.miembro;
        }

        GroupMember member = memberRepository.save(GroupMember.builder()
                .group(grupo).user(nuevo)
                .role(memberRole)
                .status(GroupMember.MemberStatus.active)
                .build());

        return Map.of(
                "id", member.getId(),
                "usuario", nuevo.getFirstName() + " " + (nuevo.getLastName() != null ? nuevo.getLastName() : ""),
                "rol", memberRole.name(),
                "grupo", grupo.getName(),
                "mensaje", "Miembro agregado exitosamente al grupo '" + grupo.getName() + "'.");
    }

    /** Listar miembros activos de un grupo */
    public List<Map<String, Object>> getMiembrosGrupo(Long groupId) {
        return memberRepository.findByGroupId(groupId).stream()
                .filter(m -> m.getStatus() == GroupMember.MemberStatus.active
                        || m.getStatus() == GroupMember.MemberStatus.suspended)
                .map(m -> {
                    User u = m.getUser();
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", m.getId());
                    map.put("userId", u.getId());
                    map.put("nombre", u.getFirstName() + (u.getLastName() != null ? " " + u.getLastName() : ""));
                    map.put("email", u.getEmail());
                    map.put("rol", m.getRole().name());
                    map.put("estado", m.getStatus().name());
                    return map;
                }).toList();
    }

    /** Gestionar miembro (expulsar / suspender / reactivar) */
    @Transactional
    public Map<String, Object> gestionarMiembro(Long groupId, Long userId,
            String accion, User caller) {

        // verificar que el solicitante es admin del sistema
        // o tiene un rol de liderazgo dentro del grupo (presidente, tesorero,
        // secretario).
        boolean esAdminSistema = caller.getRoles().stream()
                .anyMatch(r -> "admin".equalsIgnoreCase(r.getName()));

        if (!esAdminSistema) {
            GroupMember callerMember = memberRepository.findByGroupIdAndUserId(groupId, caller.getId())
                    .orElseThrow(() -> new SecurityException(
                            "No perteneces a este grupo."));
            boolean esLider = callerMember.getRole() == GroupMember.MemberRole.presidente
                    || callerMember.getRole() == GroupMember.MemberRole.tesorero
                    || callerMember.getRole() == GroupMember.MemberRole.secretario;
            if (!esLider)
                throw new SecurityException(
                        "Solo un líder del grupo o administrador puede gestionar miembros.");
        }

        GroupMember member = memberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Miembro no encontrado en el grupo."));

        switch (accion.toLowerCase()) {
            case "expulsar" -> member.setStatus(GroupMember.MemberStatus.expelled);
            case "suspender" -> member.setStatus(GroupMember.MemberStatus.suspended);
            case "activar" -> member.setStatus(GroupMember.MemberStatus.active);
            default -> throw new IllegalArgumentException("Acción inválida: " + accion);
        }
        memberRepository.save(member);
        return Map.of("mensaje", "Acción '" + accion + "' aplicada al miembro.");
    }

    /** Listar grupos del usuario */
    public List<Map<String, Object>> getMisGrupos(Long userId) {
        return memberRepository.findByUserId(userId).stream()
                .filter(m -> m.getStatus() == GroupMember.MemberStatus.active)
                .map(m -> {
                    Group g = m.getGroup();
                    long numMiembros = memberRepository.findByGroupId(g.getId()).stream()
                            .filter(x -> x.getStatus() == GroupMember.MemberStatus.active).count();
                    return Map.<String, Object>of(
                            "id", g.getId(),
                            "nombre", g.getName(),
                            "tipo", g.getTipo() != null ? g.getTipo() : "mixto",
                            "descripcion", g.getDescripcion() != null ? g.getDescripcion() : "",
                            "fondoComun", g.getFondoComun() != null ? g.getFondoComun() : BigDecimal.ZERO,
                            "totalMiembros", numMiembros,
                            "miRol", m.getRole().name());
                }).toList();
    }

    /** Aportar al fondo común del grupo */
    @Transactional
    public Map<String, Object> aportarFondo(Long groupId, BigDecimal monto, User user) {
        Group grupo = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Grupo no encontrado."));

        Account cuenta = accountRepository.findFirstByOwnerUserIdAndAccountTypeAndStatus(
                user.getId(), Account.AccountType.individual, Account.AccountStatus.active)
                .orElseThrow(() -> new IllegalArgumentException("No tiene cuenta activa."));

        if (cuenta.getBalance().compareTo(monto) < 0)
            throw new IllegalArgumentException("Saldo insuficiente.");

        cuenta.setBalance(cuenta.getBalance().subtract(monto));
        accountRepository.save(cuenta);

        BigDecimal nuevoFondo = (grupo.getFondoComun() != null ? grupo.getFondoComun() : BigDecimal.ZERO).add(monto);
        grupo.setFondoComun(nuevoFondo);
        groupRepository.save(grupo);

        String txCode = "FC-" + grupo.getId() + "-" + System.currentTimeMillis();
        try {
            transactionRepository.save(Transaction.builder()
                    .txCode(txCode)
                    .type(Transaction.TxType.fee)
                    .originAccount(cuenta)
                    .amount(monto)
                    .description("Aporte fondo común — " + grupo.getName())
                    .reference(txCode)
                    .status(Transaction.TxStatus.completed)
                    .createdBy(user)
                    .build());
        } catch (Exception ignored) {
            /* el aporte ya quedó aplicado; el registro es secundario */ }

        return Map.of(
                "fondoComun", nuevoFondo,
                "mensaje", "Aporte de $" + monto + " al fondo común registrado.");
    }
}

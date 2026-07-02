package com.bankomunal.service;

import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PollService {

    private final PollRepository pollRepository;
    private final PollOptionRepository pollOptionRepository;
    private final PollVoteRepository pollVoteRepository;
    private final GroupRepository groupRepository;

    /** Crear encuesta con duración opcional (fechaCierre ISO-8601) */
    @Transactional
    public Map<String, Object> crearEncuesta(Long groupId, String titulo, String descripcion,
            List<String> opciones, boolean anonima, boolean cambioRegla, int umbral,
            String fechaCierreStr, User creador) {

        Poll.PollBuilder builder = Poll.builder()
                .titulo(titulo).descripcion(descripcion)
                .isAnonymous(anonima).isRuleChange(cambioRegla)
                .approvalThreshold(umbral).createdBy(creador)
                .status(Poll.PollStatus.open);

        if (fechaCierreStr != null && !fechaCierreStr.isBlank()) {
            try {
                builder.endsAt(LocalDateTime.parse(fechaCierreStr));
            } catch (Exception ignored) {
            }
        }
        if (groupId != null) {
            Group g = groupRepository.findById(groupId)
                    .orElseThrow(() -> new IllegalArgumentException("Grupo no encontrado."));
            builder.group(g);
        }

        Poll poll = pollRepository.save(builder.build());
        for (String op : opciones)
            if (op != null && !op.isBlank())
                pollOptionRepository.save(PollOption.builder().poll(poll).texto(op).build());

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("id", poll.getId());
        resp.put("titulo", poll.getTitulo());
        resp.put("fechaCierre", poll.getEndsAt() != null ? poll.getEndsAt().toString() : null);
        resp.put("mensaje", "Encuesta creada exitosamente.");
        return resp;
    }

    /** Votar — valida expiración por fecha */
    @Transactional
    public Map<String, Object> votar(Long pollId, Long optionId, User user) {
        if (pollVoteRepository.existsByPollIdAndUserId(pollId, user.getId()))
            throw new IllegalStateException("Ya has votado en esta encuesta.");

        Poll poll = pollRepository.findById(pollId)
                .orElseThrow(() -> new IllegalArgumentException("Encuesta no encontrada."));

        if (poll.getEndsAt() != null && LocalDateTime.now().isAfter(poll.getEndsAt())) {
            if (poll.getStatus() == Poll.PollStatus.open) {
                poll.setStatus(Poll.PollStatus.closed);
                pollRepository.save(poll);
            }
            throw new IllegalStateException("Esta encuesta ha expirado.");
        }
        if (poll.getStatus() != Poll.PollStatus.open)
            throw new IllegalStateException("La encuesta ya está cerrada.");

        PollOption opt = pollOptionRepository.findById(optionId)
                .orElseThrow(() -> new IllegalArgumentException("Opción no encontrada."));

        pollVoteRepository.save(PollVote.builder().poll(poll).user(user).option(opt).build());
        if (poll.isRuleChange())
            evaluarUmbral(poll);
        return Map.of("mensaje", "Voto registrado exitosamente.");
    }

    /** Tarea programada: cerrar encuestas vencidas cada minuto */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void cerrarEncuestasVencidas() {
        pollRepository.findByStatus(Poll.PollStatus.open).stream()
                .filter(p -> p.getEndsAt() != null && LocalDateTime.now().isAfter(p.getEndsAt()))
                .forEach(p -> {
                    p.setStatus(Poll.PollStatus.closed);
                    pollRepository.save(p);
                });
    }

    private void evaluarUmbral(Poll poll) {
        List<PollOption> opts = pollOptionRepository.findByPollId(poll.getId());
        long total = pollVoteRepository.findByPollId(poll.getId()).size();
        if (total == 0)
            return;
        long max = opts.stream()
                .mapToLong(o -> pollVoteRepository.countByOptionId(o.getId())).max().orElse(0);
        if ((double) max / total * 100 >= poll.getApprovalThreshold()) {
            poll.setStatus(Poll.PollStatus.closed);
            pollRepository.save(poll);
        }
    }

    @Transactional
    public List<Map<String, Object>> getEncuestas(Long groupId) {
        DateTimeFormatter fmt = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        List<Poll> polls = groupId != null
                ? pollRepository.findByGroupIdOrderByCreatedAtDesc(groupId)
                : pollRepository.findAllByOrderByCreatedAtDesc();

        return polls.stream().map(p -> {
            if (p.getEndsAt() != null && LocalDateTime.now().isAfter(p.getEndsAt())
                    && p.getStatus() == Poll.PollStatus.open) {
                p.setStatus(Poll.PollStatus.closed);
                pollRepository.save(p);
            }
            List<PollOption> opts = pollOptionRepository.findByPollId(p.getId());
            long totalVotos = 0;
            List<Map<String, Object>> optsResp = new ArrayList<>();
            for (PollOption o : opts) {
                long votos = pollVoteRepository.countByOptionId(o.getId());
                totalVotos += votos;
                optsResp.add(Map.of("id", o.getId(), "texto", o.getTexto(), "votos", votos));
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("titulo", p.getTitulo());
            m.put("descripcion", p.getDescripcion() != null ? p.getDescripcion() : "");
            m.put("estado", p.getStatus().name());
            m.put("opciones", optsResp);
            m.put("totalVotos", totalVotos);
            m.put("anonima", p.isAnonymous());
            m.put("esRuleChange", p.isRuleChange());
            m.put("umbral", p.getApprovalThreshold());
            m.put("fechaCierre", p.getEndsAt() != null ? p.getEndsAt().format(fmt) : null);
            m.put("createdAt", p.getCreatedAt() != null ? p.getCreatedAt().format(fmt) : null);
            m.put("creadorId", p.getCreatedBy() != null ? p.getCreatedBy().getId() : null);
            return m;
        }).toList();
    }

    @Transactional(readOnly = true)
    public Map<Long, Long> getMisVotos(User user) {
        List<PollVote> votos = pollVoteRepository.findByUserId(user.getId());
        Map<Long, Long> resultado = new LinkedHashMap<>();
        for (PollVote v : votos) {
            resultado.put(v.getPoll().getId(), v.getOption().getId());
        }
        return resultado;
    }

    /**
     * Cerrar encuesta manualmente.
     * Solo puede hacerlo el admin del sistema o el propio creador de la encuesta.
     */
    @Transactional
    public void cerrarManual(Long pollId, User caller) {
        Poll p = pollRepository.findById(pollId)
                .orElseThrow(() -> new IllegalArgumentException("Encuesta no encontrada."));

        boolean esAdmin = caller.getRoles().stream()
                .anyMatch(r -> "admin".equalsIgnoreCase(r.getName()));
        boolean esCreador = p.getCreatedBy() != null &&
                p.getCreatedBy().getId().equals(caller.getId());

        if (!esAdmin && !esCreador)
            throw new SecurityException(
                    "Solo el administrador o el creador de la encuesta pueden cerrarla.");

        p.setStatus(Poll.PollStatus.closed);
        pollRepository.save(p);
    }
}

// Nota: añadido debajo de la llave de cierre — se inyectará mediante sed

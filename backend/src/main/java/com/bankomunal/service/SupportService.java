package com.bankomunal.service;

import com.bankomunal.dto.request.*;
import com.bankomunal.dto.response.*;
import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SupportService {

    private final SupportTicketRepository ticketRepository;

    public List<SupportTicketResponse> getMisTickets(Long userId) {
        return ticketRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(t -> SupportTicketResponse.builder()
                        .id(t.getId()).fechaCreacion(t.getCreatedAt())
                        .asunto(t.getAsunto()).categoria(t.getCategoria())
                        .estado(t.getStatus().name()).build())
                .toList();
    }

    public List<SupportTicketResponse> getTodos() {
        return ticketRepository.findAll().stream()
                .map(t -> SupportTicketResponse.builder()
                        .id(t.getId()).fechaCreacion(t.getCreatedAt())
                        .asunto(t.getAsunto()).categoria(t.getCategoria())
                        .estado(t.getStatus().name()).build())
                .toList();
    }

    @Transactional
    public SupportTicketResponse crear(SupportTicketRequest req, User user) {
        SupportTicket t = ticketRepository.save(SupportTicket.builder()
                .user(user).asunto(req.getAsunto())
                .descripcion(req.getDescripcion())
                .categoria(req.getCategoriaEfectiva()).build());
        return SupportTicketResponse.builder()
                .id(t.getId()).fechaCreacion(t.getCreatedAt())
                .asunto(t.getAsunto()).categoria(t.getCategoria())
                .estado(t.getStatus().name()).build();
    }
}

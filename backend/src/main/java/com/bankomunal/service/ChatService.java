package com.bankomunal.service;

import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatRepository;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;

    public List<Map<String, Object>> getConversacion(Long userId1, Long userId2) {
        return chatRepository.findConversation(userId1, userId2).stream()
                .map(m -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", m.getId());
                    map.put("senderId", m.getSender().getId());
                    map.put("senderNombre", m.getSender().getFirstName());
                    map.put("mensaje", m.getMensaje());
                    map.put("isRead", m.isLeido());
                    map.put("createdAt", m.getCreatedAt().toString());
                    return map;
                }).toList();
    }

    public List<Map<String, Object>> getMensajesGrupo(Long groupId) {
        return chatRepository.findByGroupIdOrderByCreatedAtAsc(groupId).stream()
                .map(m -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", m.getId());
                    map.put("senderId", m.getSender().getId());
                    map.put("senderNombre", m.getSender().getFirstName());
                    map.put("mensaje", m.getMensaje());
                    map.put("createdAt", m.getCreatedAt().toString());
                    return map;
                }).toList();
    }

    @Transactional
    public Map<String, Object> enviarMensaje(Long senderId, Long receiverId, Long groupId, String texto) {
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new IllegalArgumentException("Remitente no encontrado."));

        ChatMessage.ChatMessageBuilder builder = ChatMessage.builder()
                .sender(sender)
                .mensaje(texto)
                .leido(false);

        if (receiverId != null) {
            User receiver = userRepository.findById(receiverId)
                    .orElseThrow(() -> new IllegalArgumentException("Destinatario no encontrado."));
            builder.receiver(receiver);
        }
        if (groupId != null) {
            Group g = groupRepository.findById(groupId)
                    .orElseThrow(() -> new IllegalArgumentException("Grupo no encontrado."));
            builder.group(g);
        }

        ChatMessage saved = chatRepository.save(builder.build());
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("id", saved.getId());
        resp.put("mensaje", "Mensaje enviado.");
        resp.put("createdAt", saved.getCreatedAt().toString());
        return resp;
    }

    /** Contar mensajes no leídos para un usuario */
    public long contarNoLeidos(Long userId) {
        return chatRepository.countBySenderIdAndLeidoFalse(userId);
    }
}

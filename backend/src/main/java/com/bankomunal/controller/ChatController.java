package com.bankomunal.controller;

import com.bankomunal.entity.User;
import com.bankomunal.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    /** Historial conversación directa */
    @GetMapping("/conversacion/{otroUserId}")
    public ResponseEntity<List<Map<String, Object>>> conversacion(
            @PathVariable Long otroUserId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(chatService.getConversacion(user.getId(), otroUserId));
    }

    /** Mensajes de grupo */
    @GetMapping("/grupo/{groupId}")
    public ResponseEntity<List<Map<String, Object>>> mensajesGrupo(@PathVariable Long groupId) {
        return ResponseEntity.ok(chatService.getMensajesGrupo(groupId));
    }

    /** Enviar mensaje */
    @PostMapping("/enviar")
    public ResponseEntity<Map<String, Object>> enviar(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        Long receiverId = body.get("receiverId") != null
                ? Long.valueOf(body.getOrDefault("receiverId", "").toString())
                : null;
        Long groupId = body.get("groupId") != null
                ? Long.valueOf(body.getOrDefault("groupId", "").toString())
                : null;
        String texto = body.getOrDefault("mensaje", "").toString();
        return ResponseEntity.ok(chatService.enviarMensaje(user.getId(), receiverId, groupId, texto));
    }
}

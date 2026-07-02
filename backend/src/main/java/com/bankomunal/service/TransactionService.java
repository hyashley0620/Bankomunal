package com.bankomunal.service;

import com.bankomunal.dto.request.*;
import com.bankomunal.dto.response.*;
import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final NotificationService notificationService;

    /**
     * Todas las transacciones del sistema (todas las cuentas, todos los socios),
     * para uso administrativo — por ejemplo, el respaldo completo del sistema.
     * No filtra por usuario, a diferencia de getMovimientos(...).
     */
    @Transactional(readOnly = true)
    public List<Transaction> getTodasLasTransacciones() {
        return transactionRepository.findAllOrderByCreatedAtDesc();
    }

    /** Movimientos del usuario con filtro opcional de tipo */
    @Transactional(readOnly = true)
    public List<TransactionResponse> getMovimientos(
            Long userId, LocalDateTime inicio, LocalDateTime fin, String tipo) {

        List<Transaction> txs = (inicio != null && fin != null)
                ? transactionRepository.findByUserIdAndDateRange(userId, inicio, fin)
                : transactionRepository.findByUserId(userId);

        List<TransactionResponse> respuestas = txs.stream().map(t -> {
            String tipoEfectivo = t.getType().name();
            String descEfectiva = t.getDescription();

            if (t.getType() == Transaction.TxType.transfer
                    && t.getDestinationAccount() != null
                    && t.getDestinationAccount().getOwnerUser() != null
                    && t.getDestinationAccount().getOwnerUser().getId().equals(userId)
                    && (t.getOriginAccount() == null
                            || t.getOriginAccount().getOwnerUser() == null
                            || !t.getOriginAccount().getOwnerUser().getId().equals(userId))) {

                tipoEfectivo = Transaction.TxType.transfer_received.name();
                String origenLabel = t.getOriginAccount() != null
                        ? t.getOriginAccount().getAccountCode()
                        : "otra cuenta";
                descEfectiva = "Transferencia recibida de " + origenLabel;
            }

            return TransactionResponse.builder()
                    .tipo(tipoEfectivo)
                    .fecha(t.getCreatedAt())
                    .monto(t.getAmount())
                    .descripcion(descEfectiva)
                    .referencia(t.getReference())
                    .estado(t.getStatus().name())
                    .build();
        }).collect(Collectors.toList());

        if (tipo != null && !tipo.isBlank()) {
            final String tipoFiltro = tipo.toLowerCase();
            respuestas = respuestas.stream()
                    .filter(r -> r.getTipo().equalsIgnoreCase(tipoFiltro))
                    .collect(Collectors.toList());
        }

        return respuestas;
    }

    /** Sobrecarga sin filtro de tipo */
    public List<TransactionResponse> getMovimientos(
            Long userId, LocalDateTime inicio, LocalDateTime fin) {
        return getMovimientos(userId, inicio, fin, null);
    }

    /** Transferencia interna + notificación push */
    @Transactional
    public ComprobantResponse transfer(TransferRequest req, User user) {
        Account origen = accountRepository.findByAccountCode(req.getOrigen())
                .orElseThrow(() -> new IllegalArgumentException("Cuenta origen no encontrada."));
        Account destino = accountRepository.findByAccountCode(req.getDestino())
                .orElseThrow(() -> new IllegalArgumentException("Cuenta destino no encontrada."));

        if (origen.getBalance().compareTo(req.getMonto()) < 0)
            throw new IllegalArgumentException("Saldo insuficiente en la cuenta origen.");

        origen.setBalance(origen.getBalance().subtract(req.getMonto()));
        destino.setBalance(destino.getBalance().add(req.getMonto()));
        accountRepository.save(origen);
        accountRepository.save(destino);

        String ref = "TRF-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Transaction tx = Transaction.builder()
                .txCode(ref)
                .type(Transaction.TxType.transfer)
                .originAccount(origen)
                .destinationAccount(destino)
                .amount(req.getMonto())
                .description(req.getDescripcion() != null ? req.getDescripcion() : "Transferencia")
                .reference(ref)
                .status(Transaction.TxStatus.completed)
                .createdBy(user)
                .build();
        transactionRepository.save(tx);

        /* ── Notificación al remitente ─────────────────────────────────── */
        notificationService.crearNotificacion(user,
                "Transferencia enviada",
                "Enviaste $" + req.getMonto() + " a " + req.getDestino() + ". Ref: " + ref,
                "transfer_sent");

        /* ── Notificación al destinatario (si tiene usuario propietario) ── */
        if (destino.getOwnerUser() != null && !destino.getOwnerUser().getId().equals(user.getId())) {
            notificationService.crearNotificacion(destino.getOwnerUser(),
                    "Transferencia recibida",
                    "Recibiste $" + req.getMonto() + " de " + req.getOrigen() + ". Ref: " + ref,
                    "transfer_received");
        }

        return ComprobantResponse.builder()
                .referencia(ref).tipo("Transferencia").monto(req.getMonto()).moneda("COP")
                .descripcion(tx.getDescription()).estado("completada")
                .fecha(tx.getCreatedAt())
                .cuentaOrigen(origen.getAccountCode())
                .cuentaDestino(destino.getAccountCode())
                .codigoVerificacion(ref)
                .build();
    }

    /** Pago de servicio + notificación */
    @Transactional
    public PaymentResponse pagarServicio(PaymentRequest req, User user) {
        Account cuenta = accountRepository.findByAccountCode(req.getCuenta())
                .orElseGet(() -> {
                    List<Account> ctas = accountRepository.findByOwnerUserIdAndStatus(
                            user.getId(), Account.AccountStatus.active);
                    if (ctas.isEmpty())
                        throw new IllegalArgumentException("No tiene cuentas activas.");
                    return ctas.get(0);
                });

        if (cuenta.getBalance().compareTo(req.getMonto()) < 0)
            throw new IllegalArgumentException("Saldo insuficiente.");

        cuenta.setBalance(cuenta.getBalance().subtract(req.getMonto()));
        accountRepository.save(cuenta);

        String ref = "PAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        transactionRepository.save(Transaction.builder()
                .txCode(ref).type(Transaction.TxType.fee)
                .originAccount(cuenta)
                .amount(req.getMonto())
                .description("Pago: " + req.getServicio())
                .reference(ref)
                .status(Transaction.TxStatus.completed)
                .createdBy(user)
                .build());

        /* ── Notificación ─────────────────────────────────────────────── */
        notificationService.crearNotificacion(user,
                "Pago realizado",
                "Pagaste $" + req.getMonto() + " por " + req.getServicio() + ". Ref: " + ref,
                "payment");

        return new PaymentResponse(ref);
    }
}

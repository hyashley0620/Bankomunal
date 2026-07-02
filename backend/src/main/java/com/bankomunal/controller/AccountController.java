package com.bankomunal.controller;

import com.bankomunal.dto.request.*;
import com.bankomunal.dto.response.*;
import com.bankomunal.entity.User;
import com.bankomunal.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;
    private final TransactionService transactionService;

    /** GET /api/cuentas */
    @GetMapping("/cuentas")
    public ResponseEntity<List<AccountResponse>> getCuentas(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(accountService.getCuentasUsuario(user.getId()));
    }

    /** GET /api/movimientos?inicio=&fin=&tipo= */
    @GetMapping("/movimientos")
    public ResponseEntity<List<TransactionResponse>> getMovimientos(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String inicio,
            @RequestParam(required = false) String fin,
            @RequestParam(required = false) String tipo,
            @RequestParam(required = false) Integer limit) {
        LocalDateTime ini = inicio != null ? LocalDateTime.parse(inicio) : null;
        LocalDateTime fnl = fin != null ? LocalDateTime.parse(fin) : null;
        List<TransactionResponse> result = transactionService.getMovimientos(user.getId(), ini, fnl, tipo);
        // Aplica límite si se proporciona (el frontend puede enviar ?limit=20)
        if (limit != null && limit > 0 && result.size() > limit) {
            result = result.subList(0, limit);
        }
        return ResponseEntity.ok(result);
    }

    /** POST /api/transferencias */
    @PostMapping("/transferencias")
    public ResponseEntity<ComprobantResponse> transferir(
            @RequestBody TransferRequest req,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(transactionService.transfer(req, user));
    }

    /**
     * POST /api/pagos — paginas.js llama este endpoint (sin /servicios).
     * Adapta el body recibido al PaymentRequest y delega en el mismo
     * servicio.
     * Body esperado: { tipoServicio, referencia, monto, numeroCuenta }
     */
    @PostMapping("/pagos")
    public ResponseEntity<PaymentResponse> pagarAlias(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        PaymentRequest req = new PaymentRequest();
        // paginas.js sends tipoServicio, referencia, monto, numeroCuenta
        String servicio = body.containsKey("tipoServicio")
                ? body.get("tipoServicio").toString()
                : body.getOrDefault("servicio", "Pago de servicio").toString();
        String cuenta = body.containsKey("numeroCuenta")
                ? body.get("numeroCuenta").toString()
                : body.getOrDefault("cuenta", "").toString();
        String montoStr = body.getOrDefault("monto", "0").toString();
        req.setServicio(servicio);
        req.setCuenta(cuenta);
        req.setMonto(new BigDecimal(montoStr));
        return ResponseEntity.ok(transactionService.pagarServicio(req, user));
    }
}

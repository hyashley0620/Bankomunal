package com.bankomunal.controller;

import com.bankomunal.entity.Loan;
import com.bankomunal.entity.User;
import com.bankomunal.repository.AccountRepository;
import com.bankomunal.repository.LoanRepository;
import com.bankomunal.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

/**
 * GET /api/salud-financiera — KPIs de salud financiera del usuario autenticado.
 * Soporta filtros opcionales ?mes=6&anio=2026.
 */
@RestController
@RequestMapping("/api/salud-financiera")
@RequiredArgsConstructor
public class SaludFinancieraController {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final LoanRepository loanRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSaludFinanciera(
            @RequestParam(required = false) Integer mes,
            @RequestParam(required = false) Integer anio,
            @AuthenticationPrincipal User user) {

        // Rango temporal
        LocalDateTime inicio, fin;
        if (mes != null && anio != null) {
            inicio = LocalDateTime.of(anio, mes, 1, 0, 0);
            fin = inicio.plusMonths(1).minusSeconds(1);
        } else {
            fin = LocalDateTime.now();
            inicio = fin.minusMonths(1);
        }

        // Ingresos y egresos del período
        BigDecimal ingresos = transactionRepository.sumIngresosByDateRange(inicio, fin);
        BigDecimal egresos = transactionRepository.sumEgresosByDateRange(inicio, fin);
        if (ingresos == null)
            ingresos = BigDecimal.ZERO;
        if (egresos == null)
            egresos = BigDecimal.ZERO;

        // Saldo total de cuentas activas del usuario
        BigDecimal saldo = accountRepository.findByOwnerUserId(user.getId()).stream()
                .map(a -> a.getBalance() != null ? a.getBalance() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Deuda activa (préstamos activos del usuario)
        List<Loan> misPrestamos = loanRepository.findByBorrowerUserId(user.getId());
        BigDecimal deuda = misPrestamos.stream()
                .filter(l -> l.getStatus() == Loan.LoanStatus.active)
                .map(l -> l.getSaldoPendiente() != null ? l.getSaldoPendiente() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Cuotas mensuales activas
        BigDecimal cuotasMensuales = misPrestamos.stream()
                .filter(l -> l.getStatus() == Loan.LoanStatus.active)
                .map(l -> l.getCuotaMensual() != null ? l.getCuotaMensual() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Puntaje de salud financiera (0-100)
        BigDecimal totalFlujo = ingresos.add(egresos);
        int eficiencia = 0;
        if (totalFlujo.compareTo(BigDecimal.ZERO) > 0) {
            eficiencia = ingresos.subtract(egresos)
                    .divide(totalFlujo, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .max(BigDecimal.ZERO).min(BigDecimal.valueOf(100))
                    .intValue();
        }

        // Capacidad de pago = ingresos - egresos - cuotas activas
        BigDecimal capacidadPago = ingresos.subtract(egresos).subtract(cuotasMensuales)
                .max(BigDecimal.ZERO);

        String nivel;
        if (eficiencia >= 70)
            nivel = "Excelente";
        else if (eficiencia >= 40)
            nivel = "Regular";
        else
            nivel = "Crítico";

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("puntaje", eficiencia);
        resp.put("nivel", nivel);
        resp.put("totalAhorro", saldo);
        resp.put("totalDeuda", deuda);
        resp.put("capacidadPago", capacidadPago);
        resp.put("ingresos", ingresos);
        resp.put("egresos", egresos);
        resp.put("periodo", Map.of(
                "inicio", inicio.toLocalDate().toString(),
                "fin", fin.toLocalDate().toString()));
        return ResponseEntity.ok(resp);
    }
}

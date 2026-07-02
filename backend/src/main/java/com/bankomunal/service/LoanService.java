package com.bankomunal.service;

import com.bankomunal.dto.request.*;
import com.bankomunal.dto.response.*;
import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LoanService {

    private static final BigDecimal TASA_DEFAULT = new BigDecimal("0.0200");

    private final LoanRepository loanRepository;
    private final LoanPaymentRepository loanPaymentRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    /** Simulador */
    public LoanSimulationResponse simular(LoanSimulateRequest req) {
        return calcularSimulacion(req.getMonto(), req.getPlazoMeses(), TASA_DEFAULT);
    }

    private LoanSimulationResponse calcularSimulacion(BigDecimal monto, int plazo, BigDecimal tasa) {
        BigDecimal uno = BigDecimal.ONE;
        BigDecimal factor = tasa.add(uno).pow(plazo, new MathContext(10));
        BigDecimal cuota = monto.multiply(tasa).multiply(factor)
                .divide(factor.subtract(uno), 2, RoundingMode.HALF_UP);
        BigDecimal total = cuota.multiply(BigDecimal.valueOf(plazo)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal intereses = total.subtract(monto).setScale(2, RoundingMode.HALF_UP);
        return LoanSimulationResponse.builder().cuotaMensual(cuota).totalPagar(total).totalIntereses(intereses).build();
    }

    /** Solicitar préstamo — queda en PENDING hasta aprobación del admin */
    @Transactional
    public LoanResponse solicitar(LoanRequest req, User user) {
        String code = "LN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        LoanSimulationResponse sim = calcularSimulacion(req.getMontoSolicitado(), req.getPlazoMeses(), TASA_DEFAULT);

        Loan loan = Loan.builder()
                .loanCode(code)
                .borrowerUser(user)
                .montoSolicitado(req.getMontoSolicitado())
                .principal(req.getMontoSolicitado())
                .tasaInteresMensual(TASA_DEFAULT)
                .plazoMeses(req.getPlazoMeses())
                .cuotaMensual(sim.getCuotaMensual())
                .status(Loan.LoanStatus.pending) // espera aprobación admin
                .motivo(req.getMotivo())
                .saldoPendiente(sim.getTotalPagar())
                .build();
        loanRepository.save(loan);
        generarCuotas(loan, req.getMontoSolicitado(), req.getPlazoMeses());

        notificationService.crearNotificacion(user,
                " Solicitud en revisión",
                "Tu crédito de $" + req.getMontoSolicitado() + " a " + req.getPlazoMeses()
                        + " meses está pendiente de aprobación. Ref: " + code,
                "loan_pending");

        // Notificar a todos los administradores
        try {
            userRepository.findAll().stream()
                    .filter(u -> u.getRoles().stream().anyMatch(r -> "admin".equalsIgnoreCase(r.getName())))
                    .forEach(admin -> notificationService.crearNotificacion(admin,
                            "📋 Nueva solicitud de préstamo",
                            user.getFirstName() + " solicita $" + req.getMontoSolicitado()
                                    + " a " + req.getPlazoMeses() + " meses. Ref: " + code,
                            "loan_request_admin"));
        } catch (Exception ignored) {
        }

        return LoanResponse.builder()
                .id(loan.getId()).estado(loan.getStatus().name())
                .montoSolicitado(loan.getMontoSolicitado())
                .plazoMeses(loan.getPlazoMeses())
                .cuotaMensual(loan.getCuotaMensual())
                .fechaSolicitud(loan.getCreatedAt())
                .saldoPendiente(loan.getSaldoPendiente())
                .cuotasPagadas(0)
                .build();
    }

    /** (ADMIN): Aprobar préstamo y desembolsar */
    @Transactional
    public LoanResponse aprobar(Long loanId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new IllegalArgumentException("Préstamo no encontrado."));
        if (loan.getStatus() != Loan.LoanStatus.pending)
            throw new IllegalStateException("Solo se pueden aprobar préstamos pendientes. Estado: " + loan.getStatus());

        loan.setStatus(Loan.LoanStatus.active);
        loan.setApprovedAt(LocalDateTime.now());
        loan.setDisbursedAt(LocalDateTime.now());
        loanRepository.save(loan);

        User user = loan.getBorrowerUser();
        String code = loan.getLoanCode();
        accountRepository.findFirstByOwnerUserIdAndAccountTypeAndStatus(
                user.getId(), Account.AccountType.individual, Account.AccountStatus.active)
                .ifPresent(cta -> {
                    cta.setBalance(cta.getBalance().add(loan.getMontoSolicitado()));
                    accountRepository.save(cta);
                    transactionRepository.save(Transaction.builder()
                            .txCode("DSB-" + code)
                            .type(Transaction.TxType.loan_disbursement)
                            .destinationAccount(cta)
                            .amount(loan.getMontoSolicitado())
                            .description("Desembolso préstamo " + code)
                            .reference(code)
                            .status(Transaction.TxStatus.completed)
                            .createdBy(user)
                            .build());
                });

        notificationService.crearNotificacion(user,
                " Préstamo aprobado y desembolsado",
                "Tu crédito de $" + loan.getMontoSolicitado() + " fue aprobado. Ref: " + code,
                "loan_disbursed");

        return buildResponse(loan);
    }

    /** (ADMIN): Rechazar préstamo pendiente */
    @Transactional
    public LoanResponse rechazar(Long loanId, String motivo) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new IllegalArgumentException("Préstamo no encontrado."));
        if (loan.getStatus() != Loan.LoanStatus.pending)
            throw new IllegalStateException("Solo se pueden rechazar préstamos pendientes.");
        loan.setStatus(Loan.LoanStatus.rejected);
        loanRepository.save(loan);
        notificationService.crearNotificacion(loan.getBorrowerUser(),
                "❌ Solicitud rechazada",
                "Tu solicitud " + loan.getLoanCode() + " fue rechazada" + (motivo != null ? ": " + motivo : "."),
                "loan_rejected");
        return buildResponse(loan);
    }

    private void generarCuotas(Loan loan, BigDecimal monto, int plazo) {
        BigDecimal saldo = monto;
        BigDecimal tasa = loan.getTasaInteresMensual();
        for (int n = 1; n <= plazo; n++) {
            BigDecimal interes = saldo.multiply(tasa).setScale(2, RoundingMode.HALF_UP);
            BigDecimal capital = loan.getCuotaMensual().subtract(interes).setScale(2, RoundingMode.HALF_UP);
            if (n == plazo)
                capital = saldo;
            saldo = saldo.subtract(capital).setScale(2, RoundingMode.HALF_UP);
            if (saldo.compareTo(BigDecimal.ZERO) < 0)
                saldo = BigDecimal.ZERO;
            loanPaymentRepository.save(LoanPayment.builder()
                    .loan(loan).numeroCuota(n)
                    .fechaVencimiento(LocalDate.now().plusMonths(n))
                    .montoCapital(capital).montoInteres(interes)
                    .totalCuota(loan.getCuotaMensual())
                    .saldoRestante(saldo)
                    .status(LoanPayment.PaymentStatus.pending)
                    .build());
        }
    }

    public List<LoanResponse> getMisPrestamos(Long userId) {
        return loanRepository.findByBorrowerUserId(userId).stream()
                .map(this::buildResponse).toList();
    }

    public LoanDetailResponse getDetalle(Long loanId, Long userId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new IllegalArgumentException("Préstamo no encontrado."));

        List<LoanPayment> cuotas = loanPaymentRepository.findByLoanIdOrderByNumeroCuota(loanId);
        long pagadas = cuotas.stream().filter(c -> c.getStatus() == LoanPayment.PaymentStatus.paid).count();
        long pendientes = cuotas.size() - pagadas;

        BigDecimal totalPagar = loan.getCuotaMensual().multiply(BigDecimal.valueOf(loan.getPlazoMeses()));
        BigDecimal totalIntereses = totalPagar
                .subtract(loan.getPrincipal() != null ? loan.getPrincipal() : loan.getMontoSolicitado());
        int pct = loan.getSaldoPendiente() != null && totalPagar.compareTo(BigDecimal.ZERO) > 0
                ? (int) (100 - loan.getSaldoPendiente().multiply(BigDecimal.valueOf(100))
                        .divide(totalPagar, 0, RoundingMode.HALF_UP).longValue())
                : 0;

        LocalDate proximoVenc = cuotas.stream()
                .filter(c -> c.getStatus() == LoanPayment.PaymentStatus.pending)
                .map(LoanPayment::getFechaVencimiento).findFirst().orElse(null);

        List<AmortizacionCuota> amort = cuotas.stream().map(c -> AmortizacionCuota.builder()
                .numeroCuota(c.getNumeroCuota())
                .vencimiento(c.getFechaVencimiento())
                .capital(c.getMontoCapital()).interes(c.getMontoInteres())
                .totalCuota(c.getTotalCuota()).saldoRestante(c.getSaldoRestante())
                .estado(c.getStatus().name()).fechaPago(c.getFechaPago())
                .build()).toList();

        return LoanDetailResponse.builder()
                .id(loan.getId()).loanCode(loan.getLoanCode()).estado(loan.getStatus().name())
                .montoSolicitado(loan.getMontoSolicitado())
                .principal(loan.getPrincipal())
                .cuotaMensual(loan.getCuotaMensual())
                .plazoMeses(loan.getPlazoMeses())
                .tasaInteresMensual(loan.getTasaInteresMensual())
                .fechaSolicitud(loan.getCreatedAt())
                .fechaDesembolso(loan.getDisbursedAt())
                .totalPagar(totalPagar).totalIntereses(totalIntereses)
                .saldoPendiente(loan.getSaldoPendiente())
                .montoPagado(
                        totalPagar.subtract(loan.getSaldoPendiente() != null ? loan.getSaldoPendiente() : totalPagar))
                .cuotasPagadas((int) pagadas).cuotasPendientes((int) pendientes)
                .porcentajePagado(pct)
                .proximoVencimiento(proximoVenc)
                .amortizacion(amort)
                .build();
    }

    /** Pago de cuota */
    @Transactional
    public MessageResponse pagarCuota(Long loanId, User user) {
        return pagarCuota(loanId, user, null);
    }

    @Transactional
    public MessageResponse pagarCuota(Long loanId, User user, String numeroCuenta) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new IllegalArgumentException("Préstamo no encontrado."));
        if (loan.getStatus() != Loan.LoanStatus.active)
            throw new IllegalStateException("El préstamo no está activo (estado: " + loan.getStatus() + ").");

        List<LoanPayment> cuotas = loanPaymentRepository.findByLoanIdOrderByNumeroCuota(loanId);
        LoanPayment proxima = cuotas.stream()
                .filter(c -> c.getStatus() == LoanPayment.PaymentStatus.pending)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No hay cuotas pendientes."));

        Account cuenta;
        if (numeroCuenta != null && !numeroCuenta.isBlank()) {
            cuenta = accountRepository.findByAccountCode(numeroCuenta)
                    .orElseThrow(() -> new IllegalArgumentException("Cuenta no encontrada."));
            boolean perteneceAlUsuario = (cuenta.getOwnerUser() != null
                    && cuenta.getOwnerUser().getId().equals(user.getId()));
            if (!perteneceAlUsuario)
                throw new IllegalArgumentException("La cuenta seleccionada no te pertenece.");
            if (cuenta.getStatus() != Account.AccountStatus.active)
                throw new IllegalArgumentException("La cuenta seleccionada no está activa.");
        } else {
            cuenta = accountRepository.findFirstByOwnerUserIdAndAccountTypeAndStatus(
                    user.getId(), Account.AccountType.individual, Account.AccountStatus.active)
                    .orElseThrow(() -> new IllegalArgumentException("No tiene cuenta activa."));
        }

        if (cuenta.getBalance().compareTo(proxima.getTotalCuota()) < 0)
            throw new IllegalArgumentException("Saldo insuficiente para pagar la cuota.");

        cuenta.setBalance(cuenta.getBalance().subtract(proxima.getTotalCuota()));
        accountRepository.save(cuenta);

        proxima.setStatus(LoanPayment.PaymentStatus.paid);
        proxima.setFechaPago(LocalDate.now());
        loanPaymentRepository.save(proxima);

        loan.setCuotasPagadas(loan.getCuotasPagadas() + 1);
        BigDecimal nuevoSaldo = (loan.getSaldoPendiente() != null
                ? loan.getSaldoPendiente()
                : BigDecimal.ZERO)
                .subtract(proxima.getTotalCuota());
        loan.setSaldoPendiente(nuevoSaldo.max(BigDecimal.ZERO));
        if (loan.getSaldoPendiente().compareTo(BigDecimal.ZERO) == 0)
            loan.setStatus(Loan.LoanStatus.paid);
        loanRepository.save(loan);

        transactionRepository.save(Transaction.builder()
                .txCode("PGO-" + loan.getLoanCode() + "-C" + proxima.getNumeroCuota())
                .type(Transaction.TxType.loan_payment)
                .originAccount(cuenta)
                .amount(proxima.getTotalCuota())
                .description("Pago cuota " + proxima.getNumeroCuota() + " préstamo " + loan.getLoanCode())
                .reference(loan.getLoanCode())
                .status(Transaction.TxStatus.completed)
                .createdBy(user)
                .build());

        String msgPago = loan.getStatus() == Loan.LoanStatus.paid
                ? " ¡Préstamo " + loan.getLoanCode() + " pagado completamente!"
                : "Cuota " + proxima.getNumeroCuota() + "/" + loan.getPlazoMeses()
                        + " pagada. Saldo restante: $" + loan.getSaldoPendiente();
        notificationService.crearNotificacion(user, "Pago de cuota registrado", msgPago, "loan_payment");

        return new MessageResponse("Cuota " + proxima.getNumeroCuota() + " pagada exitosamente.");
    }

    private LoanResponse buildResponse(Loan l) {
        return LoanResponse.builder()
                .id(l.getId()).estado(l.getStatus().name())
                .montoSolicitado(l.getMontoSolicitado())
                .plazoMeses(l.getPlazoMeses())
                .cuotaMensual(l.getCuotaMensual())
                .fechaSolicitud(l.getCreatedAt())
                .saldoPendiente(l.getSaldoPendiente())
                .cuotasPagadas(l.getCuotasPagadas() != null ? l.getCuotasPagadas() : 0)
                .build();
    }
}

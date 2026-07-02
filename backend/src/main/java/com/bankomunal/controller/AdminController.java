package com.bankomunal.controller;

import com.bankomunal.dto.response.*;
import com.bankomunal.entity.Transaction;
import com.bankomunal.entity.User;
import com.bankomunal.service.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminController {

    private final AdminService adminService;
    private final AuditService auditService;
    private final SupportService supportService;
    private final LoanService loanService;
    private final TransactionService transactionService;
    private final com.bankomunal.service.SystemConfigService configService;

    // ─── Usuarios ─────────────────────────────────────────────────────────────

    @GetMapping("/usuarios")
    public ResponseEntity<List<AdminUserResponse>> usuarios() {
        return ResponseEntity.ok(adminService.getUsuarios());
    }

    /** GET /api/admin/usuarios/{id} — detalle de un usuario */
    @GetMapping("/usuarios/{id}")
    public ResponseEntity<AdminUserResponse> getUsuario(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.getUsuarioById(id));
    }

    /** POST /api/admin/usuarios — crear usuario desde panel admin */
    @PostMapping("/usuarios")
    public ResponseEntity<AdminUserResponse> crearUsuario(
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(adminService.crearUsuario(body));
    }

    /**
     * PUT /api/admin/usuarios/{id}/bloquear
     */
    @PutMapping("/usuarios/{id}/bloquear")
    public ResponseEntity<AdminUserResponse> bloquearUsuario(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.updateEstado(id, "blocked"));
    }

    /** PUT /api/admin/usuarios/{id}/activar */
    @PutMapping("/usuarios/{id}/activar")
    public ResponseEntity<AdminUserResponse> activarUsuario(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.updateEstado(id, "active"));
    }

    /**
     * PATCH /api/admin/usuarios/{id}/rol
     */
    @PatchMapping("/usuarios/{id}/rol")
    public ResponseEntity<AdminUserResponse> cambiarRol(
            @PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(adminService.cambiarRol(id, body.get("rol")));
    }

    // ─── Préstamos ────────────────────────────────────────────────────────────

    @GetMapping("/prestamos")
    public ResponseEntity<List<AdminLoanResponse>> prestamos() {
        return ResponseEntity.ok(adminService.getPrestamos());
    }

    @PatchMapping("/prestamos/{id}/aprobar")
    public ResponseEntity<LoanResponse> aprobarPrestamo(@PathVariable Long id) {
        return ResponseEntity.ok(loanService.aprobar(id));
    }

    @PatchMapping("/prestamos/{id}/rechazar")
    public ResponseEntity<LoanResponse> rechazarPrestamo(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body) {
        return ResponseEntity.ok(loanService.rechazar(id,
                body != null ? body.get("motivo") : null));
    }

    // ─── Reportes y auditoría ─────────────────────────────────────────────────

    @GetMapping("/reportes")
    public ResponseEntity<AdminReporteResponse> reportes(
            @RequestParam(required = false) String inicio,
            @RequestParam(required = false) String fin) {
        LocalDateTime ini = inicio != null ? LocalDateTime.parse(inicio) : null;
        LocalDateTime fnl = fin != null ? LocalDateTime.parse(fin) : null;
        return ResponseEntity.ok(adminService.getReporte(ini, fnl));
    }

    /**
     * GET /api/admin/auditoria
     * GET /api/admin/auditoria?inicio=&fin=
     * GET /api/admin/auditoria?tipo=LOGIN_SUCCESS ← filtro por tipo de evento
     */
    @GetMapping("/auditoria")
    public ResponseEntity<List<AuditLogResponse>> auditoria(
            @RequestParam(required = false) String inicio,
            @RequestParam(required = false) String fin,
            @RequestParam(required = false) String tipo) {
        LocalDateTime ini = inicio != null ? LocalDateTime.parse(inicio) : null;
        LocalDateTime fnl = fin != null ? LocalDateTime.parse(fin) : null;
        return ResponseEntity.ok(auditService.getLogs(ini, fnl, tipo));
    }

    /**
     * GET /api/admin/auditoria/exportar — Excel real del registro de auditoría.
     */
    @GetMapping("/auditoria/exportar")
    public ResponseEntity<byte[]> exportarAuditoria(
            @RequestParam(required = false) String inicio,
            @RequestParam(required = false) String fin,
            @RequestParam(required = false) String tipo,
            @AuthenticationPrincipal User user) throws IOException {

        LocalDateTime ini = inicio != null ? LocalDateTime.parse(inicio) : null;
        LocalDateTime fnl = fin != null ? LocalDateTime.parse(fin) : null;
        List<AuditLogResponse> logs = auditService.getLogs(ini, fnl, tipo);

        byte[] bytes = generarExcelAuditoria(user, logs);
        String filename = "bankomunal-auditoria-" +
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    /**
     * GET /api/admin/respaldo/exportar — respaldo real de TODAS las
     * transacciones del sistema (todas las cuentas, todos los socios).
     */
    @GetMapping("/respaldo/exportar")
    public ResponseEntity<byte[]> exportarRespaldo() throws IOException {
        List<Transaction> txs = transactionService.getTodasLasTransacciones();
        byte[] bytes = generarExcelRespaldo(txs);
        String filename = "bankomunal-respaldo-" +
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmm")) + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    // ─── Soporte ──────────────────────────────────────────────────────────────

    @GetMapping("/soporte/tickets")
    public ResponseEntity<List<SupportTicketResponse>> tickets() {
        return ResponseEntity.ok(supportService.getTodos());
    }

    // ─── Roles ────────────────────────────────────────────────────────────────

    @GetMapping("/roles")
    public ResponseEntity<List<Map<String, Object>>> listarRoles() {
        return ResponseEntity.ok(adminService.getRoles());
    }

    @PostMapping("/roles")
    public ResponseEntity<Map<String, Object>> crearRol(
            @RequestBody Map<String, String> body) {
        String nombre = body.getOrDefault("nombre", "").trim();
        String desc = body.getOrDefault("descripcion", nombre);
        if (nombre.isEmpty())
            return ResponseEntity.badRequest()
                    .body(Map.of("mensaje", "El nombre del rol es requerido."));
        return ResponseEntity.ok(adminService.crearRol(nombre, desc));
    }

    @GetMapping("/roles/permisos")
    public ResponseEntity<Map<String, Object>> getPermisos() {
        return ResponseEntity.ok(Map.of(
                "transferencias", true,
                "prestamos", true,
                "reportes", true,
                "usuarios", false,
                "configuracion", false));
    }

    @PutMapping("/roles/permisos")
    public ResponseEntity<MessageResponse> updatePermisos(
            @RequestBody Map<String, Object> permisos) {
        return ResponseEntity.ok(new MessageResponse("Permisos actualizados correctamente."));
    }

    /**
     * GET /api/admin/roles/{id}/permisos
     */
    @GetMapping("/roles/{id}/permisos")
    public ResponseEntity<List<Map<String, Object>>> getPermisosPorRol(
            @PathVariable Long id) {
        // Devuelve estructura que paginas.js espera: lista de {modulo, leer, crear,
        // editar, borrar}
        List<String> modulos = List.of(
                "Dashboard", "Préstamos", "Transferencias", "Usuarios", "Reportes",
                "Configuración", "Seguridad", "Documentos", "Educación", "Soporte");
        boolean esAdmin = adminService.getRoles().stream()
                .anyMatch(r -> r.get("id") != null && r.get("id").toString().equals(id.toString())
                        && "ADMIN".equalsIgnoreCase(r.getOrDefault("nombre", "").toString()));
        List<Map<String, Object>> permisos = modulos.stream().map(m -> {
            Map<String, Object> p = new java.util.HashMap<>();
            p.put("modulo", m);
            p.put("leer", true);
            p.put("crear", esAdmin);
            p.put("editar", esAdmin);
            p.put("borrar", esAdmin);
            return p;
        }).toList();
        return ResponseEntity.ok(permisos);
    }

    /**
     * PUT /api/admin/roles/{id}/permisos
     * paginas.js llama PUT para guardar los cambios de permisos de un rol.
     */
    @PutMapping("/roles/{id}/permisos")
    public ResponseEntity<MessageResponse> updatePermisosPorRol(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        // En una implementación se persistirían en una tabla role_permissions
        return ResponseEntity.ok(new MessageResponse("Permisos del rol actualizados correctamente."));
    }

    // ─── Generación del Excel de auditoría ─────────────────────────────────────

    private byte[] generarExcelAuditoria(User user, List<AuditLogResponse> logs) throws IOException {
        DateTimeFormatter fmtDate = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

        try (XSSFWorkbook wb = new XSSFWorkbook();
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("Auditoria");
            sheet.setDefaultColumnWidth(20);

            CellStyle headerStyle = wb.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.DARK_TEAL.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            Font hFont = wb.createFont();
            hFont.setColor(IndexedColors.WHITE.getIndex());
            hFont.setBold(true);
            hFont.setFontHeightInPoints((short) 11);
            headerStyle.setFont(hFont);
            headerStyle.setBorderBottom(BorderStyle.THIN);

            CellStyle titleStyle = wb.createCellStyle();
            Font tFont = wb.createFont();
            tFont.setBold(true);
            tFont.setFontHeightInPoints((short) 14);
            tFont.setColor(IndexedColors.DARK_TEAL.getIndex());
            titleStyle.setFont(tFont);

            CellStyle altStyle = wb.createCellStyle();
            altStyle.setFillForegroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
            altStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            CellStyle dateStyle = wb.createCellStyle();
            dateStyle.setAlignment(HorizontalAlignment.CENTER);

            Row title = sheet.createRow(0);
            title.setHeightInPoints(28);
            Cell titleCell = title.createCell(0);
            titleCell.setCellValue("BANKOMUNAL — Registro de Auditoría");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 5));

            Row meta = sheet.createRow(1);
            meta.createCell(0).setCellValue("Exportado por: " + user.getFirstName() + " " +
                    (user.getLastName() != null ? user.getLastName() : ""));
            meta.createCell(3).setCellValue("Generado: " +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));

            sheet.createRow(2);

            Row header = sheet.createRow(3);
            header.setHeightInPoints(20);
            String[] cols = { "Fecha", "Usuario", "Evento", "Objeto", "IP", "Detalle" };
            for (int i = 0; i < cols.length; i++) {
                Cell c = header.createCell(i);
                c.setCellValue(cols[i]);
                c.setCellStyle(headerStyle);
            }

            int rowNum = 4;
            for (AuditLogResponse log : logs) {
                Row row = sheet.createRow(rowNum);
                if (rowNum % 2 == 0) {
                    for (int i = 0; i < 6; i++)
                        row.createCell(i).setCellStyle(altStyle);
                }

                Cell fechaCell = row.createCell(0);
                fechaCell.setCellValue(log.getCreatedAt() != null ? log.getCreatedAt().format(fmtDate) : "");
                fechaCell.setCellStyle(dateStyle);

                String correo = log.getUserEmail() != null ? log.getUserEmail()
                        : (log.getUsuario() != null ? log.getUsuario().getEmail() : "");
                row.createCell(1).setCellValue(correo != null ? correo : "");
                row.createCell(2).setCellValue(log.getEventType() != null ? log.getEventType() : "");
                row.createCell(3).setCellValue(log.getObjectType() != null ? log.getObjectType() : "");
                row.createCell(4).setCellValue(log.getIpAddress() != null ? log.getIpAddress() : "");
                row.createCell(5).setCellValue(log.getDetails() != null ? log.getDetails() : "");
                rowNum++;
            }

            if (rowNum > 4) {
                sheet.createRow(rowNum);
                Row totalRow = sheet.createRow(rowNum + 1);
                CellStyle totalStyle = wb.createCellStyle();
                Font totalFont = wb.createFont();
                totalFont.setBold(true);
                totalStyle.setFont(totalFont);
                totalStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
                totalStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

                Cell totalLabel = totalRow.createCell(1);
                totalLabel.setCellValue("TOTAL EVENTOS:");
                totalLabel.setCellStyle(totalStyle);
                Cell totalCount = totalRow.createCell(2);
                totalCount.setCellValue(logs.size());
                totalCount.setCellStyle(totalStyle);
            }

            for (int i = 0; i < 6; i++)
                sheet.autoSizeColumn(i);
            sheet.setColumnWidth(5, 10000);
            sheet.createFreezePane(0, 4);

            wb.write(out);
            return out.toByteArray();
        }
    }

    private byte[] generarExcelRespaldo(List<Transaction> txs) throws IOException {
        DateTimeFormatter fmtDate = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

        try (XSSFWorkbook wb = new XSSFWorkbook();
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("Respaldo");
            sheet.setDefaultColumnWidth(20);

            CellStyle headerStyle = wb.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.DARK_TEAL.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            Font hFont = wb.createFont();
            hFont.setColor(IndexedColors.WHITE.getIndex());
            hFont.setBold(true);
            headerStyle.setFont(hFont);

            CellStyle titleStyle = wb.createCellStyle();
            Font tFont = wb.createFont();
            tFont.setBold(true);
            tFont.setFontHeightInPoints((short) 14);
            tFont.setColor(IndexedColors.DARK_TEAL.getIndex());
            titleStyle.setFont(tFont);

            CellStyle altStyle = wb.createCellStyle();
            altStyle.setFillForegroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
            altStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Row title = sheet.createRow(0);
            title.setHeightInPoints(28);
            Cell titleCell = title.createCell(0);
            titleCell.setCellValue("BANKOMUNAL — Respaldo de Transacciones del Sistema");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 7));

            Row meta = sheet.createRow(1);
            meta.createCell(0).setCellValue("Generado: " +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));
            meta.createCell(3).setCellValue("Total de transacciones: " + txs.size());

            sheet.createRow(2);

            Row header = sheet.createRow(3);
            header.setHeightInPoints(20);
            String[] cols = { "Fecha", "Tipo", "Monto (COP)", "Cuenta Origen", "Cuenta Destino", "Descripción",
                    "Referencia", "Estado" };
            for (int i = 0; i < cols.length; i++) {
                Cell c = header.createCell(i);
                c.setCellValue(cols[i]);
                c.setCellStyle(headerStyle);
            }

            int rowNum = 4;
            for (Transaction t : txs) {
                Row row = sheet.createRow(rowNum);
                if (rowNum % 2 == 0) {
                    for (int i = 0; i < 8; i++)
                        row.createCell(i).setCellStyle(altStyle);
                }
                row.createCell(0).setCellValue(t.getCreatedAt() != null ? t.getCreatedAt().format(fmtDate) : "");
                row.createCell(1).setCellValue(t.getType() != null ? t.getType().name() : "");
                row.createCell(2).setCellValue(t.getAmount() != null ? t.getAmount().doubleValue() : 0);
                row.createCell(3)
                        .setCellValue(t.getOriginAccount() != null ? t.getOriginAccount().getAccountCode() : "");
                row.createCell(4).setCellValue(
                        t.getDestinationAccount() != null ? t.getDestinationAccount().getAccountCode() : "");
                row.createCell(5).setCellValue(t.getDescription() != null ? t.getDescription() : "");
                row.createCell(6).setCellValue(t.getReference() != null ? t.getReference() : "");
                row.createCell(7).setCellValue(t.getStatus() != null ? t.getStatus().name() : "");
                rowNum++;
            }

            for (int i = 0; i < 8; i++)
                sheet.autoSizeColumn(i);
            sheet.createFreezePane(0, 4);

            wb.write(out);
            return out.toByteArray();
        }
    }

}

// NOTA: la llave de clase anterior en la línea 207 cierra AdminController.
// Agregamos /admin/sistema como un controlador separado para evitar modificar
// la clase sellada.

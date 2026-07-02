package com.bankomunal.controller;

import com.bankomunal.entity.*;
import com.bankomunal.entity.User;
import com.bankomunal.service.DocumentoService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@RestController
@RequestMapping("/api/documentos")
@RequiredArgsConstructor
public class DocumentosController {

    private final DocumentoService documentoService;

    /** GET /api/documentos — listar documentos del socio autenticado */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listar(@AuthenticationPrincipal User user) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Documento doc : documentoService.misDocumentos(user)) {
            List<DocumentoVersion> versiones = documentoService.historialVersiones(doc);
            DocumentoVersion actual = versiones.isEmpty() ? null : versiones.get(0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", doc.getId());
            m.put("nombre", doc.getNombre());
            m.put("categoria", doc.getCategoria());
            m.put("nombreArchivo", actual != null ? actual.getNombreArchivo() : "");
            m.put("tamano", actual != null ? DocumentoService.formatTamano(actual.getTamanoBytes()) : "-");
            m.put("contentType", actual != null ? actual.getContentType() : "");
            m.put("createdAt", doc.getCreatedAt().toString());
            m.put("versionActual", doc.getVersionActual());
            m.put("versiones", versiones.stream().map(v -> {
                Map<String, Object> vm = new LinkedHashMap<>();
                vm.put("version", v.getVersion());
                vm.put("fecha", v.getCreatedAt().toString());
                vm.put("tamano", DocumentoService.formatTamano(v.getTamanoBytes()));
                return vm;
            }).toList());
            result.add(m);
        }
        return ResponseEntity.ok(result);
    }

    /** POST /api/documentos — subir documento nuevo (multipart) */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> subir(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "nombre", required = false) String nombre,
            @RequestParam(value = "categoria", required = false) String categoria,
            @AuthenticationPrincipal User user) {
        try {
            Documento doc = documentoService.subir(file, nombre, categoria, user);
            return ResponseEntity.ok(Map.of(
                    "id", doc.getId(), "nombre", doc.getNombre(), "categoria", doc.getCategoria(),
                    "mensaje", "Documento subido exitosamente."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    /**
     * POST /api/documentos/{id}/version — subir nueva versión de un documento
     * existente
     */
    @PostMapping(value = "/{id}/version", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> nuevaVersion(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User user) {
        try {
            Documento doc = documentoService.nuevaVersion(id, file, user);
            return ResponseEntity.ok(Map.of(
                    "id", doc.getId(), "versionActual", doc.getVersionActual(),
                    "mensaje", "Nueva versión subida exitosamente."));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("mensaje", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    /**
     * GET /api/documentos/{id}/preview — vista previa embebida (inline) de la
     * versión actual
     */
    @GetMapping("/{id}/preview")
    public ResponseEntity<?> preview(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return servirArchivo(id, user, false);
    }

    /**
     * GET /api/documentos/{id}/download — fuerza la descarga de la versión actual
     */
    @GetMapping("/{id}/download")
    public ResponseEntity<?> download(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return servirArchivo(id, user, true);
    }

    /**
     * GET /api/documentos/{id}/version/{v}/download — descarga una versión
     * específica
     */
    @GetMapping("/{id}/version/{v}/download")
    public ResponseEntity<?> downloadVersion(
            @PathVariable Long id, @PathVariable Integer v, @AuthenticationPrincipal User user) {
        try {
            Documento doc = documentoService.obtenerPropio(id, user);
            DocumentoVersion version = documentoService.historialVersiones(doc).stream()
                    .filter(x -> x.getVersion().equals(v)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Versión no encontrada."));
            return streamArchivo(version, true);
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("mensaje", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("mensaje", e.getMessage()));
        }
    }

    /** DELETE /api/documentos/{id} */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> eliminar(@PathVariable Long id, @AuthenticationPrincipal User user) {
        try {
            documentoService.eliminar(id, user);
            return ResponseEntity.ok(Map.of("mensaje", "Documento eliminado."));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("mensaje", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("mensaje", e.getMessage()));
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ResponseEntity<?> servirArchivo(Long documentoId, User user, boolean attachment) {
        try {
            Documento doc = documentoService.obtenerPropio(documentoId, user);
            DocumentoVersion version = documentoService.versionActual(doc);
            return streamArchivo(version, attachment);
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("mensaje", e.getMessage()));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.status(404).body(Map.of("mensaje", e.getMessage()));
        }
    }

    private ResponseEntity<?> streamArchivo(DocumentoVersion version, boolean attachment) {
        try {
            Path ruta = Paths.get(version.getRutaArchivo());
            if (!Files.exists(ruta))
                return ResponseEntity.status(404).body(Map.of("mensaje", "El archivo ya no existe en el servidor."));

            byte[] bytes = Files.readAllBytes(ruta);
            String contentType = version.getContentType() != null ? version.getContentType()
                    : "application/octet-stream";
            String disposicion = (attachment ? "attachment" : "inline")
                    + "; filename=\"" + sanitizar(version.getNombreArchivo()) + "\"";

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposicion)
                    .contentLength(bytes.length)
                    .body(new ByteArrayResource(bytes));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("mensaje", "Error al leer el archivo."));
        }
    }

    private String sanitizar(String nombre) {
        return nombre == null ? "documento" : nombre.replaceAll("[\"\\\\]", "_");
    }
}

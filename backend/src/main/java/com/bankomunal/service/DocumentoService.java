package com.bankomunal.service;

import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DocumentoService {

    private final DocumentoRepository documentoRepository;
    private final DocumentoVersionRepository versionRepository;

    /**
     * Carpeta privada — fuera de /uploads (que se sirve públicamente). El acceso
     * a estos archivos SIEMPRE pasa por DocumentosController, que valida dueño.
     */
    private static final Path RAIZ = Paths.get("private-uploads", "documentos");

    public List<Documento> misDocumentos(User user) {
        return documentoRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    public DocumentoVersion versionActual(Documento doc) {
        return versionRepository.findTopByDocumentoIdOrderByVersionDesc(doc.getId())
                .orElseThrow(() -> new IllegalStateException("El documento no tiene versiones."));
    }

    public List<DocumentoVersion> historialVersiones(Documento doc) {
        return versionRepository.findByDocumentoIdOrderByVersionDesc(doc.getId());
    }

    @Transactional
    public Documento subir(MultipartFile file, String nombre, String categoria, User user) {
        if (file == null || file.isEmpty())
            throw new IllegalArgumentException("El archivo está vacío.");
        if (file.getSize() > 10L * 1024 * 1024)
            throw new IllegalArgumentException("El archivo supera el límite de 10 MB.");

        Documento doc = documentoRepository.save(Documento.builder()
                .user(user)
                .nombre(nombre != null && !nombre.isBlank() ? nombre : file.getOriginalFilename())
                .categoria(categoria != null && !categoria.isBlank() ? categoria : "otro")
                .versionActual(1)
                .build());

        guardarVersion(doc, file, 1);
        return doc;
    }

    @Transactional
    public Documento nuevaVersion(Long documentoId, MultipartFile file, User user) {
        Documento doc = obtenerPropio(documentoId, user);
        if (file == null || file.isEmpty())
            throw new IllegalArgumentException("El archivo está vacío.");
        if (file.getSize() > 10L * 1024 * 1024)
            throw new IllegalArgumentException("El archivo supera el límite de 10 MB.");

        int nuevaVersion = doc.getVersionActual() + 1;
        guardarVersion(doc, file, nuevaVersion);
        doc.setVersionActual(nuevaVersion);
        doc.setUpdatedAt(LocalDateTime.now());
        return documentoRepository.save(doc);
    }

    private void guardarVersion(Documento doc, MultipartFile file, int version) {
        try {
            Path carpeta = RAIZ.resolve(String.valueOf(doc.getUser().getId()));
            Files.createDirectories(carpeta);
            String ext = getExtension(file.getOriginalFilename());
            String filename = "doc_" + doc.getId() + "_v" + version + "_" + UUID.randomUUID()
                    + (ext.isEmpty() ? "" : "." + ext);
            Path destino = carpeta.resolve(filename);
            Files.copy(file.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);

            versionRepository.save(DocumentoVersion.builder()
                    .documento(doc)
                    .version(version)
                    .nombreArchivo(file.getOriginalFilename() != null ? file.getOriginalFilename() : filename)
                    .rutaArchivo(destino.toString())
                    .contentType(file.getContentType())
                    .tamanoBytes(file.getSize())
                    .build());
        } catch (IOException e) {
            throw new RuntimeException("Error al guardar el documento: " + e.getMessage());
        }
    }

    @Transactional
    public void eliminar(Long documentoId, User user) {
        Documento doc = obtenerPropio(documentoId, user);
        historialVersiones(doc).forEach(v -> {
            try {
                Files.deleteIfExists(Paths.get(v.getRutaArchivo()));
            } catch (IOException ignored) {
            }
        });
        versionRepository.deleteAll(historialVersiones(doc));
        documentoRepository.delete(doc);
    }

    /**
     * Verifica que el documento exista y pertenezca al usuario autenticado (o sea
     * admin).
     */
    public Documento obtenerPropio(Long documentoId, User user) {
        Documento doc = documentoRepository.findById(documentoId)
                .orElseThrow(() -> new IllegalArgumentException("Documento no encontrado."));
        boolean esAdmin = user.getRoles().stream().anyMatch(r -> "admin".equalsIgnoreCase(r.getName()));
        if (!esAdmin && !doc.getUser().getId().equals(user.getId()))
            throw new SecurityException("No tienes permiso para acceder a este documento.");
        return doc;
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains("."))
            return "";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }

    public static String formatTamano(Long bytes) {
        if (bytes == null)
            return "-";
        if (bytes < 1024)
            return bytes + " B";
        if (bytes < 1024 * 1024)
            return String.format("%.0f KB", bytes / 1024.0);
        return String.format("%.2f MB", bytes / (1024.0 * 1024));
    }
}

package com.bankomunal.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class RegisterRequest {
    private String nombre;
    private String cedula;
    private String nombres;
    @NotBlank
    private String apellidos;
    private String tipoDoc;
    private String documento;
    private LocalDate fechaNacimiento;
    private String genero;
    private String telefono;
    @NotBlank
    @Email
    private String email;
    @NotBlank
    @Size(min = 6)
    private String password;
    private String direccion;
    private String ciudad;
    private String departamento;
    private String ocupacion;
    private boolean autorizaDatos;
}

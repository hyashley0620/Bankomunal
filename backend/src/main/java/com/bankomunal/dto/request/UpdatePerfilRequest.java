package com.bankomunal.dto.request;

import lombok.Data;

@Data
public class UpdatePerfilRequest {
    private String nombre;
    private String apellido;
    private String email;
    private String telefono;
    private String direccion;
    private String ciudad;
    private String departamento;
    private String ocupacion;
    private String cedula;
}

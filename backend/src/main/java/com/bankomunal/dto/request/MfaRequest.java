package com.bankomunal.dto.request;

import lombok.Data;

@Data
public class MfaRequest {
    private String email;
    private String codigo;
}

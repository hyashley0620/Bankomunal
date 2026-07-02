package com.bankomunal.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
public class WsNotificationPayload {
    private String titulo;
    private String mensaje;
}

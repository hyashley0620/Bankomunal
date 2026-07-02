-- ============================================================================
--  BANKOMUNAL
-- ============================================================================

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS,         UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE,
    SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ─────────────────────────────────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS `bankomunal`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `bankomunal`;


-- ============================================================================
-- BLOQUE 1: USUARIOS Y AUTENTICACIÓN
-- ============================================================================

-- ─── 1.1 Roles del sistema ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `roles` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(50)  NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 1.2 Usuarios ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `users` (
  `id`                    BIGINT        NOT NULL AUTO_INCREMENT,
  `first_name`            VARCHAR(100)  NOT NULL,
  `last_name`             VARCHAR(100)  NOT NULL,
  `email`                 VARCHAR(150)  NOT NULL UNIQUE,
  `password_hash`         VARCHAR(255)  NOT NULL,
  `tipo_documento`        VARCHAR(20)   NULL,
  `identification_number` VARCHAR(30)   NULL UNIQUE,
  `phone`                 VARCHAR(20)   NULL,
  `genero`                VARCHAR(20)   NULL,
  `fecha_nacimiento`      DATE          NULL,
  `direccion`             VARCHAR(300)  NULL,
  `ciudad`                VARCHAR(100)  NULL,
  `departamento`          VARCHAR(100)  NULL,
  `ocupacion`             VARCHAR(100)  NULL,
  `status`                ENUM('active','pending','suspended','blocked','deleted')
                          NOT NULL DEFAULT 'active',
  `credit_score`          INT           NULL DEFAULT 0,
  `nivel_riesgo`          ENUM('bajo','medio','alto') NULL DEFAULT 'bajo',
  `puntos`                INT           NOT NULL DEFAULT 0,
  `nivel`                 VARCHAR(50)   NOT NULL DEFAULT 'basico',
  `cedula_frontal_path`   VARCHAR(512)  NULL,
  `cedula_posterior_path` VARCHAR(512)  NULL,
  `selfie_path`           VARCHAR(512)  NULL     COMMENT 'foto de perfil',
  `failed_login_attempts` INT           NOT NULL DEFAULT 0,
  `last_failed_login`     DATETIME      NULL,
  `locked_until`          DATETIME      NULL,
  `active_token`          VARCHAR(512)  NULL
                          COMMENT 'JWT activo — NULL invalida todas las sesiones anteriores',
  `mfa_code`              VARCHAR(20)   NULL,
  `password_changed_at`   DATETIME      NULL,
  `mfa_expires_at`        DATETIME      NULL,
  `biometric_consent`     TINYINT(1)    NOT NULL DEFAULT 0,
  `autoriza_datos`        TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_users_email`  (`email`),
  INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 1.3 Tabla pivote usuario-rol ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` BIGINT NOT NULL,
  `role_id` BIGINT NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 1.4 Sesiones activas ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT       NOT NULL,
  `token_hash`   VARCHAR(255) NOT NULL,
  `ip_address`   VARCHAR(45)  NULL,
  `user_agent`   VARCHAR(512) NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`   DATETIME     NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 1.5 Tokens de recuperación de contraseña ────────────────────────────────
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT       NOT NULL,
  `token`      VARCHAR(255) NOT NULL UNIQUE,
  `used`       TINYINT(1)   NOT NULL DEFAULT 0,
  `expires_at` DATETIME     NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `frequent_contacts` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT,
  `owner_user_id` BIGINT       NOT NULL,
  `nombre`        VARCHAR(150) NOT NULL,
  `email`         VARCHAR(150) NOT NULL,
  `cuenta_numero` VARCHAR(50)  NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_owner_email` (`owner_user_id`, `email`),
  INDEX `idx_fc_owner` (`owner_user_id`),
  CONSTRAINT `fk_fc_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 1.6 Verificaciones de identidad ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `identity_verifications` (
  `id`          BIGINT      NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT      NOT NULL,
  `tipo`        VARCHAR(50) NULL,
  `status`      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `verified_at` DATETIME    NULL,
  `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_iv_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- BLOQUE 2: CUENTAS Y TRANSACCIONES
-- ============================================================================

-- ─── 2.1 Cuentas ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `accounts` (
  `id`             BIGINT        NOT NULL AUTO_INCREMENT,
  `account_code`   VARCHAR(50)   NOT NULL UNIQUE,
  `account_type`   ENUM('individual','group','fund') NOT NULL DEFAULT 'individual',
  `owner_user_id`  BIGINT        NULL,
  `owner_group_id` BIGINT        NULL,
  `balance`        DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `currency`       VARCHAR(3)    NOT NULL DEFAULT 'COP',
  `status`         ENUM('active','blocked','closed') NOT NULL DEFAULT 'active',
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_accounts_code`  (`account_code`),
  INDEX `idx_accounts_owner` (`owner_user_id`),
  CONSTRAINT `fk_acc_user` FOREIGN KEY (`owner_user_id`)
    REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 2.2 Transacciones ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `transactions` (
  `id`                     BIGINT        NOT NULL AUTO_INCREMENT,
  `tx_code`                VARCHAR(80)   NOT NULL UNIQUE,
  `type`                   ENUM(
                             'deposit',
                             'withdrawal',
                             'transfer',
                             'transfer_received',
                             'loan_disbursement',
                             'loan_payment',
                             'fee',
                             'adjustment'
                           ) NOT NULL,
  `origin_account_id`      BIGINT        NULL,
  `destination_account_id` BIGINT        NULL,
  `amount`                 DECIMAL(18,2) NOT NULL,
  `currency`               VARCHAR(3)    NOT NULL DEFAULT 'COP',
  `description`            VARCHAR(500)  NULL,
  `reference`              VARCHAR(120)  NULL,
  `status`                 ENUM('pending','completed','failed','reversed')
                           NOT NULL DEFAULT 'pending',
  `created_by`             BIGINT        NULL,
  `created_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tx_code`       (`tx_code`),
  INDEX `idx_tx_origin`     (`origin_account_id`),
  INDEX `idx_tx_dest`       (`destination_account_id`),
  INDEX `idx_tx_user_date`  (`created_by`, `created_at`),
  INDEX `idx_tx_type_date`  (`type`, `created_at`),
  CONSTRAINT `fk_tx_origin` FOREIGN KEY (`origin_account_id`)
    REFERENCES `accounts`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tx_dest` FOREIGN KEY (`destination_account_id`)
    REFERENCES `accounts`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tx_user` FOREIGN KEY (`created_by`)
    REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 2.3 Comprobantes de pago ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `transaction_receipts` (
  `id`                  BIGINT       NOT NULL AUTO_INCREMENT,
  `transaction_id`      BIGINT       NOT NULL,
  `referencia`          VARCHAR(120) NOT NULL,
  `cuenta_origen`       VARCHAR(50)  NULL,
  `cuenta_destino`      VARCHAR(50)  NULL,
  `tipo`                VARCHAR(50)  NULL,
  `descripcion`         VARCHAR(500) NULL,
  `estado`              VARCHAR(30)  NULL,
  `codigo_verificacion` VARCHAR(80)  NULL,
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_receipt_tx` FOREIGN KEY (`transaction_id`)
    REFERENCES `transactions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 2.4 Límites de transacción ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `transaction_limits` (
  `id`                  BIGINT        NOT NULL AUTO_INCREMENT,
  `scope`               ENUM('global','group','user') NOT NULL DEFAULT 'global',
  `scope_id`            BIGINT        NULL  COMMENT 'NULL = global',
  `tx_type`             VARCHAR(50)   NULL  COMMENT 'NULL = todos los tipos',
  `max_per_transaction` DECIMAL(18,2) NOT NULL DEFAULT 5000000.00,
  `max_per_day`         DECIMAL(18,2) NOT NULL DEFAULT 10000000.00,
  `max_per_week`        DECIMAL(18,2) NOT NULL DEFAULT 30000000.00,
  `updated_by`          BIGINT        NULL,
  `updated_at`          DATETIME      NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_txlimit_user` FOREIGN KEY (`updated_by`)
    REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 2.5 Pasarelas de pago ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payment_gateways` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `provider`    VARCHAR(50)  NOT NULL,
  `activo`      TINYINT(1)   NOT NULL DEFAULT 1,
  `descripcion` VARCHAR(255) NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 2.6 Transacciones de pasarela ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payment_gateway_transactions` (
  `id`             BIGINT        NOT NULL AUTO_INCREMENT,
  `gateway_id`     BIGINT        NOT NULL,
  `transaction_id` BIGINT        NULL,
  `external_ref`   VARCHAR(255)  NULL,
  `amount`         DECIMAL(18,2) NOT NULL,
  `status`         VARCHAR(50)   NULL,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_pgt_gateway` FOREIGN KEY (`gateway_id`)
    REFERENCES `payment_gateways`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pgt_tx` FOREIGN KEY (`transaction_id`)
    REFERENCES `transactions`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- BLOQUE 3: GRUPOS Y COMUNIDAD
-- ============================================================================

-- ─── 3.1 Grupos ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `groups` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(200)  NOT NULL,
  `tipo`         VARCHAR(50)   NOT NULL DEFAULT 'mixto'
                 COMMENT 'ahorro|credito|mixto',
  `descripcion`  VARCHAR(500)  NULL
                 COMMENT 'Descripción del grupo (antes: description TEXT)',
  `meta_ahorro`  DECIMAL(18,2) NULL DEFAULT 0.00,
  `fondo_comun`  DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `max_miembros` INT           NOT NULL DEFAULT 20,
  `status`       ENUM('active','inactive','dissolved') NOT NULL DEFAULT 'active',
  `created_by`   BIGINT        NULL,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_group_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 3.2 Miembros del grupo ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `group_members` (
  `id`         BIGINT   NOT NULL AUTO_INCREMENT,
  `group_id`   BIGINT   NOT NULL,
  `user_id`    BIGINT   NOT NULL,
  `role`       ENUM('presidente','tesorero','secretario','miembro')
               NOT NULL DEFAULT 'miembro'
               COMMENT 'Rol del miembro dentro del grupo',
  `status`     ENUM('active','suspended','expelled','removed')
               NOT NULL DEFAULT 'active',
  `joined_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_group_member` (`group_id`, `user_id`),
  INDEX `idx_gm_user` (`user_id`),
  CONSTRAINT `fk_gm_group` FOREIGN KEY (`group_id`)
    REFERENCES `groups`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gm_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 3.3 Roles dentro del grupo ────────────────
CREATE TABLE IF NOT EXISTS `group_roles` (
  `id`          BIGINT      NOT NULL AUTO_INCREMENT,
  `group_id`    BIGINT      NOT NULL,
  `user_id`     BIGINT      NOT NULL,
  `role`        VARCHAR(50) NOT NULL DEFAULT 'miembro'
                COMMENT 'administrador|tesorero|miembro',
  `assigned_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_gr_group` FOREIGN KEY (`group_id`)
    REFERENCES `groups`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gr_user`  FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 3.4 Reuniones del grupo ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `group_meetings` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `group_id`    BIGINT       NOT NULL,
  `titulo`      VARCHAR(200) NOT NULL,
  `descripcion` TEXT         NULL,
  `fecha`       DATETIME     NOT NULL,
  `lugar`       VARCHAR(300) NULL,
  `acta`        TEXT         NULL,
  `created_by`  BIGINT       NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_meeting_group`   FOREIGN KEY (`group_id`)
    REFERENCES `groups`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_meeting_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 3.5 Publicaciones de comunidad ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `community_posts` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT       NOT NULL,
  `group_id`     BIGINT       NULL,
  `contenido`    TEXT         NOT NULL,
  `imagen_url`   LONGTEXT     NULL
                 COMMENT 'Ampliado a LONGTEXT: antes VARCHAR(512) truncaba/rechazaba las fotos en base64',
  `tipo`         VARCHAR(20)  NOT NULL DEFAULT 'texto'
                 COMMENT 'texto|evento',
  `evento_fecha` DATE         NULL
                 COMMENT 'Fecha del evento cuando tipo=evento',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_post_user`  (`user_id`),
  INDEX `idx_post_group` (`group_id`),
  CONSTRAINT `fk_post_user`  FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_post_group` FOREIGN KEY (`group_id`)
    REFERENCES `groups`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 3.5.1 Me gusta de publicaciones ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `community_post_likes` (
  `id`         BIGINT   NOT NULL AUTO_INCREMENT,
  `post_id`    BIGINT   NOT NULL,
  `user_id`    BIGINT   NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_post_like` (`post_id`, `user_id`),
  INDEX `idx_like_user` (`user_id`),
  CONSTRAINT `fk_like_post` FOREIGN KEY (`post_id`)
    REFERENCES `community_posts`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_like_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 3.6 Eventos de comunidad ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `community_events` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `group_id`    BIGINT       NULL,
  `titulo`      VARCHAR(200) NOT NULL,
  `descripcion` TEXT         NULL,
  `tipo`        VARCHAR(50)  NOT NULL DEFAULT 'reunion'
                COMMENT 'reunion|taller|asamblea|capacitacion',
  `fecha`       DATE         NOT NULL,
  `hora`        TIME         NULL,
  `lugar`       VARCHAR(255) NULL,
  `created_by`  BIGINT       NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_event_group`   FOREIGN KEY (`group_id`)
    REFERENCES `groups`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_event_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- BLOQUE 4: PRÉSTAMOS
-- ============================================================================

-- ─── 4.1 Préstamos ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `loans` (
  `id`                   BIGINT        NOT NULL AUTO_INCREMENT,
  `loan_code`            VARCHAR(80)   NOT NULL UNIQUE,
  `borrower_user_id`     BIGINT        NOT NULL,
  `group_id`             BIGINT        NULL,
  `monto_solicitado`     DECIMAL(18,2) NOT NULL,
  `monto_aprobado`       DECIMAL(18,2) NULL,
  `principal`            DECIMAL(18,2) NULL
                         COMMENT 'Monto original — Java: @Column(name="principal")',
  `plazo_meses`          INT           NOT NULL,
  `tasa_interes_mensual` DECIMAL(5,4)  NOT NULL DEFAULT 0.0200
                         COMMENT 'Java: @Column(name="tasa_interes_mensual")',
  `cuota_mensual`        DECIMAL(18,2) NULL,
  `saldo_pendiente`      DECIMAL(18,2) NULL,
  `cuotas_pagadas`       INT           NOT NULL DEFAULT 0,
  `motivo`               VARCHAR(500)  NULL,
  `status`               ENUM('pending','approved','active','paid','rejected','defaulted')
                         NOT NULL DEFAULT 'pending',
  `disbursed_at`         DATETIME      NULL,
  `fecha_vencimiento`    DATE          NULL,
  `approved_at`          DATETIME      NULL,
  `created_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_loans_user_status` (`borrower_user_id`, `status`),
  INDEX `idx_loan_status`       (`status`),
  CONSTRAINT `fk_loan_user`  FOREIGN KEY (`borrower_user_id`)
    REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_loan_group` FOREIGN KEY (`group_id`)
    REFERENCES `groups`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 4.2 Cuotas de préstamos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `loan_payments` (
  `id`                BIGINT        NOT NULL AUTO_INCREMENT,
  `loan_id`           BIGINT        NOT NULL,
  `numero_cuota`      INT           NOT NULL,
  `fecha_vencimiento` DATE          NULL,
  `fecha_pago`        DATE          NULL,
  `total_cuota`       DECIMAL(18,2) NOT NULL,
  `monto_capital`     DECIMAL(18,2) NULL,
  `monto_interes`     DECIMAL(18,2) NULL,
  `saldo_restante`    DECIMAL(18,2) NULL,
  `status`            ENUM('pending','paid','overdue') NOT NULL DEFAULT 'pending',
  `created_at`        DATETIME      NULL,
  `transaction_id`    BIGINT        NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_lp_loan` (`loan_id`),
  CONSTRAINT `fk_lp_loan` FOREIGN KEY (`loan_id`)
    REFERENCES `loans`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_lp_tx` FOREIGN KEY (`transaction_id`)
    REFERENCES `transactions`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 4.3 Historial de riesgo crediticio ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `credit_risk_history` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT       NOT NULL,
  `score`      INT          NOT NULL,
  `nivel`      VARCHAR(20)  NULL,
  `motivo`     VARCHAR(255) NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_crh_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 4.4 Metas de ahorro ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `savings_goals` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT        NOT NULL,
  `nombre`       VARCHAR(200)  NOT NULL,
  `meta`         DECIMAL(18,2) NOT NULL,
  `acumulado`    DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `fecha_limite` DATE          NULL,
  `status`       ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_sg_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 4.5 Fondos de emergencia ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `emergency_funds` (
  `id`         BIGINT        NOT NULL AUTO_INCREMENT,
  `group_id`   BIGINT        NOT NULL,
  `balance`    DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ef_group` FOREIGN KEY (`group_id`)
    REFERENCES `groups`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- BLOQUE 5: NOTIFICACIONES
-- ============================================================================

-- ─── 5.1 Notificaciones ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT       NOT NULL,
  `titulo`     VARCHAR(200) NOT NULL,
  `mensaje`    TEXT         NOT NULL,
  `type`       VARCHAR(50)  NULL
               COMMENT 'transfer_sent|transfer_received|loan_disbursed|loan_payment|loan_pending|loan_rejected|payment',
  `read`       TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notifications_user_read` (`user_id`, `read`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 5.2 Preferencias de notificación ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notification_preferences` (
  `id`           BIGINT     NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT     NOT NULL UNIQUE,
  `notif_email`  TINYINT(1) NOT NULL DEFAULT 1,
  `notif_push`   TINYINT(1) NOT NULL DEFAULT 1,
  `notif_sms`    TINYINT(1) NOT NULL DEFAULT 0,
  `alerta_saldo` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at`   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_np_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- BLOQUE 6: EDUCACIÓN FINANCIERA
-- ============================================================================

CREATE TABLE IF NOT EXISTS `courses` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `titulo`       VARCHAR(200) NOT NULL,
  `descripcion`  TEXT         NULL,
  `categoria`    VARCHAR(50)  NOT NULL DEFAULT 'general',
  `nivel`        ENUM('basico','intermedio','avanzado') NOT NULL DEFAULT 'basico',
  `duracion_min` INT          NULL DEFAULT 30,
  `puntos`       INT          NOT NULL DEFAULT 100,
  `activo`       TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_lessons` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `course_id`    BIGINT       NOT NULL,
  `titulo`       VARCHAR(200) NOT NULL,
  `contenido`    TEXT         NULL,
  `orden`        INT          NOT NULL DEFAULT 1,
  `duracion_min` INT          NULL DEFAULT 10,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_lesson_course` FOREIGN KEY (`course_id`)
    REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_progress` (
  `id`             BIGINT     NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT     NOT NULL,
  `course_id`      BIGINT     NOT NULL,
  `leccion_actual` INT        NOT NULL DEFAULT 0,
  `completado`     TINYINT(1) NOT NULL DEFAULT 0,
  `puntos_ganados` INT        NOT NULL DEFAULT 0,
  `cert_emitido`   TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at`     DATETIME   NULL,
  `started_at`     DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at`   DATETIME   NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_progress` (`user_id`, `course_id`),
  CONSTRAINT `fk_cp_user`   FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_cp_course` FOREIGN KEY (`course_id`)
    REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `certificates` (
  `id`        BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`   BIGINT       NOT NULL,
  `course_id` BIGINT       NOT NULL,
  `codigo`    VARCHAR(100) NOT NULL UNIQUE,
  `titulo`    VARCHAR(200) NULL,
  `issued_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_cert_user`   FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_cert_course` FOREIGN KEY (`course_id`)
    REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- BLOQUE 7: DOCUMENTOS Y SOPORTE
-- ============================================================================

CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL,
  `asunto`      VARCHAR(300) NOT NULL,
  `descripcion` TEXT         NULL,
  `categoria`   VARCHAR(50)  NULL DEFAULT 'general',
  `status`      ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ticket_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id`          BIGINT     NOT NULL AUTO_INCREMENT,
  `sender_id`   BIGINT     NOT NULL,
  `receiver_id` BIGINT     NULL,
  `group_id`    BIGINT     NULL,
  `mensaje`     TEXT       NOT NULL,
  `leido`       TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_chat_sender`   (`sender_id`),
  INDEX `idx_chat_receiver` (`receiver_id`),
  CONSTRAINT `fk_chat_sender`   FOREIGN KEY (`sender_id`)
    REFERENCES `users`(`id`)  ON DELETE CASCADE,
  CONSTRAINT `fk_chat_receiver` FOREIGN KEY (`receiver_id`)
    REFERENCES `users`(`id`)  ON DELETE SET NULL,
  CONSTRAINT `fk_chat_group`    FOREIGN KEY (`group_id`)
    REFERENCES `groups`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- BLOQUE 8: ENCUESTAS Y VOTACIONES
-- ============================================================================

-- ─── 8.1 Encuestas ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `polls` (
  `id`                  BIGINT       NOT NULL AUTO_INCREMENT,
  `group_id`            BIGINT       NULL,
  `created_by`          BIGINT       NOT NULL,
  `titulo`              VARCHAR(300) NOT NULL,
  `descripcion`         TEXT         NULL,
  `is_rule_change`      TINYINT(1)   NOT NULL DEFAULT 0,
  `is_anonymous`        TINYINT(1)   NOT NULL DEFAULT 0,
  `approval_threshold`  INT          NOT NULL DEFAULT 51
                        COMMENT 'Porcentaje mínimo para aprobar (antes: umbral)',
  `status`              ENUM('open','closed','approved','rejected')
                        NOT NULL DEFAULT 'open',
  `ends_at`             DATETIME     NULL
                        COMMENT 'Fecha/hora de cierre automático (antes: closes_at)',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_poll_ends`    (`ends_at`, `status`),
  CONSTRAINT `fk_poll_group`   FOREIGN KEY (`group_id`)
    REFERENCES `groups`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_poll_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users`(`id`)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 8.2 Opciones de encuesta ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `poll_options` (
  `id`      BIGINT       NOT NULL AUTO_INCREMENT,
  `poll_id` BIGINT       NOT NULL,
  `texto`   VARCHAR(300) NOT NULL,
  `orden`   INT          NOT NULL DEFAULT 1,
  `votos`   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_option_poll` FOREIGN KEY (`poll_id`)
    REFERENCES `polls`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 8.3 Votos ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `poll_votes` (
  `id`        BIGINT   NOT NULL AUTO_INCREMENT,
  `poll_id`   BIGINT   NOT NULL,
  `option_id` BIGINT   NOT NULL,
  `user_id`   BIGINT   NOT NULL,
  `voted_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vote` (`poll_id`, `user_id`),
  CONSTRAINT `fk_vote_poll`   FOREIGN KEY (`poll_id`)
    REFERENCES `polls`(`id`)        ON DELETE CASCADE,
  CONSTRAINT `fk_vote_option` FOREIGN KEY (`option_id`)
    REFERENCES `poll_options`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vote_user`   FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- BLOQUE 9: BENEFICIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `beneficios` (
  `id`            BIGINT        NOT NULL AUTO_INCREMENT,
  `titulo`        VARCHAR(200)  NOT NULL,
  `descripcion`   TEXT          NULL,
  `tipo`          VARCHAR(50)   NOT NULL DEFAULT 'general'
                  COMMENT 'taller|seguro|tasa_especial|descuento',
  `tasa_especial` DECIMAL(5,2)  NULL,
  `nivel_minimo`  VARCHAR(50)   NOT NULL DEFAULT 'basico'
                  COMMENT 'basico|plata|oro|platino',
  `costo_puntos`  INT           NULL
                  COMMENT 'Puntos necesarios para canjear. NULL/0 = no se canjea con puntos.',
  `activo`        TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `points_transactions` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT       NOT NULL,
  `tipo`         ENUM('GANADO','CANJEADO','AJUSTE') NOT NULL,
  `puntos`       INT          NOT NULL COMMENT 'Negativo en CANJEADO',
  `descripcion`  VARCHAR(255) NULL,
  `beneficio_id` BIGINT       NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_points_user` (`user_id`),
  CONSTRAINT `fk_points_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_points_beneficio` FOREIGN KEY (`beneficio_id`)
    REFERENCES `beneficios`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `beneficio_canjes` (
  `id`           BIGINT      NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT      NOT NULL,
  `beneficio_id` BIGINT      NOT NULL,
  `codigo`       VARCHAR(50) NULL,
  `estado`       ENUM('pendiente','usado','vencido') NOT NULL DEFAULT 'pendiente',
  `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_canje_user`      FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`)      ON DELETE CASCADE,
  CONSTRAINT `fk_canje_beneficio` FOREIGN KEY (`beneficio_id`)
    REFERENCES `beneficios`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─── Gestión documental ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `documentos` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT       NOT NULL,
  `nombre`         VARCHAR(200) NOT NULL,
  `categoria`      VARCHAR(30)  NOT NULL DEFAULT 'otro'
                   COMMENT 'contrato|estado_financiero|identidad|reporte|acta|otro',
  `version_actual` INT          NOT NULL DEFAULT 1,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_doc_user` (`user_id`),
  CONSTRAINT `fk_doc_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `documento_versiones` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `documento_id`   BIGINT       NOT NULL,
  `version`        INT          NOT NULL,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `ruta_archivo`   VARCHAR(500) NOT NULL,
  `content_type`   VARCHAR(120) NULL,
  `tamano_bytes`   BIGINT       NULL,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_docver_doc` (`documento_id`),
  CONSTRAINT `fk_docver_doc` FOREIGN KEY (`documento_id`)
    REFERENCES `documentos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Educación financiera — progreso y certificados ──────────────

CREATE TABLE IF NOT EXISTS `curso_progreso` (
  `id`                  BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`             BIGINT       NOT NULL,
  `curso_id`            VARCHAR(50)  NOT NULL,
  `curso_nombre`        VARCHAR(200) NULL,
  `leccion_actual`      INT          NOT NULL DEFAULT 0,
  `completado`          TINYINT(1)   NOT NULL DEFAULT 0,
  `certificado`         TINYINT(1)   NOT NULL DEFAULT 0,
  `codigo_certificado`  VARCHAR(50)  NULL,
  `puntos`              INT          NULL,
  `fecha_completado`    DATETIME     NULL,
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_curso_user` (`user_id`, `curso_id`),
  CONSTRAINT `fk_progreso_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- BLOQUE 10: CONFIGURACIÓN Y AUDITORÍA
-- ============================================================================

CREATE TABLE IF NOT EXISTS `system_config` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `config_key`   VARCHAR(100) NOT NULL UNIQUE,
  `config_value` VARCHAR(500) NOT NULL,
  `descripcion`  VARCHAR(300) NULL,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NULL,
  `event_type`  VARCHAR(80)  NOT NULL,
  `object_type` VARCHAR(80)  NULL,
  `object_id`   BIGINT       NULL,
  `description` TEXT         NULL,
  `ip_address`  VARCHAR(45)  NULL,
  `user_agent`  VARCHAR(512) NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_user`    (`user_id`),
  INDEX `idx_audit_event`   (`event_type`),
  INDEX `idx_audit_created` (`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `report_templates` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `nombre`     VARCHAR(200) NOT NULL,
  `tipo`       VARCHAR(50)  NULL,
  `contenido`  TEXT         NULL,
  `activo`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- BLOQUE 11: DATOS INICIALES
-- ============================================================================

-- ─── 11.1 Roles del sistema ──────────────────────────────────────────────────
INSERT IGNORE INTO `roles` (`name`, `description`) VALUES
  ('admin',      'Administrador del sistema con acceso total'),
  ('socio',      'Socio regular con acceso a funciones básicas'),
  ('tesorero',   'Tesorero del grupo'),
  ('secretario', 'Secretario del grupo'),
  ('auditor',    'Auditor con acceso de solo lectura');

-- ─── 11.2 Configuración del sistema ──────────────────────────────────────────
INSERT IGNORE INTO `system_config` (`config_key`, `config_value`, `descripcion`) VALUES
  ('tasa_interes_default',    '0.0200', 'Tasa de interés mensual por defecto (2.0%)'),
  ('max_plazo_meses',         '36',     'Plazo máximo en meses para créditos'),
  ('min_cuota_ahorro',        '50000',  'Aporte mínimo mensual de ahorro en COP'),
  ('limite_tx_diario',        '5000000','Límite de transacciones diarias por usuario en COP'),
  ('limite_tx_por_operacion', '2000000','Límite por operación individual en COP'),
  ('sesion_timeout_min',      '30',     'Minutos antes de cerrar sesión por inactividad'),
  ('max_intentos_login',      '5',      'Intentos fallidos antes de bloquear la cuenta'),
  ('bloqueo_minutos',         '15',     'Minutos de bloqueo tras superar max_intentos_login'),
  ('version_sistema',         '4.0',    'Versión actual del sistema Bankomunal');

-- ─── 11.3 Límites de transacción globales ────────────────────────────────────
INSERT IGNORE INTO `transaction_limits`
  (`scope`, `scope_id`, `tx_type`, `max_per_transaction`, `max_per_day`, `max_per_week`)
VALUES
  ('global', NULL, NULL,       5000000.00, 10000000.00, 30000000.00),
  ('global', NULL, 'transfer', 2000000.00,  5000000.00, 15000000.00),
  ('global', NULL, 'fee',       500000.00,  2000000.00,  5000000.00);

-- ─── 11.4 Pasarelas de pago ──────────────────────────────────────────────────
INSERT IGNORE INTO `payment_gateways` (`provider`, `activo`, `descripcion`) VALUES
  ('PSE',         1, 'Pagos Seguros en Línea — Transferencias bancarias Colombia'),
  ('Nequi',       1, 'Billetera digital Nequi'),
  ('Daviplata',   1, 'Billetera digital Daviplata'),
  ('Efecty',      0, 'Pagos en efectivo Efecty'),
  ('Bancolombia', 1, 'Transferencias Bancolombia');

-- ─── 11.5 Cursos de educación financiera ─────────────────────────────────────
INSERT IGNORE INTO `courses`
  (`titulo`, `descripcion`, `categoria`, `nivel`, `duracion_min`, `puntos`)
VALUES
  ('Fundamentos del Ahorro',
   'Aprende a crear hábitos de ahorro efectivos y metas financieras alcanzables.',
   'ahorro', 'basico', 45, 100),
  ('Crédito Responsable',
   'Entiende cómo funciona el crédito, la tasa de interés y la amortización.',
   'credito', 'basico', 60, 150),
  ('Inversión Básica',
   'Primeros pasos en el mundo de la inversión: CDT, fondos y más.',
   'inversion', 'intermedio', 90, 200),
  ('Gestión de Deudas',
   'Estrategias para salir de deudas y mejorar tu salud financiera.',
   'deudas', 'intermedio', 60, 150),
  ('Presupuesto Personal',
   'Cómo crear y mantener un presupuesto personal efectivo.',
   'ahorro', 'basico', 30, 100);

-- ─── 11.6 Beneficios ─────────────────────────────────────────────────────────

INSERT IGNORE INTO `beneficios`
  (`titulo`, `descripcion`, `tipo`, `tasa_especial`, `nivel_minimo`, `costo_puntos`)
VALUES
  ('Tasa Preferencial',           'Préstamos con tasa del 1.2% mensual para socios activos',     'tasa_especial', 1.20, 'basico', NULL),
  ('Taller Finanzas Personales',  'Acceso gratuito a talleres de educación financiera',           'taller',        NULL,  'basico', 50),
  ('Seguro de Vida Grupal',       'Cobertura grupal incluida en la membresía Bankomunal',         'seguro',        NULL,  'basico', NULL),
  ('Descuento Comercios Aliados', '10% de descuento en comercios aliados con tu código QR',       'descuento',     NULL,  'plata',  30),
  ('Abono a Capital',             'Canjea tus puntos por un abono directo a capital de tu crédito activo.', 'abono_capital', NULL, 'basico', 100);

-- ─── 11.7 Eventos de comunidad de ejemplo ────────────────────────────────────
INSERT IGNORE INTO `community_events` (`titulo`, `descripcion`, `tipo`, `fecha`) VALUES
  ('Reunión mensual del grupo',  'Revisión de aportes y créditos del mes',   'reunion',  DATE_ADD(CURDATE(), INTERVAL 7  DAY)),
  ('Taller: Ahorro e Inversión', 'Capacitación en estrategias de inversión', 'taller',   DATE_ADD(CURDATE(), INTERVAL 14 DAY)),
  ('Asamblea General Ordinaria', 'Revisión de reglamento y nuevos miembros', 'asamblea', DATE_ADD(CURDATE(), INTERVAL 30 DAY));

-- ─── 11.8 Activar usuarios de prueba ─────────────────────────────────────────

UPDATE `users`
SET    `status` = 'active'
WHERE  `email` IN (
         'admin@bankomunal.com',
         'carlos@test.com',
         'laura@test.com',
         'pedro@test.com'
       )
  AND  `status` != 'active';

-- ─── 11.9 encuestas y comunidad ─────────────────────────────────────────

INSERT IGNORE INTO `polls` (`id`, `group_id`, `created_by`, `titulo`, `descripcion`, `is_rule_change`, `is_anonymous`, `approval_threshold`, `status`, `ends_at`, `created_at`)
SELECT 1, NULL, u.id, '¿Aumentar la cuota de ahorro mensual?',
    'Propuesta de incrementar la cuota mínima de $50.000 a $75.000 mensuales.',
    1, 0, 66, 'open', DATE_ADD(NOW(), INTERVAL 7 DAY), NOW()
FROM `users` u WHERE u.email IS NOT NULL LIMIT 1;

INSERT IGNORE INTO `poll_options` (`poll_id`, `texto`, `orden`, `votos`)
SELECT 1, 'Sí, aumentar a $75.000', 1, 0
WHERE EXISTS (SELECT 1 FROM `polls` WHERE `id` = 1);

INSERT IGNORE INTO `poll_options` (`poll_id`, `texto`, `orden`, `votos`)
SELECT 1, 'No, mantener en $50.000', 2, 0
WHERE EXISTS (SELECT 1 FROM `polls` WHERE `id` = 1);

INSERT IGNORE INTO `poll_options` (`poll_id`, `texto`, `orden`, `votos`)
SELECT 1, 'Aumentar a $60.000 como punto medio', 3, 0
WHERE EXISTS (SELECT 1 FROM `polls` WHERE `id` = 1);

INSERT IGNORE INTO `polls` (`id`, `group_id`, `created_by`, `titulo`, `descripcion`, `is_rule_change`, `is_anonymous`, `approval_threshold`, `status`, `created_at`)
SELECT 2, NULL, u.id, '¿Cuándo realizar la reunión mensual?',
    'Definir el día de la semana más conveniente para todos los socios.',
    0, 1, 51, 'open', NOW()
FROM `users` u WHERE u.email IS NOT NULL LIMIT 1;

INSERT IGNORE INTO `poll_options` (`poll_id`, `texto`, `orden`, `votos`)
SELECT 2, 'Sábado por la mañana', 1, 0
WHERE EXISTS (SELECT 1 FROM `polls` WHERE `id` = 2);

INSERT IGNORE INTO `poll_options` (`poll_id`, `texto`, `orden`, `votos`)
SELECT 2, 'Domingo por la tarde', 2, 0
WHERE EXISTS (SELECT 1 FROM `polls` WHERE `id` = 2);

INSERT IGNORE INTO `poll_options` (`poll_id`, `texto`, `orden`, `votos`)
SELECT 2, 'Viernes por la noche', 3, 0
WHERE EXISTS (SELECT 1 FROM `polls` WHERE `id` = 2);

-- Publicación de comunidad de ejemplo
INSERT IGNORE INTO `community_posts` (`id`, `user_id`, `contenido`, `created_at`)
SELECT 1, u.id, '¡Bienvenidos a Bankomunal! Este es nuestro espacio comunitario. Aquí podremos compartir novedades, hacer preguntas y mantenernos conectados.', NOW()
FROM `users` u WHERE u.email IS NOT NULL LIMIT 1;

-- ============================================================================
-- RESTAURAR CONFIGURACIÓN
-- ============================================================================
SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
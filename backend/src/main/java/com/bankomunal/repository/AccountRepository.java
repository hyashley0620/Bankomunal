package com.bankomunal.repository;

import com.bankomunal.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AccountRepository extends JpaRepository<Account, Long> {
    List<Account> findByOwnerUserIdAndStatus(Long userId, Account.AccountStatus status);

    List<Account> findByOwnerUserId(Long userId);

    Optional<Account> findByAccountCode(String accountCode);

    /**
     * Primera cuenta individual activa del usuario (usada como 'cuenta' en sesión)
     */
    Optional<Account> findFirstByOwnerUserIdAndAccountTypeAndStatus(
            Long userId,
            Account.AccountType type,
            Account.AccountStatus status);
}

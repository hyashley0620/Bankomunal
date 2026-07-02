package com.bankomunal.repository;

import com.bankomunal.entity.TransactionLimit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TransactionLimitRepository extends JpaRepository<TransactionLimit, Long> {
    Optional<TransactionLimit> findFirstByScopeOrderByIdDesc(TransactionLimit.Scope scope);
}

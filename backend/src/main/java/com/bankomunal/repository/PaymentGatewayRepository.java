package com.bankomunal.repository;

import com.bankomunal.entity.PaymentGateway;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PaymentGatewayRepository extends JpaRepository<PaymentGateway, Long> {
    List<PaymentGateway> findByActivoTrue();
}

package com.bankomunal.repository;

import com.bankomunal.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

       @Query("SELECT t FROM Transaction t WHERE " +
                     "(t.originAccount.id IN (SELECT a.id FROM Account a WHERE a.ownerUser.id = :uid) OR " +
                     " t.destinationAccount.id IN (SELECT a.id FROM Account a WHERE a.ownerUser.id = :uid)) " +
                     "ORDER BY t.createdAt DESC")
       List<Transaction> findByUserId(@Param("uid") Long userId);

       @Query("SELECT t FROM Transaction t WHERE " +
                     "(t.originAccount.id IN (SELECT a.id FROM Account a WHERE a.ownerUser.id = :uid) OR " +
                     " t.destinationAccount.id IN (SELECT a.id FROM Account a WHERE a.ownerUser.id = :uid)) " +
                     "AND t.createdAt BETWEEN :inicio AND :fin ORDER BY t.createdAt DESC")
       List<Transaction> findByUserIdAndDateRange(
                     @Param("uid") Long userId,
                     @Param("inicio") LocalDateTime inicio,
                     @Param("fin") LocalDateTime fin);

       @Query("SELECT COALESCE(SUM(t.amount),0) FROM Transaction t " +
                     "WHERE t.type IN ('deposit','loan_disbursement','transfer_received') " +
                     "AND t.createdAt BETWEEN :inicio AND :fin")
       BigDecimal sumIngresosByDateRange(
                     @Param("inicio") LocalDateTime inicio,
                     @Param("fin") LocalDateTime fin);

       @Query("SELECT COALESCE(SUM(t.amount),0) FROM Transaction t " +
                     "WHERE t.type IN ('withdrawal','loan_payment','fee','transfer') " +
                     "AND t.createdAt BETWEEN :inicio AND :fin")
       BigDecimal sumEgresosByDateRange(
                     @Param("inicio") LocalDateTime inicio,
                     @Param("fin") LocalDateTime fin);

       @Query("SELECT t FROM Transaction t ORDER BY t.createdAt DESC")
       List<Transaction> findAllOrderByCreatedAtDesc();

       /**
        * Total pagado en cuotas de préstamo completadas — base para calcular puntos
        * ganados.
        */
       @Query("SELECT COALESCE(SUM(t.amount),0) FROM Transaction t " +
                     "WHERE t.type = 'loan_payment' AND t.status = 'completed' " +
                     "AND t.originAccount.id IN (SELECT a.id FROM Account a WHERE a.ownerUser.id = :uid)")
       BigDecimal sumPagosPrestamoCompletados(@Param("uid") Long userId);
}

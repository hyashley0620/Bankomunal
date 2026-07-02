package com.bankomunal.repository;

import com.bankomunal.entity.Certificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CertificateRepository extends JpaRepository<Certificate, Long> {
    List<Certificate> findByUserId(Long userId);

    boolean existsByUserIdAndCourseId(Long userId, Long courseId);
}

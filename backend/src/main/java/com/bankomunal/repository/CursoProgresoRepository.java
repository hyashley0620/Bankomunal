package com.bankomunal.repository;

import com.bankomunal.entity.CursoProgreso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CursoProgresoRepository extends JpaRepository<CursoProgreso, Long> {
    List<CursoProgreso> findByUserId(Long userId);

    List<CursoProgreso> findByUserIdAndCertificadoTrue(Long userId);

    Optional<CursoProgreso> findByUserIdAndCursoId(Long userId, String cursoId);
}

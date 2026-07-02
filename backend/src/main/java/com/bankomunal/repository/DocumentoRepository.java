package com.bankomunal.repository;

import com.bankomunal.entity.Documento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DocumentoRepository extends JpaRepository<Documento, Long> {
    List<Documento> findByUserIdOrderByCreatedAtDesc(Long userId);
}

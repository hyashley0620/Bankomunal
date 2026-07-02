package com.bankomunal.repository;

import com.bankomunal.entity.CommunityPostLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CommunityPostLikeRepository extends JpaRepository<CommunityPostLike, Long> {
    long countByPostId(Long postId);

    boolean existsByPostIdAndUserId(Long postId, Long userId);

    Optional<CommunityPostLike> findByPostIdAndUserId(Long postId, Long userId);

    List<CommunityPostLike> findByUserIdAndPostIdIn(Long userId, List<Long> postIds);

    void deleteByPostIdAndUserId(Long postId, Long userId);
}

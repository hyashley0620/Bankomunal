package com.bankomunal.repository;

import com.bankomunal.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    @Query("SELECT m FROM ChatMessage m WHERE " +
            "(m.sender.id = :u1 AND m.receiver.id = :u2) OR " +
            "(m.sender.id = :u2 AND m.receiver.id = :u1) " +
            "ORDER BY m.createdAt ASC")
    List<ChatMessage> findConversation(@Param("u1") Long u1, @Param("u2") Long u2);

    List<ChatMessage> findByGroupIdOrderByCreatedAtAsc(Long groupId);

    long countBySenderIdAndLeidoFalse(Long senderId);
}

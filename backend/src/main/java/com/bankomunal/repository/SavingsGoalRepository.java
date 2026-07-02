package com.bankomunal.repository;

import com.bankomunal.entity.SavingsGoal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SavingsGoalRepository extends JpaRepository<SavingsGoal, Long> {
    List<SavingsGoal> findByUserIdAndStatus(Long userId, SavingsGoal.GoalStatus status);

    List<SavingsGoal> findByGroupId(Long groupId);
}

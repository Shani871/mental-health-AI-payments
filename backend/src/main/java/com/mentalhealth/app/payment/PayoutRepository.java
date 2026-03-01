package com.mentalhealth.app.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface PayoutRepository extends JpaRepository<Payout, UUID> {
    List<Payout> findByTherapist_User_IdOrderByCreatedAtDesc(UUID therapistUserId);

    List<Payout> findByStatusOrderByCreatedAtAsc(PayoutStatus status);

    @Query("select coalesce(sum(p.amount), 0) from Payout p where p.therapist.user.id = :therapistUserId and p.status = :status")
    BigDecimal sumAmountByTherapistUserIdAndStatus(@Param("therapistUserId") UUID therapistUserId,
            @Param("status") PayoutStatus status);
}

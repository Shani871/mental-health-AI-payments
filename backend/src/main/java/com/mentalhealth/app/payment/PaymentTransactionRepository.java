package com.mentalhealth.app.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, UUID> {
    Optional<PaymentTransaction> findByBookingId(UUID bookingId);

    Optional<PaymentTransaction> findByGatewayOrderId(String gatewayOrderId);

    List<PaymentTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<PaymentTransaction> findByTherapist_User_IdOrderByCreatedAtDesc(UUID therapistUserId);

    @Query("select coalesce(sum(p.therapistEarning), 0) from PaymentTransaction p where p.therapist.user.id = :therapistUserId and p.status = :status")
    BigDecimal sumTherapistEarningByTherapistUserIdAndStatus(@Param("therapistUserId") UUID therapistUserId,
            @Param("status") PaymentStatus status);
}

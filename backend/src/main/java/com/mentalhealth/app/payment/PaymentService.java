package com.mentalhealth.app.payment;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import jakarta.annotation.PostConstruct;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

@Service
public class PaymentService {

    @Value("${razorpay.keyId}")
    private String keyId;

    @Value("${razorpay.keySecret}")
    private String keySecret;

    private RazorpayClient client;

    @PostConstruct
    public void init() throws RazorpayException {
        this.client = new RazorpayClient(keyId, keySecret);
    }

    public String createOrder(BigDecimal amount, String currency, String receipt) throws RazorpayException {
        JSONObject orderRequest = new JSONObject();
        // Razorpay expects amount in paise (multiply by 100)
        orderRequest.put("amount", amount.multiply(new BigDecimal(100)).intValue());
        orderRequest.put("currency", currency);
        orderRequest.put("receipt", receipt);

        Order order = client.orders.create(orderRequest);
        return order.get("id");
    }

    public boolean verifyPayment(String orderId, String paymentId, String signature) {
        try {
            JSONObject attributes = new JSONObject();
            attributes.put("razorpay_order_id", orderId);
            attributes.put("razorpay_payment_id", paymentId);
            attributes.put("razorpay_signature", signature);

            return Utils.verifyPaymentSignature(attributes, keySecret);
        } catch (RazorpayException e) {
            return false;
        }
    }

    public BigDecimal calculateTherapistPayout(BigDecimal totalAmount) {
        // Platform takes 30% commission
        BigDecimal commissionRate = new BigDecimal("0.30");
        BigDecimal commission = totalAmount.multiply(commissionRate);
        return totalAmount.subtract(commission);
    }

    public boolean refundPayment(String paymentId, BigDecimal amount) {
        try {
            JSONObject refundRequest = new JSONObject();
            refundRequest.put("amount", amount.multiply(new BigDecimal(100)).intValue());
            client.payments.refund(paymentId, refundRequest);
            return true;
        } catch (RazorpayException e) {
            return false;
        }
    }

    public boolean verifyWebhookSignature(String payload, String signature) {
        if (signature == null || signature.isBlank() || payload == null) {
            return false;
        }
        try {
            Mac sha256 = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(keySecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            sha256.init(secretKey);
            byte[] digest = sha256.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder computed = new StringBuilder();
            for (byte b : digest) {
                computed.append(String.format("%02x", b));
            }
            return computed.toString().equals(signature);
        } catch (Exception e) {
            return false;
        }
    }
}

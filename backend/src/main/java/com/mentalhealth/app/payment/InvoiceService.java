package com.mentalhealth.app.payment;

import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;
import com.mentalhealth.app.booking.Booking;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;

@Service
public class InvoiceService {

    public byte[] generateInvoicePdf(Booking booking) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        try (PdfWriter writer = new PdfWriter(baos);
                PdfDocument pdf = new PdfDocument(writer);
                Document document = new Document(pdf)) {

            // Professional Header
            document.add(new Paragraph("MENTAL HEALTH SAAS").setFontSize(14).setBold());
            document.add(new Paragraph("Professional Therapy Services").setFontSize(10).setItalic());
            document.add(new Paragraph("\n"));

            document.add(new Paragraph("INVOICE").setFontSize(22).setBold());
            document.add(new Paragraph("No: INV-" + booking.getId().toString().substring(0, 8).toUpperCase()));
            document.add(new Paragraph("Date: " + java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy")
                    .format(java.time.LocalDateTime.now())));
            document.add(new Paragraph("\n"));

            // Client & Service Info
            document.add(new Paragraph("BILL TO:").setBold());
            document.add(new Paragraph(booking.getUser().getName()));
            document.add(new Paragraph(booking.getUser().getEmail()));
            document.add(new Paragraph("\n"));

            document.add(new Paragraph("SERVICE DETAILS:").setBold());
            document.add(new Paragraph("Therapist: Dr. " + booking.getTherapist().getUser().getName()));
            document.add(new Paragraph("Session: " + java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm")
                    .format(booking.getAvailabilitySlot().getStartTime())));
            document.add(new Paragraph("\n"));

            // Financials (Mocking hourly rate for now or fetch from therapist)
            double amount = 1000.0; // Base amount (should be from therapist.hourlyRate)
            double gstRate = 0.18;
            double gstAmount = amount * gstRate;
            double total = amount + gstAmount;

            document.add(new Paragraph("--------------------------------------------------"));
            document.add(new Paragraph("Base Consultation Fee: " + amount));
            document.add(new Paragraph("GST (18%): " + gstAmount));
            document.add(new Paragraph("TOTAL AMOUNT PAID: " + total).setBold());
            document.add(new Paragraph("--------------------------------------------------"));
            document.add(new Paragraph("\n"));

            // Legal & Status
            document.add(new Paragraph("Payment Status: " + booking.getStatus()).setFontSize(10));
            document.add(new Paragraph("Transaction ID: " + booking.getPaymentId()).setFontSize(10));
            document.add(new Paragraph("\n"));

            // Legal Disclaimer
            document.add(new Paragraph(
                    "LEGAL DISCLAIMER: This document serves as an official receipt for services provided. All mental health sessions are confidential. In case of medical emergency, please contact your local emergency services immediately.")
                    .setFontSize(8).setItalic());

            document.add(new Paragraph("\nThank you for choosing our platform for your mental wellness journey."));

        } catch (Exception e) {
            throw new RuntimeException("Error generating PDF invoice", e);
        }

        return baos.toByteArray();
    }
}

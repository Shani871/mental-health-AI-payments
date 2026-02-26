package com.mentalhealth.app.common.util;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

@Converter
@Component
public class AttributeEncryptionConverter implements AttributeConverter<String, String> {

    private final EncryptionUtils encryptionUtils;

    // Use @Lazy to avoid circular dependency if EncryptionUtils is used in other
    // services
    public AttributeEncryptionConverter(@Lazy EncryptionUtils encryptionUtils) {
        this.encryptionUtils = encryptionUtils;
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) {
            return null;
        }
        return encryptionUtils.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        return encryptionUtils.decrypt(dbData);
    }
}

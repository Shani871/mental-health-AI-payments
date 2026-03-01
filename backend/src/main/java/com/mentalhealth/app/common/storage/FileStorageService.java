package com.mentalhealth.app.common.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path basePath;

    public FileStorageService(@Value("${storage.base-dir:./data/uploads}") String baseDir) {
        this.basePath = Paths.get(baseDir).toAbsolutePath().normalize();
    }

    public String store(MultipartFile file, String category) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("File is required.");
        }
        try {
            Path categoryPath = basePath.resolve(category);
            Files.createDirectories(categoryPath);
            String original = file.getOriginalFilename() == null ? "file.bin" : file.getOriginalFilename();
            String safeName = original.replaceAll("[^a-zA-Z0-9._-]", "_");
            String generated = UUID.randomUUID() + "_" + safeName;
            Path target = categoryPath.resolve(generated);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return category + "/" + generated;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file", e);
        }
    }

    public Path resolve(String relativePath) {
        return basePath.resolve(relativePath).normalize();
    }
}

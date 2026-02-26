package com.mentalhealth.app.config;

import com.mentalhealth.app.user.Role;
import com.mentalhealth.app.user.User;
import com.mentalhealth.app.user.UserRepository;
import com.mentalhealth.app.user.UserStatus;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    @Bean
    public CommandLineRunner initAdminUser(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.findByEmail("admin@mentalsaas.com").isEmpty()) {
                User admin = new User(
                        "System Admin",
                        "admin@mentalsaas.com",
                        passwordEncoder.encode("admin123"),
                        Role.ADMIN,
                        UserStatus.ACTIVE);
                userRepository.save(admin);
                System.out.println("Default Admin User created: admin@mentalsaas.com / admin123");
            }
        };
    }
}

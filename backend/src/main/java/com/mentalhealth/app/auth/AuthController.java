package com.mentalhealth.app.auth;

import com.mentalhealth.app.auth.dto.JwtResponse;
import com.mentalhealth.app.auth.dto.LoginRequest;
import com.mentalhealth.app.auth.dto.RefreshTokenRequest;
import com.mentalhealth.app.auth.dto.SignupRequest;
import com.mentalhealth.app.auth.dto.TherapistSignupRequest;
import com.mentalhealth.app.common.ApiResponse;
import com.mentalhealth.app.security.JwtUtils;
import com.mentalhealth.app.therapist.Therapist;
import com.mentalhealth.app.therapist.TherapistRepository;
import com.mentalhealth.app.user.Role;
import com.mentalhealth.app.user.User;
import com.mentalhealth.app.user.UserRepository;
import com.mentalhealth.app.user.UserStatus;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

        private final AuthenticationManager authenticationManager;
        private final UserRepository userRepository;
        private final TherapistRepository therapistRepository;
        private final PasswordEncoder encoder;
        private final JwtUtils jwtUtils;

        public AuthController(AuthenticationManager authenticationManager, UserRepository userRepository,
                        TherapistRepository therapistRepository,
                        PasswordEncoder encoder, JwtUtils jwtUtils) {
                this.authenticationManager = authenticationManager;
                this.userRepository = userRepository;
                this.therapistRepository = therapistRepository;
                this.encoder = encoder;
                this.jwtUtils = jwtUtils;
        }

        @PostMapping("/signin")
        public ResponseEntity<ApiResponse<JwtResponse>> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {

                Authentication authentication = authenticationManager.authenticate(
                                new UsernamePasswordAuthenticationToken(loginRequest.getEmail(),
                                                loginRequest.getPassword()));

                SecurityContextHolder.getContext().setAuthentication(authentication);
                String accessToken = jwtUtils.generateAccessToken(authentication);
                String refreshToken = jwtUtils.generateRefreshToken(authentication);

                UserDetails userPrincipal = (UserDetails) authentication.getPrincipal();
                User user = userRepository.findByEmail(userPrincipal.getUsername()).orElseThrow();

                JwtResponse tokenResponse = new JwtResponse(
                                accessToken,
                                refreshToken,
                                user.getId(),
                                user.getName(),
                                user.getEmail(),
                                user.getRole().name());
                return ResponseEntity.ok(ApiResponse.success("Login successful", tokenResponse));
        }

        @PostMapping("/signup")
        public ResponseEntity<ApiResponse<String>> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
                if (userRepository.existsByEmail(signUpRequest.getEmail())) {
                        return ResponseEntity
                                        .badRequest()
                                        .body(ApiResponse.error("Email is already in use", null));
                }

                User user = new User(
                                signUpRequest.getName(),
                                signUpRequest.getEmail(),
                                encoder.encode(signUpRequest.getPassword()),
                                Role.USER,
                                UserStatus.ACTIVE);

                userRepository.save(user);

                return ResponseEntity.ok(ApiResponse.success("User registered successfully", null));
        }

        @PostMapping("/therapist/signup")
        public ResponseEntity<ApiResponse<String>> registerTherapist(@Valid @RequestBody TherapistSignupRequest signUpRequest) {
                if (userRepository.existsByEmail(signUpRequest.getEmail())) {
                        return ResponseEntity
                                        .badRequest()
                                        .body(ApiResponse.error("Email is already in use", null));
                }

                User user = new User(
                                signUpRequest.getName(),
                                signUpRequest.getEmail(),
                                encoder.encode(signUpRequest.getPassword()),
                                Role.THERAPIST,
                                UserStatus.ACTIVE);

                User savedUser = userRepository.save(user);

                Therapist therapist = new Therapist(
                                savedUser,
                                signUpRequest.getSpecialization(),
                                signUpRequest.getExperienceYears(),
                                signUpRequest.getHourlyRate());

                therapistRepository.save(therapist);

                return ResponseEntity.ok(ApiResponse.success(
                                "Therapist registered successfully. Account is pending admin approval.",
                                null));
        }

        @PostMapping("/refresh")
        public ResponseEntity<ApiResponse<JwtResponse>> refreshAccessToken(
                        @Valid @RequestBody RefreshTokenRequest refreshTokenRequest) {
                String refreshToken = refreshTokenRequest.getRefreshToken();

                if (!jwtUtils.validateJwtToken(refreshToken) || !jwtUtils.isRefreshToken(refreshToken)) {
                        return ResponseEntity.badRequest()
                                        .body(ApiResponse.error("Invalid or expired refresh token", null));
                }

                String email = jwtUtils.getUserNameFromJwtToken(refreshToken);
                User user = userRepository.findByEmail(email).orElseThrow();
                String newAccessToken = jwtUtils.generateAccessTokenFromEmail(email);

                JwtResponse tokenResponse = new JwtResponse(
                                newAccessToken,
                                refreshToken,
                                user.getId(),
                                user.getName(),
                                user.getEmail(),
                                user.getRole().name());
                return ResponseEntity.ok(ApiResponse.success("Access token refreshed", tokenResponse));
        }
}

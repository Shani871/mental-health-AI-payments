package com.mentalhealth.app.auth;

import com.mentalhealth.app.auth.dto.JwtResponse;
import com.mentalhealth.app.auth.dto.LoginRequest;
import com.mentalhealth.app.auth.dto.SignupRequest;
import com.mentalhealth.app.auth.dto.TherapistSignupRequest;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
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
        public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {

                Authentication authentication = authenticationManager.authenticate(
                                new UsernamePasswordAuthenticationToken(loginRequest.getEmail(),
                                                loginRequest.getPassword()));

                SecurityContextHolder.getContext().setAuthentication(authentication);
                String jwt = jwtUtils.generateJwtToken(authentication);

                UserDetails userPrincipal = (UserDetails) authentication.getPrincipal();
                User user = userRepository.findByEmail(userPrincipal.getUsername()).orElseThrow();

                return ResponseEntity.ok(new JwtResponse(
                                jwt,
                                user.getId(),
                                user.getName(),
                                user.getEmail(),
                                user.getRole().name()));
        }

        @PostMapping("/signup")
        public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
                if (userRepository.existsByEmail(signUpRequest.getEmail())) {
                        return ResponseEntity
                                        .badRequest()
                                        .body("Error: Email is already in use!");
                }

                User user = new User(
                                signUpRequest.getName(),
                                signUpRequest.getEmail(),
                                encoder.encode(signUpRequest.getPassword()),
                                Role.USER,
                                UserStatus.ACTIVE);

                userRepository.save(user);

                return ResponseEntity.ok("User registered successfully!");
        }

        @PostMapping("/therapist/signup")
        public ResponseEntity<?> registerTherapist(@Valid @RequestBody TherapistSignupRequest signUpRequest) {
                if (userRepository.existsByEmail(signUpRequest.getEmail())) {
                        return ResponseEntity
                                        .badRequest()
                                        .body("Error: Email is already in use!");
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

                return ResponseEntity.ok("Therapist registered successfully! Awaiting admin approval.");
        }
}

-- Seed Data for Mental Health SaaS

-- Clean up existing data to avoid conflicts
DELETE FROM therapist_availability;
DELETE FROM therapists;
DELETE FROM users;

-- 1. Insert Sample Users
-- Password is 'password' hashed with BCrypt
INSERT INTO users (id, name, email, password, role, status) VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'John Doe', 'john@example.com', '$2a$10$8.UnVuG9HHgffUDAlk8qfOuVGkqRzgVymGe07xd00DMxs.TVuHOn2', 'USER', 'ACTIVE'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Dr. Emily Blunt', 'emily@therapy.com', '$2a$10$8.UnVuG9HHgffUDAlk8qfOuVGkqRzgVymGe07xd00DMxs.TVuHOn2', 'THERAPIST', 'ACTIVE'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Admin User', 'admin@mentalhealth.com', '$2a$10$8.UnVuG9HHgffUDAlk8qfOuVGkqRzgVymGe07xd00DMxs.TVuHOn2', 'ADMIN', 'ACTIVE');

-- 2. Insert Sample Therapists
INSERT INTO therapists (id, user_id, specialization, experience_years, hourly_rate, verified) VALUES 
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'CBT, Trauma Specialists', 12, 150.0, false),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'General Wellness', 25, 200.0, true);

-- 3. Insert Availability Slots
INSERT INTO therapist_availability (id, therapist_id, start_time, end_time, is_booked) VALUES 
(gen_random_uuid(), 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '1 day 1 hour', false),
(gen_random_uuid(), 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', CURRENT_TIMESTAMP + interval '1 day 2 hours', CURRENT_TIMESTAMP + interval '1 day 3 hours', false);

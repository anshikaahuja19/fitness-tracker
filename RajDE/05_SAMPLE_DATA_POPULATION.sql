-- ============================================================================
-- FitTrack Progressive Overload & Fitness Tracking System
-- DML Script: Realistic Sample Data Population
-- Author / Backend Lead: Raj Kumar
-- ============================================================================

-- Clean existing data
TRUNCATE TABLE personal_records, set_logs, workout_sessions, routine_exercises, workout_routines, exercises, user_profiles, users RESTART IDENTITY CASCADE;

-- ============================================================================
-- 1. Insert Users (Password: 'Password123!' -> Bcrypt Hash)
-- ============================================================================
INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES
('809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'demo@fittrack.com', '$2a$10$K9R2Gk9Z8eT7wQ1mJ4Y8veM.8kE3zPqO1yD5hA7sB9cL4mF2gH1i2', 'Alex Hunter (Demo Lead)', 'USER', '2026-10-01 08:00:00+00'),
('11111111-1111-1111-1111-111111111111', 'anshika@fittrack.com', '$2a$10$K9R2Gk9Z8eT7wQ1mJ4Y8veM.8kE3zPqO1yD5hA7sB9cL4mF2gH1i2', 'Anshika Ahuja', 'USER', '2026-10-02 09:30:00+00'),
('22222222-2222-2222-2222-222222222222', 'hartej@fittrack.com', '$2a$10$K9R2Gk9Z8eT7wQ1mJ4Y8veM.8kE3zPqO1yD5hA7sB9cL4mF2gH1i2', 'Hartejsingh Sandhu', 'USER', '2026-10-03 10:15:00+00'),
('33333333-3333-3333-3333-333333333333', 'raj@fittrack.com', '$2a$10$K9R2Gk9Z8eT7wQ1mJ4Y8veM.8kE3zPqO1yD5hA7sB9cL4mF2gH1i2', 'Raj Kumar (Admin)', 'ADMIN', '2026-10-01 07:00:00+00');

-- ============================================================================
-- 2. Insert User Profiles (Biometrics & Progression Targets)
-- ============================================================================
INSERT INTO user_profiles (id, user_id, date_of_birth, gender, height_cm, weight_kg, target_weight_kg, goal, activity_level) VALUES
(uuid_generate_v4(), '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', '1998-05-15', 'MALE', 178.50, 78.50, 82.00, 'HYPERTROPHY', 'VERY_ACTIVE'),
(uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', '2001-08-22', 'FEMALE', 165.00, 58.00, 55.00, 'ENDURANCE', 'MODERATE'),
(uuid_generate_v4(), '22222222-2222-2222-2222-222222222222', '1999-11-10', 'MALE', 182.00, 84.00, 80.00, 'STRENGTH', 'VERY_ACTIVE'),
(uuid_generate_v4(), '33333333-3333-3333-3333-333333333333', '1997-03-30', 'MALE', 175.00, 74.00, 74.00, 'GENERAL_FITNESS', 'MODERATE');

-- ============================================================================
-- 3. Master Exercises Catalog (Core Gym Movements)
-- ============================================================================
INSERT INTO exercises (id, name, description, instructions, category, primary_muscle, secondary_muscles, equipment, difficulty, is_custom, created_by_id) VALUES
('e0000001-0000-0000-0000-000000000001', 'Barbell Bench Press', 'Compound flat barbell chest press', 'Retract scapulae, touch mid-chest, press upward locking elbows.', 'BARBELL', 'CHEST', '{"ARMS", "SHOULDERS"}', 'BARBELL', 'INTERMEDIATE', FALSE, NULL),
('e0000002-0000-0000-0000-000000000002', 'Incline Dumbbell Press', 'Upper pectoral hypertrophy movement', 'Set bench to 30 degrees, press dumbbells overhead in a controlled arc.', 'DUMBBELL', 'CHEST', '{"SHOULDERS", "ARMS"}', 'DUMBBELL', 'INTERMEDIATE', FALSE, NULL),
('e0000003-0000-0000-0000-000000000003', 'Overhead Barbell Press', 'Compound vertical shoulder press', 'Press overhead from collarbone to full extension with tight core.', 'BARBELL', 'SHOULDERS', '{"ARMS", "CORE"}', 'BARBELL', 'ADVANCED', FALSE, NULL),
('e0000004-0000-0000-0000-000000000004', 'Lateral Dumbbell Raise', 'Medial deltoid isolation', 'Raise dumbbells to shoulder height leading with elbows.', 'DUMBBELL', 'SHOULDERS', '{}', 'DUMBBELL', 'BEGINNER', FALSE, NULL),
('e0000005-0000-0000-0000-000000000005', 'Barbell Back Squat', 'The king of lower body movements', 'Descend to parallel keeping knees in line with toes, drive up.', 'BARBELL', 'LEGS', '{"CORE", "BACK"}', 'BARBELL', 'ADVANCED', FALSE, NULL),
('e0000006-0000-0000-0000-000000000006', 'Romanian Deadlift (RDL)', 'Hamstring and glute hinge movement', 'Hinge hips backward with soft knees, feel deep stretch in hamstrings.', 'BARBELL', 'LEGS', '{"BACK", "CORE"}', 'BARBELL', 'INTERMEDIATE', FALSE, NULL),
('e0000007-0000-0000-0000-000000000007', 'Barbell Deadlift', 'Full body posterior chain strength pull', 'Pull barbell from floor locking out hips and upper back firmly.', 'BARBELL', 'BACK', '{"LEGS", "CORE"}', 'BARBELL', 'ADVANCED', FALSE, NULL),
('e0000008-0000-0000-0000-000000000008', 'Lat Pulldown', 'Vertical pulling movement for lat width', 'Pull bar to upper chest squeezing lats, slow controlled eccentric.', 'CABLE', 'BACK', '{"ARMS"}', 'CABLE', 'BEGINNER', FALSE, NULL),
('e0000009-0000-0000-0000-000000000009', 'Barbell Bicep Curl', 'Biceps brachii isolation movement', 'Keep elbows pinned to ribs, curl barbell upward towards chest.', 'BARBELL', 'ARMS', '{}', 'BARBELL', 'BEGINNER', FALSE, NULL),
('e0000010-0000-0000-0000-000000000010', 'Tricep Rope Pushdown', 'Triceps lateral and medial head isolation', 'Extend elbows fully downwards spreading the rope handles at bottom.', 'CABLE', 'ARMS', '{}', 'CABLE', 'BEGINNER', FALSE, NULL);

-- ============================================================================
-- 4. Workout Routines (Push, Pull, Legs Splits)
-- ============================================================================
INSERT INTO workout_routines (id, user_id, name, description, is_public, created_at) VALUES
('r0000001-0000-0000-0000-000000000001', '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'Push Hypertrophy Day', 'Focus on chest, front/side delts, and triceps volume.', TRUE, '2026-10-05 10:00:00+00'),
('r0000002-0000-0000-0000-000000000002', '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'Pull Strength Day', 'Heavy deadlifts, lat pulldowns and bicep progression.', TRUE, '2026-10-05 10:05:00+00'),
('r0000003-0000-0000-0000-000000000003', '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'Legs & Core Power', 'Squats, RDLs, and posterior chain development.', TRUE, '2026-10-05 10:10:00+00');

-- ============================================================================
-- 5. Routine Exercises (Template Order and Target Sets/Reps)
-- ============================================================================
INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target_sets, target_reps, rest_seconds, notes) VALUES
(uuid_generate_v4(), 'r0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 1, 4, '6-8', 120, 'Heavy primary compound'),
(uuid_generate_v4(), 'r0000001-0000-0000-0000-000000000001', 'e0000002-0000-0000-0000-000000000002', 2, 3, '8-10', 90, 'Focus on chest stretch'),
(uuid_generate_v4(), 'r0000001-0000-0000-0000-000000000001', 'e0000003-0000-0000-0000-000000000003', 3, 3, '8-10', 90, 'Strict military form'),
(uuid_generate_v4(), 'r0000001-0000-0000-0000-000000000001', 'e0000004-0000-0000-0000-000000000004', 4, 3, '12-15', 60, 'Burnout side delts'),
(uuid_generate_v4(), 'r0000001-0000-0000-0000-000000000001', 'e0000010-0000-0000-0000-000000000010', 5, 3, '10-12', 60, 'Tricep finisher');

-- ============================================================================
-- 6. Workout Sessions (Executed Workout Instances Across Weeks)
-- ============================================================================
INSERT INTO workout_sessions (id, user_id, routine_id, name, start_time, end_time, status, total_volume_kg, notes) VALUES
('s0000001-0000-0000-0000-000000000001', '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'r0000001-0000-0000-0000-000000000001', 'Morning Push Hypertrophy', '2026-11-01 07:00:00+00', '2026-11-01 08:15:00+00', 'COMPLETED', 6840.0, 'Felt very energized, solid warm-up'),
('s0000002-0000-0000-0000-000000000002', '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'r0000002-0000-0000-0000-000000000002', 'Heavy Pull Strength', '2026-11-03 07:30:00+00', '2026-11-03 08:45:00+00', 'COMPLETED', 7920.0, 'Deadlifts felt heavy, good lockout'),
('s0000003-0000-0000-0000-000000000003', '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'r0000003-0000-0000-0000-000000000003', 'Legs & Core Day', '2026-11-05 07:15:00+00', '2026-11-05 08:30:00+00', 'COMPLETED', 8450.0, 'Squats to full depth'),
('s0000004-0000-0000-0000-000000000004', '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'r0000001-0000-0000-0000-000000000001', 'Push Overload Session', '2026-11-08 07:00:00+00', '2026-11-08 08:20:00+00', 'COMPLETED', 7420.0, 'Bench PR broken today! 100kg clean');

-- ============================================================================
-- 7. Granular Set Logs (Sets within Session 1 and Session 4)
-- ============================================================================
INSERT INTO set_logs (id, session_id, exercise_id, set_number, weight_kg, reps, rpe, is_personal_record, completed_at) VALUES
-- Session 1 (Bench Press)
(uuid_generate_v4(), 's0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 1, 80.0, 10, 7.5, FALSE, '2026-11-01 07:10:00+00'),
(uuid_generate_v4(), 's0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 2, 85.0, 8, 8.0, FALSE, '2026-11-01 07:14:00+00'),
(uuid_generate_v4(), 's0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 3, 90.0, 6, 9.0, TRUE, '2026-11-01 07:18:00+00'),
(uuid_generate_v4(), 's0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 4, 90.0, 5, 9.5, FALSE, '2026-11-01 07:22:00+00'),
-- Session 1 (Incline Dumbbell Press)
(uuid_generate_v4(), 's0000001-0000-0000-0000-000000000001', 'e0000002-0000-0000-0000-000000000002', 1, 30.0, 10, 8.0, FALSE, '2026-11-01 07:30:00+00'),
(uuid_generate_v4(), 's0000001-0000-0000-0000-000000000001', 'e0000002-0000-0000-0000-000000000002', 2, 32.5, 8, 8.5, FALSE, '2026-11-01 07:34:00+00'),
-- Session 4 (Push Overload - Progressive Overload achieved)
(uuid_generate_v4(), 's0000004-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000001', 1, 85.0, 8, 7.5, FALSE, '2026-11-08 07:10:00+00'),
(uuid_generate_v4(), 's0000004-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000001', 2, 92.5, 6, 8.5, FALSE, '2026-11-08 07:15:00+00'),
(uuid_generate_v4(), 's0000004-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000001', 3, 100.0, 4, 9.5, TRUE, '2026-11-08 07:20:00+00');

-- ============================================================================
-- 8. Personal Records (Verified Personal Bests)
-- ============================================================================
INSERT INTO personal_records (id, user_id, exercise_id, type, value, reps, achieved_at) VALUES
(uuid_generate_v4(), '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'e0000001-0000-0000-0000-000000000001', 'MAX_WEIGHT', 100.0, 4, '2026-11-08 07:20:00+00'),
(uuid_generate_v4(), '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'e0000001-0000-0000-0000-000000000001', 'MAX_VOLUME', 800.0, 10, '2026-11-01 07:10:00+00'),
(uuid_generate_v4(), '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'e0000005-0000-0000-0000-000000000005', 'MAX_WEIGHT', 140.0, 3, '2026-11-05 07:45:00+00'),
(uuid_generate_v4(), '809d7c77-4ecc-4ff3-9f20-8c3408d76d15', 'e0000007-0000-0000-0000-000000000007', 'MAX_WEIGHT', 170.0, 2, '2026-11-03 08:15:00+00');

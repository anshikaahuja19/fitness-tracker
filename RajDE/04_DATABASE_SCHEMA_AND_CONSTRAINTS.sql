-- ============================================================================
-- FitTrack Progressive Overload & Fitness Tracking System
-- Comprehensive PostgreSQL 16 DDL Script: Normalized Schema & Constraints
-- Author / Backend Lead: Raj Kumar
-- ============================================================================

-- Enable UUID extension for cryptographically random v4 primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables in reverse dependency order if recreating
DROP TABLE IF EXISTS personal_records CASCADE;
DROP TABLE IF EXISTS set_logs CASCADE;
DROP TABLE IF EXISTS workout_sessions CASCADE;
DROP TABLE IF EXISTS routine_exercises CASCADE;
DROP TABLE IF EXISTS workout_routines CASCADE;
DROP TABLE IF EXISTS exercises CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing custom ENUM types
DROP TYPE IF EXISTS pr_type CASCADE;
DROP TYPE IF EXISTS session_status CASCADE;
DROP TYPE IF EXISTS exercise_difficulty CASCADE;
DROP TYPE IF EXISTS exercise_equipment CASCADE;
DROP TYPE IF EXISTS muscle_group CASCADE;
DROP TYPE IF EXISTS exercise_category CASCADE;
DROP TYPE IF EXISTS activity_level CASCADE;
DROP TYPE IF EXISTS fitness_goal CASCADE;
DROP TYPE IF EXISTS user_gender CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- ============================================================================
-- 1. Custom PostgreSQL Domain ENUM Types
-- ============================================================================

CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
CREATE TYPE user_gender AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE fitness_goal AS ENUM ('STRENGTH', 'HYPERTROPHY', 'ENDURANCE', 'WEIGHT_LOSS', 'GENERAL_FITNESS');
CREATE TYPE activity_level AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'VERY_ACTIVE');

CREATE TYPE exercise_category AS ENUM ('BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT');
CREATE TYPE muscle_group AS ENUM ('CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'CORE');
CREATE TYPE exercise_equipment AS ENUM ('BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'NONE');
CREATE TYPE exercise_difficulty AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

CREATE TYPE session_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE pr_type AS ENUM ('MAX_WEIGHT', 'MAX_VOLUME', 'ONE_REP_MAX');

-- ============================================================================
-- 2. Core Entity Tables
-- ============================================================================

-- Table 1: users (Core Authentication and Identity)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'USER',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Table 2: user_profiles (Biometric Attributes and Goals - 1:1 with users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    gender user_gender,
    height_cm DECIMAL(5, 2) CHECK (height_cm > 50.0 AND height_cm < 300.0),
    weight_kg DECIMAL(5, 2) CHECK (weight_kg > 20.0 AND weight_kg < 500.0),
    target_weight_kg DECIMAL(5, 2) CHECK (target_weight_kg > 20.0 AND target_weight_kg < 500.0),
    goal fitness_goal DEFAULT 'HYPERTROPHY',
    activity_level activity_level DEFAULT 'MODERATE',
    avatar_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: exercises (Master Exercise Catalog & Custom User Movements)
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    instructions TEXT,
    category exercise_category NOT NULL,
    primary_muscle muscle_group NOT NULL,
    secondary_muscles TEXT[] DEFAULT '{}',
    equipment exercise_equipment NOT NULL DEFAULT 'NONE',
    difficulty exercise_difficulty NOT NULL DEFAULT 'BEGINNER',
    image_url VARCHAR(500),
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique exercise names per user; global library (created_by_id IS NULL) must be unique
    CONSTRAINT uq_exercise_name_per_creator UNIQUE (name, created_by_id)
);

-- Table 4: workout_routines (Saved Template Splits e.g., Push/Pull/Legs)
CREATE TABLE workout_routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_routine_name_len CHECK (char_length(trim(name)) >= 2)
);

-- Table 5: routine_exercises (Many-to-Many Junction between Routine & Exercise)
CREATE TABLE routine_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routine_id UUID NOT NULL REFERENCES workout_routines(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    order_index INTEGER NOT NULL CHECK (order_index >= 1),
    target_sets INTEGER NOT NULL DEFAULT 3 CHECK (target_sets > 0 AND target_sets <= 20),
    target_reps VARCHAR(50) NOT NULL DEFAULT '8-12',
    rest_seconds INTEGER DEFAULT 90 CHECK (rest_seconds >= 0 AND rest_seconds <= 600),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Enforce deterministic sequencing of exercises in a routine
    CONSTRAINT uq_routine_exercise_order UNIQUE (routine_id, order_index)
);

-- Table 6: workout_sessions (Real-world Performed Workout Instances)
CREATE TABLE workout_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    routine_id UUID REFERENCES workout_routines(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMPTZ,
    status session_status NOT NULL DEFAULT 'IN_PROGRESS',
    total_volume_kg DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (total_volume_kg >= 0.0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_session_times CHECK (end_time IS NULL OR end_time >= start_time)
);

-- Table 7: set_logs (Granular Rep-and-Weight Telemetry per Set)
CREATE TABLE set_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    set_number INTEGER NOT NULL CHECK (set_number >= 1),
    weight_kg DOUBLE PRECISION NOT NULL CHECK (weight_kg >= 0.0 AND weight_kg <= 1000.0),
    reps INTEGER NOT NULL CHECK (reps > 0 AND reps <= 200),
    rpe DOUBLE PRECISION CHECK (rpe IS NULL OR (rpe >= 1.0 AND rpe <= 10.0)),
    is_personal_record BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 8: personal_records (Historical Verified Milestones per Exercise)
CREATE TABLE personal_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    type pr_type NOT NULL,
    value DOUBLE PRECISION NOT NULL CHECK (value > 0.0),
    reps INTEGER CHECK (reps IS NULL OR reps > 0),
    achieved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Each user has exactly one active milestone per metric per exercise
    CONSTRAINT uq_user_exercise_pr_metric UNIQUE (user_id, exercise_id, type)
);

-- ============================================================================
-- 3. High-Performance Indexing Strategy
-- ============================================================================

-- User lookup indexes
CREATE INDEX idx_users_email ON users(email);

-- Exercise catalog lookup indexes
CREATE INDEX idx_exercises_category ON exercises(category);
CREATE INDEX idx_exercises_primary_muscle ON exercises(primary_muscle);
CREATE INDEX idx_exercises_created_by ON exercises(created_by_id);
CREATE INDEX idx_exercises_custom_visible ON exercises(is_custom, created_by_id);

-- Routine ordering index
CREATE INDEX idx_routine_exercises_routine ON routine_exercises(routine_id);
CREATE INDEX idx_routine_exercises_exercise ON routine_exercises(exercise_id);

-- Time-series workout session composite indexes
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_status ON workout_sessions(status);
CREATE INDEX idx_workout_sessions_start_time ON workout_sessions(start_time DESC);
CREATE INDEX idx_workout_sessions_user_status_time ON workout_sessions(user_id, status, start_time DESC);

-- Set log query optimization indexes
CREATE INDEX idx_set_logs_session_id ON set_logs(session_id);
CREATE INDEX idx_set_logs_exercise_id ON set_logs(exercise_id);
CREATE INDEX idx_set_logs_session_exercise ON set_logs(session_id, exercise_id);

-- PR analytics index
CREATE INDEX idx_personal_records_user_exercise ON personal_records(user_id, exercise_id);
CREATE INDEX idx_personal_records_user_type ON personal_records(user_id, type);

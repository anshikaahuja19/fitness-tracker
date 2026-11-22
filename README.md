# FitTrack 🏋️‍♂️

> **Intelligent Progressive Overload & Workout Telemetry Platform**  
> A full-stack mobile fitness tracking system built with **React Native (Expo SDK 58)**, **Node.js / Express**, **Prisma ORM**, and **PostgreSQL**.

---

## 📌 Project Overview

**FitTrack** is designed to eliminate guesswork from strength and hypertrophy training. It enables athletes to create customized workout routines, log sets and reps in real time with progressive overload cues, track personal records (PRs), and visualize weekly volume and frequency analytics through interactive charts.

---

## 🗄️ Database Architecture & Engineering

### 1. Why PostgreSQL?
We selected **PostgreSQL** (hosted serverless on Neon with connection pooling, and fully compatible locally) as our primary database engine based on the following architectural requirements:

* **Strictly Relational Domain:** Fitness tracking data is intrinsically hierarchical and interconnected:
  $$\text{Users} \xrightarrow{1:1} \text{Profiles} \quad\vert\quad \text{Users} \xrightarrow{1:N} \text{Routines} \xrightarrow{M:N} \text{Exercises} \quad\vert\quad \text{Sessions} \xrightarrow{1:N} \text{SetLogs}$$
* **ACID Transactions for Correctness:** Logging workouts requires atomic operations. If a session finishes, creating set logs, recalculating total volume, and updating personal records must succeed together. PostgreSQL's transactional engine prevents corrupted or partial workout saves.
* **Heavy Analytical Read Patterns:** FitTrack's dashboard relies on high-frequency aggregations (`SUM` of volume, `COUNT` of workouts, `MAX` weights, weekly frequency groupings). PostgreSQL's query optimizer handles multi-table joins and aggregation indexes in single-digit milliseconds.
* **Why Not MongoDB?**
  * *Analytical complexity:* Querying an exercise's strength progression across 6 months in MongoDB requires expensive `$unwind` aggregation pipelines across nested arrays.
  * *Referential integrity:* Deleting or updating a master exercise in MongoDB would require application-level cascading across thousands of nested documents.
  * *Document size limits:* Unbounded nested arrays of sets risk hitting document mutation overhead.

---

### 2. Relational Schema & 8 Core Entities

The schema is partitioned across **8 normalized entities**:

| Entity | Description | Cardinality |
| :--- | :--- | :--- |
| **`users`** | Core authentication credentials & role metadata. | `1:1` with `user_profiles` |
| **`user_profiles`** | Athlete biometrics (height, weight, target, goal). | `1:1` with `users` (via unique `user_id`) |
| **`exercises`** | Master movement library (categories, muscles, equipment). | `1:N` with `set_logs`, `personal_records` |
| **`workout_routines`** | User-curated workout splits (Push/Pull/Legs). | `1:N` with `routine_exercises`, `workout_sessions` |
| **`routine_exercises`** | **Associative Junction Table:** Resolves Many-to-Many ($M:N$) between routines & exercises. | Holds `order_index`, `target_sets`, `target_reps`, `rest_seconds` |
| **`workout_sessions`** | Executed workout instances with start/end telemetry. | `1:N` with `set_logs` |
| **`set_logs`** | Granular set execution (weight, reps, RPE, completion). | Belongs to `workout_sessions` & `exercises` |
| **`personal_records`** | Historic milestones (Max Weight, Reps, Estimated 1RM). | Belongs to `users` & `exercises` |

#### Resolving Many-to-Many ($M:N$):
A workout routine contains multiple exercises, and an exercise appears in multiple routines. This is resolved via the **`routine_exercises`** associative entity with a composite unique constraint `@@unique([routineId, orderIndex])` to prevent duplicate sequence ordering.

#### Visual Entity-Relationship (ER) Diagram:

```mermaid
erDiagram
    users ||--o| user_profiles : "has profile (1:1)"
    users ||--o{ workout_routines : "authors (1:N)"
    users ||--o{ workout_sessions : "performs (1:N)"
    users ||--o{ personal_records : "achieves (1:N)"
    users ||--o{ exercises : "creates custom (1:N)"

    workout_routines ||--o{ routine_exercises : "prescribes (1:N)"
    exercises ||--o{ routine_exercises : "included in (1:N)"

    workout_routines ||--o{ workout_sessions : "instantiates (1:N)"
    workout_sessions ||--|{ set_logs : "records (1:N)"
    exercises ||--o{ set_logs : "performed as (1:N)"
    exercises ||--o{ personal_records : "milestone for (1:N)"

    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar name
        enum role
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    user_profiles {
        uuid id PK
        uuid user_id FK,UK
        date date_of_birth
        enum gender
        decimal height_cm
        decimal weight_kg
        decimal target_weight_kg
        enum goal
        enum activity_level
        varchar avatar_url
    }

    exercises {
        uuid id PK
        varchar name
        text description
        text instructions
        enum category
        enum primary_muscle
        varchar_arr secondary_muscles
        enum equipment
        enum difficulty
        boolean is_custom
        uuid created_by_id FK
    }

    workout_routines {
        uuid id PK
        uuid user_id FK
        varchar name
        text description
        boolean is_public
        timestamptz created_at
    }

    routine_exercises {
        uuid id PK
        uuid routine_id FK
        uuid exercise_id FK
        integer order_index
        integer target_sets
        varchar target_reps
        integer rest_seconds
    }

    workout_sessions {
        uuid id PK
        uuid user_id FK
        uuid routine_id FK
        varchar name
        timestamptz start_time
        timestamptz end_time
        enum status
        float total_volume_kg
        text notes
    }

    set_logs {
        uuid id PK
        uuid session_id FK
        uuid exercise_id FK
        integer set_number
        float weight_kg
        integer reps
        float rpe
        boolean is_personal_record
        timestamptz completed_at
    }

    personal_records {
        uuid id PK
        uuid user_id FK
        uuid exercise_id FK
        enum type
        float value
        integer reps
        timestamptz achieved_at
    }
```

---

### 3. Normalization & Deliberate Denormalization

* **Third Normal Form (3NF):** All tables strictly satisfy 3NF and BCNF. Functional dependencies depend entirely on candidate keys with no partial or transitive dependencies (e.g., exercise catalog details are isolated in `exercises` instead of duplicated in `set_logs`).
* **Controlled Denormalization for $O(1)$ Dashboard Reads:**
  * We deliberately denormalized **`total_volume_kg`** directly onto the **`workout_sessions`** table.
  * *Why:* Recalculating $\sum (\text{weight} \times \text{reps})$ across hundreds of child `set_logs` on every home feed load caused query latency spikes.
  * *Integrity Guarantee:* In `session.repository.js`, volume recalculation runs inside the **exact same ACID database transaction (`prisma.$transaction`)** whenever sets are created, edited, or deleted.

---

### 4. Data Correctness & Indexing Strategy

* **Engine-Enforced Constraints:**
  * Primary Keys (Cryptographic UUIDs across all tables).
  * `NOT NULL` on critical numeric fields (`weight`, `reps`, `order_index`).
  * `UNIQUE` on `users.email` and `exercises(name, created_by_id)`.
  * Native PostgreSQL **ENUMs** for `Role`, `MuscleGroup`, `ExerciseCategory`, `WorkoutSessionStatus`, and `RecordType`.
* **Referential Integrity Actions:**
  * `ON DELETE CASCADE`: Deleting a session automatically cascades to its `set_logs`.
  * `ON DELETE RESTRICT`: Prevents accidental deletion of catalog exercises that have historical logged sets.
* **Covering & Filtering B-Tree Indexes:**
  * Foreign key indexes on `user_id`, `workout_session_id`, `routine_id`, and `exercise_id` for $O(\log N)$ join traversal.
  * Composite index `@@index([userId, status, startTime])` on `workout_sessions` allowing PostgreSQL to fetch completed workout history already sorted by date via an **Index Scan** without an in-memory sort.
  * `@@index([exerciseId, isCompleted])` on `set_logs` to accelerate Personal Record calculations by skipping uncompleted sets.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Mobile Frontend** | React Native, Expo (SDK 58), React Navigation, Gifted Charts, Expo Secure Store |
| **Backend API** | Node.js, Express.js (REST), Repository Pattern, Helmet, CORS, Rate Limiting |
| **ORM & Database** | Prisma ORM 7, PostgreSQL (Neon Cloud & Local port 5433) |
| **Security & Auth** | JSON Web Tokens (JWT), BCrypt Password Hashing, Secure Store |
| **Deployment** | Backend on Render, Mobile Android Standalone APK (EAS Cloud) |

---

## 📂 Repository Structure

```
Fittrack/
├── backend/                         # Express REST API & Database layer
│   ├── prisma/
│   │   ├── schema/                  # Modular Prisma schemas (*.prisma)
│   │   ├── seed.js                  # Master 52-exercise catalog seeder
│   │   └── seedDemoUser.js          # Demo account with 18 sessions & 234 sets
│   ├── src/
│   │   ├── controllers/             # HTTP Route handlers
│   │   ├── repository/              # Direct database abstraction & transactions
│   │   ├── routes/                  # Express API endpoints
│   │   └── server.js                # Server entry point
├── FitTrack-Application/            # React Native Expo Mobile App
│   ├── assets/                      # Custom FitTrack adaptive icons & logos
│   ├── src/
│   │   ├── components/              # Reusable UI widgets & modals
│   │   ├── context/                 # Auth & state management (AuthContext)
│   │   ├── navigation/              # App & bottom tab navigators
│   │   └── screens/                 # Dashboard, Workouts, Routines, PRs, Analytics
├── DE/                              # Data Engineering (DE) Portfolio & Docs
│   ├── ER_MODEL.md                  # Comprehensive Data Dictionary & Crow's Foot specs
│   ├── er_diagram_viewer.html       # Standalone interactive HTML visualizer with pan/zoom
│   └── er_diagram.mermaid           # Portable Mermaid ER diagram
└── render.yaml                      # Render cloud infrastructure deployment spec
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* **Node.js** v20+ and **npm**
* **PostgreSQL** (Local instance or Neon cloud connection)
* **Expo Go** app or Android emulator (for mobile development)

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Set your DATABASE_URL in .env

# Push Prisma schema to PostgreSQL
npx prisma db push

# Seed master exercises catalog and demo user
npm run seed
npm run seed:demo

# Start development server
npm start
```
*Backend runs by default on `http://localhost:4646` (or configured `PORT`).*

### 3. Mobile Frontend Setup
```bash
# Navigate to mobile app directory
cd FitTrack-Application

# Install dependencies
npm install

# Start Expo development server
npx expo start
```
*Press `a` for Android Emulator, or scan the QR code using the Expo Go mobile app.*

---

## 👥 Authors & Team
* **Hartej** — Mobile App Architecture, Analytics UI & EAS Android Packaging
* **Anshika** — Frontend Authentication Flow, Secure Storage & Routine Builder
* **Raj** — Backend Hardening, API Routes & Database Engineering Portfolio

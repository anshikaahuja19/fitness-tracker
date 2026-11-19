# FitTrack - Database Management System (DBMS) Submission

**Author:** Raj Kumar (Backend & Database Lead)  
**Database:** PostgreSQL 16 with Prisma ORM  
**Project:** FitTrack (Workout & Progressive Overload Tracking App)

---

## 1. Database Selection & Justification
* **Selected Database:** PostgreSQL 16.
* **Why not MongoDB?** 
  * Fitness data is highly relational: Users -> Routines -> Sessions -> Sets -> Exercises.
  * In MongoDB, embedding exercises in every set duplicates data and causes update anomalies.
  * PostgreSQL provides ACID transactions, ensuring that logging multiple sets and updating personal records (PRs) happens atomically.
  * Foreign key constraints (`ON DELETE CASCADE`) guarantee no orphaned workout sets exist.

---

## 2. Data Modeling & ER Diagram

### Core Entities:
1. **`users`** (`id` PK, `email` UNIQUE, `password_hash`, `name`, `role`).
2. **`user_profiles`** (`id` PK, `user_id` FK/UNIQUE, `height_cm`, `weight_kg`, `target_weight_kg`, `goal`).
3. **`exercises`** (`id` PK, `name`, `primary_muscle`, `category`, `equipment`, `difficulty`).
4. **`workout_routines`** (`id` PK, `user_id` FK, `name`, `description`).
5. **`routine_exercises`** (`id` PK, `routine_id` FK, `exercise_id` FK, `order_index`, `target_sets`, `target_reps`).
6. **`workout_sessions`** (`id` PK, `user_id` FK, `routine_id` FK, `start_time`, `end_time`, `status`, `total_volume_kg`).
7. **`set_logs`** (`id` PK, `session_id` FK, `exercise_id` FK, `set_number`, `weight_kg`, `reps`, `rpe`).
8. **`personal_records`** (`id` PK, `user_id` FK, `exercise_id` FK, `type`, `value`, `reps`, `achieved_at`).

### Entity Relationships:
* **1-to-1:** `users` to `user_profiles`
* **1-to-Many:** `users` to `workout_routines`
* **1-to-Many:** `users` to `workout_sessions`
* **1-to-Many:** `workout_sessions` to `set_logs`
* **Many-to-Many:** `workout_routines` to `exercises` (connected through `routine_exercises`)

### ER Diagram:
```
  [users] 1 ----- 1 [user_profiles]
     |
     | 1 ----- N [workout_routines] 1 ----- N [routine_exercises] N ----- 1 [exercises]
     |                                                                           |
     | 1 ----- N [workout_sessions] 1 ----- N [set_logs] ------------------------+
     |                                                                           |
     +--------- 1 ------------------------- N [personal_records] ----------------+
```

---

## 3. Database Normalization (3NF)

* **Unnormalized Problem:** A single flat table storing user, session, exercise name, and set info causes **Insertion Anomaly** (can't add exercise without a workout), **Update Anomaly** (changing exercise name requires updating 1,000 rows), and **Deletion Anomaly** (deleting a session deletes the exercise definition).
* **1NF (First Normal Form):** Every field has atomic values. Sets are stored as individual rows with separate `weight_kg` and `reps` columns, not as arrays or comma-separated strings.
* **2NF (Second Normal Form):** Removed partial dependencies. Session info (`start_time`, `name`) depends on `session_id`, while set info (`weight_kg`, `reps`) depends on `set_id`. Both are in separate tables.
* **3NF (Third Normal Form):** Removed transitive dependencies. Exercise details (`primary_muscle`, `equipment`) depend on `exercise_id`, not on `set_logs`. They are stored in the standalone `exercises` table.

---

## 4. Database Implementation & Constraints
* **Primary Keys:** UUID v4 (`uuid_generate_v4()`) on every table for security.
* **Foreign Keys:**
  * `ON DELETE CASCADE` on `user_profiles`, `workout_routines`, `workout_sessions`, and `set_logs` so deleting a user or session cleanly removes child rows.
  * `ON DELETE RESTRICT` on `exercises` to protect historical set logs from being corrupted.
* **Check Constraints:**
  * `weight_kg >= 0.0 AND weight_kg <= 1000.0`
  * `reps > 0 AND reps <= 200`
  * `rpe >= 1.0 AND rpe <= 10.0`
  * `end_time >= start_time`
* **Unique Constraints:** `email` on `users`, `(routine_id, order_index)` on `routine_exercises`, and `(user_id, exercise_id, type)` on `personal_records`.

---

## 5. Backend & Database Integration
* **Tech Stack:** Node.js, Express.js, Prisma ORM, PostgreSQL on Render cloud.
* **How It Works:**
  1. Frontend sends REST API request (e.g. `POST /api/sessions`).
  2. Express Route calls Controller.
  3. Controller validates input using middleware.
  4. Repository executes Prisma query (e.g. `prisma.setLog.create()`).
  5. PostgreSQL runs transaction and returns updated data as JSON `{ success: true, data: ... }`.

---

## 6. Performance & Indexing
* **Composite Index:** `CREATE INDEX idx_sessions ON workout_sessions(user_id, status, start_time DESC);`  
  * **Why:** Allows fetching user's completed workout history in sorted order in $O(\log N)$ time without expensive in-memory sorting.
* **Defensive Edge Case Handling:** Zero-division safety in analytics:
  ```javascript
  const growth = lastWeekVolume === 0 ? 0 : ((thisWeek - lastWeek) / lastWeek) * 100;
  ```
  Prevents crash when a brand-new user with 0 workouts views their dashboard.

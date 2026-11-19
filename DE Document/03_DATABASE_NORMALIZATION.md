# Section C: Database Normalization Analysis

Normalization is the process of organizing data in a relational database to reduce data redundancy and eliminate undesirable update, insertion, and deletion anomalies while ensuring referential and functional integrity.

---

## 1. Anomalies in an Un-normalized Table (De-normalized Workout Log)

Consider a hypothetical flat, un-normalized table:  
`UNNORMALIZED_WORKOUT_RECORD(user_email, user_name, user_weight, session_date, session_name, exercise_name, exercise_muscle, set_number, weight_kg, reps)`

```
+------------------------------------------------------------------------------------------------------------------------------------------+
| user_email      | user_name | session_date | session_name | exercise_name       | exercise_muscle | set_num | weight_kg | reps |
+------------------------------------------------------------------------------------------------------------------------------------------+
| alex@fit.com    | Alex H.   | 2026-11-01   | Push Day     | Barbell Bench Press | CHEST           | 1       | 80.0      | 10   |
| alex@fit.com    | Alex H.   | 2026-11-01   | Push Day     | Barbell Bench Press | CHEST           | 2       | 85.0      | 8    |
| alex@fit.com    | Alex H.   | 2026-11-01   | Push Day     | Overhead Press      | SHOULDERS       | 1       | 50.0      | 10   |
| maria@fit.com   | Maria K.  | 2026-11-01   | Leg Day      | Barbell Squat       | LEGS            | 1       | 100.0     | 5    |
+------------------------------------------------------------------------------------------------------------------------------------------+
```

### Demonstration of Anomalies:
1. **Insertion Anomaly:**
   * We cannot register a new exercise (e.g., "Incline Dumbbell Press") in our catalog until a user actually performs a set of that exercise in a workout session.
   * We cannot register a new user until they execute their first workout session.
2. **Update Anomaly:**
   * If Alex updates his email or name, the system must update hundreds of rows across every logged set. If one row fails or is missed, data becomes inconsistent.
   * If the name of "Barbell Bench Press" is corrected or renamed, millions of rows must be modified.
3. **Deletion Anomaly:**
   * If Alex cancels or deletes his workout session of 2026-11-01, we inadvertently delete the record that "Overhead Press" is an exercise for "SHOULDERS".

---

## 2. Functional Dependencies Analysis

We define the primary functional dependencies (FDs) governing our fitness domain:

* **FD1 (User Identity):**  
  `user_id -> email, password_hash, name, role, created_at, updated_at`
* **FD2 (User Biometric Profile):**  
  `profile_id -> user_id, date_of_birth, gender, height_cm, weight_kg, target_weight_kg, goal`  
  *(Note: `user_id -> profile_id` holds as a 1:1 candidate key).*
* **FD3 (Exercise Catalog):**  
  `exercise_id -> name, description, category, primary_muscle, equipment, difficulty, is_custom, created_by_id`
* **FD4 (Workout Template Routine):**  
  `routine_id -> user_id, name, description, is_public, created_at`
* **FD5 (Routine Exercise Prescription):**  
  `(routine_id, order_index) -> id, exercise_id, target_sets, target_reps, rest_seconds, notes`
* **FD6 (Workout Session Telemetry):**  
  `session_id -> user_id, routine_id, name, start_time, end_time, status, total_volume_kg, notes`
* **FD7 (Set Log Granularity):**  
  `set_id -> session_id, exercise_id, set_number, weight_kg, reps, rpe, is_personal_record, completed_at`
* **FD8 (Personal Record Benchmark):**  
  `(user_id, exercise_id, type) -> id, value, reps, achieved_at`

---

## 3. Step-by-Step Normalization Process

### Step 1: First Normal Form (1NF)
**Rule:** A table is in 1NF if:
1. All attributes contain only atomic (indivisible) scalar values (no repeating groups or multi-valued fields).
2. Each record is uniquely identified by a primary key.

* **Violation in un-normalized state:** Storing multiple sets as an array or comma-separated string inside a session record:  
  `session(id, user_name, sets: "80kgx10, 85kgx8, 90kgx6")`
* **1NF Transformation:**
  * Broken down every set into its own individual tuple with scalar attributes: `weight_kg` (FLOAT) and `reps` (INTEGER).
  * Assigned surrogate UUID primary keys (`id`) to all entities.
  * Every cell contains strictly one atomic value.

---

### Step 2: Second Normal Form (2NF)
**Rule:** A table is in 2NF if:
1. It is already in 1NF.
2. It has **no partial functional dependencies**; that is, every non-prime attribute must be fully functionally dependent on the entire primary key, not on a subset of a composite primary key.

* **Violation Scenario in composite key table:**  
  Suppose a table had composite primary key `(session_id, set_number)`:  
  `TABLE(session_id, set_number, session_name, user_email, weight_kg, reps)`  
  * Here, `session_name` and `user_email` depend ONLY on `session_id`, NOT on `set_number`.  
  * This is a **partial dependency**: `{session_id} -> {session_name, user_email}` where `{session_id}` is a proper subset of `{session_id, set_number}`.
* **2NF Transformation:**
  * Decomposed the table into two distinct entities:
    1. `workout_sessions(session_id, user_id, name, start_time, end_time)` — All attributes depend fully on `session_id`.
    2. `set_logs(set_id, session_id, exercise_id, set_number, weight_kg, reps)` — All set metrics depend fully on the unique set identifier, with `session_id` retained purely as a foreign key.

---

### Step 3: Third Normal Form (3NF)
**Rule:** A table is in 3NF if:
1. It is already in 2NF.
2. It has **no transitive dependencies**; that is, no non-prime attribute depends on another non-prime attribute (`X -> Y` and `Y -> Z` where `X` is primary key and `Z` is non-prime).

* **Violation Scenario in 2NF Table:**  
  Consider `set_logs(id, session_id, exercise_id, exercise_name, muscle_group, weight_kg, reps)`:  
  * Primary Key: `id`  
  * Dependencies:  
    `id -> exercise_id`  
    `exercise_id -> exercise_name, muscle_group`  
  * Therefore, `exercise_name` and `muscle_group` transitively depend on `id` through `exercise_id` (`id -> exercise_id -> exercise_name`).
* **3NF Transformation:**
  * Removed transitive attributes (`exercise_name`, `muscle_group`) from `set_logs`.
  * Isolated them into an independent master entity: `exercises(id, name, primary_muscle, category, equipment)`.
  * `set_logs` retains solely the foreign key reference `exercise_id -> exercises.id`.
  * Similarly, user physical biometric goals (`height_cm`, `weight_kg`, `target_weight_kg`) were separated from credentials (`users`) into `user_profiles` to isolate high-frequency biometric mutations from core security authentication state.

---

## 4. Final Normalized Schema Summary

The resulting 8-table relational architecture achieves complete **3NF compliance**:

```
+-------------------+          +--------------------+
|       users       | <------- |   user_profiles    |  (1:1)
+-------------------+          +--------------------+
       |   |
       |   +-----------------------+
       v                           v
+-------------------+      +--------------------+
| workout_routines  |      | workout_sessions   |  (1:N)
+-------------------+      +--------------------+
       |                           |
       v                           v
+-------------------+      +--------------------+      +--------------------+
| routine_exercises | ---> |      set_logs      | ---> |     exercises      |
+-------------------+      +--------------------+      +--------------------+
         ^                                                        ^
         |                                                        |
         +--------------------------------------------------------+
                                   |
                                   v
                         +--------------------+
                         |  personal_records  |  (PR Milestones)
                         +--------------------+
```

All non-key attributes in every table depend on:
**The Key, the Whole Key, and Nothing but the Key (So Help Me Codd).**

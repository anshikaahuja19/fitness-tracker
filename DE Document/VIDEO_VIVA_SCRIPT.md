# FitTrack - DBMS Video Viva Script & Screen Recording Walkthrough
**Student Name:** Raj Kumar  
**Role:** Backend, Database & DevOps Lead  
**Project:** FitTrack (Workout & Progressive Overload Tracking System)  
**Database:** PostgreSQL 16 (Relational DBMS) with Prisma ORM  

---

## 🎬 Recording Setup Instructions:
1. **Screen Layout:** Open VS Code on one side (with `prisma/schema` and `src/repository`) and Terminal / pgAdmin on the other side.
2. **Camera:** Keep your webcam / face visible in the corner.
3. **Follow the 5 Questions below in sequence:** For each question, show the indicated file on screen and read the script naturally.

---

# Question 1: Why did you choose this database?

### 🖥️ What to show on screen:
* Open `backend/prisma/schema/base.prisma` (showing `provider = "postgresql"`).
* Open Terminal and run a query showing real sample records from `exercises` or `set_logs`.

### 🗣️ Exact Spoken Script:
> "Hello everyone. My name is Raj Kumar, and I am the Backend and Database Lead for FitTrack.
> 
> For our project, we chose **PostgreSQL 16**, which is an Object-Relational Database Management System (RDBMS). 
> 
> **1. Nature of our data:**  
> Our fitness tracking data is strictly structured, relational, and time-series. We track users, their customized workout routines, individual workout sessions, and granular set logs containing weight, repetitions, and RPE. These entities have strict relational dependencies — for example, every set log must belong to a valid workout session and reference a valid exercise.
> 
> **2. Read and Write patterns & Data Volume:**  
> Our application has high-frequency write operations during live workouts, where an athlete logs 15 to 30 sets per session in real-time. On the read side, we execute heavy analytical aggregations to calculate weekly consistency, muscle group distribution, and strength progression curves over 8-week windows. For an active gym community of 10,000 users, we expect over 3 to 5 million set logs annually.
> 
> **3. Strong Consistency & ACID Transactions:**  
> We strictly require strong consistency and multi-statement ACID transactions. When a workout session is finalized, the database must simultaneously insert multiple completed sets, recalculate total session tonnage, and check for new Personal Records (PRs). If saving one set fails, the entire transaction must roll back to avoid corrupt or partial workout states.
> 
> **4. Alternative Considered & Rejected (PostgreSQL vs. MongoDB):**  
> We evaluated MongoDB as an alternative document store. However, we rejected MongoDB because embedding exercises inside set documents would duplicate exercise names, muscle groups, and instructions millions of times, leading to severe update anomalies whenever catalog exercises are modified. Furthermore, maintaining referential integrity across un-nested sets in MongoDB requires heavy multi-document aggregations and application-level checks, whereas PostgreSQL enforces integrity natively at the database engine level using Foreign Keys and Cascades.
> 
> Here on my screen, you can see our live PostgreSQL database connection, our exercise master catalog, and our frequent queries fetching user routines and active sessions."

### 💻 Live Query to execute & show on screen:
```sql
SELECT name, category, primary_muscle, equipment 
FROM exercises 
WHERE primary_muscle = 'CHEST' 
LIMIT 5;
```

---

# Question 2: Walk us through your schema or data model.

### 🖥️ What to show on screen:
* Open `RajDE/02_DATA_MODEL_AND_ER_DIAGRAM.md` or display the Mermaid ER diagram.
* Open `backend/prisma/schema/` showing the model files: `user.prisma`, `routine.prisma`, `exercise.prisma`, `setlog.prisma`.

### 🗣️ Exact Spoken Script:
> "Now, let me walk you through our normalized relational schema. Our data model consists of 8 core entities:
> 
> **1. Entities and Primary Keys:**  
> All our primary keys use cryptographically random UUIDs (`id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`) to prevent ID enumeration attacks and allow safe client-side UUID generation.
> 
> * `users`: Stores login credentials and authentication timestamps.
> * `user_profiles`: Stores physical biometrics like height, body weight, target weight, and fitness goals.
> * `exercises`: Master catalog of movements (e.g., Bench Press, Squats).
> * `workout_routines`: Reusable template splits created by users (e.g., Push, Pull, Legs).
> * `routine_exercises`: The associative junction table between routines and exercises.
> * `workout_sessions`: Actual real-world workout instances executed by athletes.
> * `set_logs`: Individual set telemetry (set number, weight in kg, reps, RPE).
> * `personal_records`: Historical verified milestones (Max Weight, Max Volume).
> 
> **2. Relationships:**  
> * **One-to-One (1:1):** Between `users` and `user_profiles`. Each user has exactly one biometric profile, enforced by a `UNIQUE` foreign key constraint on `user_profiles.user_id` with `ON DELETE CASCADE`.
> * **One-to-Many (1:N):** One user authors many `workout_routines` and logs many `workout_sessions`. Similarly, one session contains many `set_logs`.
> * **Many-to-Many (M:N):** Between `workout_routines` and `exercises`. One routine contains multiple exercises, and a single exercise can appear in multiple routines.
> 
> **3. Resolution of Many-to-Many Relationship:**  
> We resolved the M:N relationship using the associative junction entity `routine_exercises`. Instead of a simple bridge table, it carries essential domain attributes: `order_index` (the sequence of exercises), `target_sets`, `target_reps`, and `rest_seconds`. We enforce a compound unique constraint: `UNIQUE(routine_id, order_index)` so that exercise order within a workout routine is strictly deterministic.
> 
> Here is our schema migration in code, and I will now execute a query that joins across our main relationship — from Routine to RoutineExercises and Exercises."

### 💻 Live Query to execute & show on screen:
```sql
SELECT 
    r.name AS routine_name,
    re.order_index,
    e.name AS exercise_name,
    re.target_sets,
    re.target_reps,
    re.rest_seconds
FROM workout_routines r
INNER JOIN routine_exercises re ON r.id = re.routine_id
INNER JOIN exercises e ON re.exercise_id = e.id
LIMIT 5;
```

---

# Question 3: What normal form is your design in, and where did you deliberately break it?

### 🖥️ What to show on screen:
* Open `backend/prisma/schema/routine.prisma` (pointing to `total_volume_kg` in `WorkoutSession`).
* Show `RajDE/03_DATABASE_NORMALIZATION.md`.

### 🗣️ Exact Spoken Script:
> "Our core relational schema strictly adheres to **Third Normal Form (3NF)**:
> 
> **1. Normal Form Walkthrough:**  
> * **1NF:** Every column stores strictly atomic scalar values. Set telemetry is not stored as nested JSON or comma-separated strings; each set has its own independent row with atomic `weight_kg` and `reps`.
> * **2NF:** All non-key attributes are fully functionally dependent on the entire primary key. In our associative table `routine_exercises`, prescription details depend on the full junction ID, and session-level metadata was decoupled from set-level metrics.
> * **3NF:** We removed all transitive dependencies. In `set_logs`, we only store `exercise_id`. We do not store `exercise_name` or `muscle_group` in `set_logs`, because that transitively depends on `exercise_id`. Those attributes are isolated inside the master `exercises` catalog.
> 
> **2. Deliberate Denormalization (Where and Why we broke 3NF):**  
> We made one deliberate, calculated denormalization decision:
> In the `workout_sessions` table, we store `total_volume_kg` directly as a pre-aggregated float column, even though it can technically be derived by summing `(weight_kg * reps)` from `set_logs`.
> 
> **Why we denormalized:**  
> The workout history screen and 8-week analytics dashboards are queried dozens of times a day per user. If `total_volume_kg` were not stored, every single dashboard view would require an expensive SQL `JOIN` and `SUM` across tens of thousands of rows in `set_logs`.
> 
> **How we maintain correctness:**  
> We maintain absolute correctness through our transactional repository logic. In `session.repository.js`, whenever sets are appended or updated, the backend recalculates the session volume inside a database transaction (`prisma.$transaction`) and atomically updates `workout_sessions.total_volume_kg`. This guarantees the denormalized volume never goes out of sync with the underlying set logs."

### 💻 Live Query to execute & show on screen:
```sql
-- Shows the denormalized total_volume_kg matching the calculated sum of sets
SELECT 
    ws.id,
    ws.name,
    ws.total_volume_kg AS stored_volume,
    SUM(sl.weight_kg * sl.reps) AS calculated_volume
FROM workout_sessions ws
INNER JOIN set_logs sl ON ws.id = sl.session_id
GROUP BY ws.id, ws.name, ws.total_volume_kg
LIMIT 3;
```

---

# Question 4: How does your database protect data correctness?

### 🖥️ What to show on screen:
* Open `backend/src/repository/session.repository.js` (pointing to `prisma.$transaction`).
* Open Terminal to execute a query that intentionally violates a `CHECK` constraint or foreign key constraint to show it getting rejected!

### 🗣️ Exact Spoken Script:
> "Data correctness in FitTrack is protected through a multi-layered defense combining database engine constraints, atomic transactions, and concurrency controls.
> 
> **1. Database Engine Constraints:**  
> * **NOT NULL & UNIQUE:** Enforced on `users.email` and compound unique constraint `(user_id, exercise_id, type)` on `personal_records` to prevent duplicate active PRs.
> * **CHECK Constraints:** We enforce strict domain bounds at the database level:
>   * `CHECK (weight_kg >= 0.0 AND weight_kg <= 1000.0)` — prevents negative or impossible weights.
>   * `CHECK (reps > 0 AND reps <= 200)` — prevents 0 or negative reps.
>   * `CHECK (end_time IS NULL OR end_time >= start_time)` — prevents temporal corruption.
> * **Foreign Key Rules:** We use `ON DELETE CASCADE` for subordinate child records (deleting a session automatically deletes its sets) and `ON DELETE RESTRICT` on master `exercises` so that active catalog movements cannot be deleted if historical set logs reference them.
> 
> **2. Transactions & Atomicity:**  
> As you can see in `session.repository.js`, logging sets uses `prisma.$transaction`. Within a single atomic database transaction, the engine inserts multiple set logs, recalculates total session volume, and checks for Personal Record milestones. If any single set fails validation, the entire transaction rolls back (`ROLLBACK`), leaving the database in its clean prior state.
> 
> **3. Concurrency & Isolation:**  
> PostgreSQL uses Multi-Version Concurrency Control (MVCC) with the **Read Committed** isolation level by default. When two operations attempt to update the same user profile or session concurrently, row-level locks prevent dirty writes. For sensitive milestone updates, our compound unique index `(user_id, exercise_id, type)` acts as a lock-free concurrency barrier: if two concurrent sets attempt to insert a duplicate PR record, PostgreSQL immediately triggers a unique key violation (`error code 23505`), preventing duplicate records.
> 
> Let me now demonstrate a constraint rejecting invalid data live on my terminal."

### 💻 Live Demonstration (Intentionally violating a constraint):
Run this in terminal to show PostgreSQL rejecting negative weight:
```sql
-- This will fail with CHECK constraint violation!
INSERT INTO set_logs (id, session_id, exercise_id, set_number, weight_kg, reps)
VALUES (uuid_generate_v4(), 's0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 1, -50.0, 10);
```
*(Point to the screen and say: "As you can see, PostgreSQL immediately rejects the insert with `chk_set_logs_weight_kg` violation, proving data correctness is enforced at the database level.")*

---

# Question 5: How did you make your database usage efficient?

### 🖥️ What to show on screen:
* Open `RajDE/04_DATABASE_SCHEMA_AND_CONSTRAINTS.sql` showing the `CREATE INDEX` statements.
* Run `EXPLAIN ANALYZE` on a query in the terminal.

### 🗣️ Exact Spoken Script:
> "To ensure optimal query performance and scalability, we implemented targeted indexing and analytical optimizations:
> 
> **1. Indexes Created & Queries Supported:**  
> * **Composite Index on Sessions:**  
>   `CREATE INDEX idx_workout_sessions_user_status_time ON workout_sessions(user_id, status, start_time DESC);`  
>   This supports our most frequent query: fetching a user's completed workout history. By indexing `user_id`, `status`, and `start_time DESC` together, PostgreSQL satisfies both the filter and the descending sort in a single B-Tree index scan, eliminating expensive in-memory quicksorts.
> * **Composite Index on Set Logs:**  
>   `CREATE INDEX idx_set_logs_session_exercise ON set_logs(session_id, exercise_id);`  
>   This optimizes joining sets to parent sessions and fetching previous set data for our Tap-To-Fill feature.
> * **Unique Composite Index on Personal Records:**  
>   `UNIQUE INDEX ON personal_records(user_id, exercise_id, type);`  
>   Provides $O(1)$ constant time lookup during real-time PR detection.
> 
> **2. Indexes Considered but Rejected:**  
> We considered adding a B-Tree index on `set_logs.completed_at`. However, we decided against it because `set_logs` is our highest-frequency write table. Every set logged requires an insert; adding an index on `completed_at` would impose write-amplification overhead on disk during live workouts without offering significant read benefits, since set ordering is already handled by `session_id` and `set_number`.
> 
> **3. Scaling Strategy (100x Growth Scenario):**  
> If our user base grew 100 times, the first table that would experience strain is `set_logs`, which would rapidly surpass tens of millions of rows. 
> To handle this growth, we have designed two architectural changes:
> * **Declarative Range Partitioning:** We would partition the `set_logs` table by time (e.g., quarterly or monthly partitions). Queries for recent workouts will prune older partitions automatically.
> * **Read-Replica Architecture with Connection Pooling:** We would route analytical dashboard queries to read-replicas using PgBouncer for connection pooling, while reserving the primary PostgreSQL instance exclusively for live workout writes.
> 
> Let me demonstrate `EXPLAIN ANALYZE` showing an index scan on our session query."

### 💻 Live Query to execute & show on screen:
```sql
EXPLAIN ANALYZE 
SELECT id, name, total_volume_kg, start_time 
FROM workout_sessions 
WHERE user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15' 
  AND status = 'COMPLETED' 
ORDER BY start_time DESC;
```
*(Point to screen and say: "As shown in the execution plan, the query performs an efficient Index Scan, running in sub-millisecond time without table scans.")*

---

## 🏁 Conclusion (Closing statement for the video):
> "In conclusion, FitTrack's database is designed for strong relational integrity, 3NF normalization with calculated denormalization for read performance, atomic transaction protection, and efficient composite indexing. Thank you!"

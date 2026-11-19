# Section G: Data Integrity and Performance Considerations

## 1. Data Integrity and Validation Mechanisms

FitTrack enforces data integrity at two complementary layers: **Database Engine Level (Physical Constraints)** and **Application Layer (Defensive Validation)**.

### A. Engine-Level PostgreSQL Constraints
1. **Domain Integrity via ENUMs:**
   * Restricts fields like `gender`, `goal`, `exercise_category`, `muscle_group`, and `session_status` to strictly valid enumerated values. Any arbitrary text insertion is rejected by PostgreSQL.
2. **Entity Integrity via Primary & Unique Keys:**
   * UUID v4 primary keys prevent collision.
   * `email` on `users` has a unique constraint to prevent duplicate account registration.
   * `(routine_id, order_index)` enforces unique ordering per routine.
   * `(user_id, exercise_id, type)` guarantees only one active record per PR metric.
3. **Referential Integrity via Foreign Keys:**
   * `ON DELETE CASCADE`: Used on `user_profiles`, `workout_routines`, `workout_sessions`, and `set_logs`. If a user or session is deleted, associated subordinate rows are automatically pruned to prevent orphaned data.
   * `ON DELETE RESTRICT`: Used on `exercises`. Master library movements cannot be dropped if set logs or routine exercises currently reference them.
4. **Physical Check Constraints (`CHECK`):**
   * Weight constraints: `CHECK (weight_kg >= 0.0 AND weight_kg <= 1000.0)`
   * Repetition bounds: `CHECK (reps > 0 AND reps <= 200)`
   * RPE exertion bounds: `CHECK (rpe >= 1.0 AND rpe <= 10.0)`
   * Temporal order: `CHECK (end_time IS NULL OR end_time >= start_time)`

---

## 2. Handling Duplicate, Missing, and Invalid Data

| Threat Scenario | Handling Mechanism |
| :--- | :--- |
| **Duplicate User Account** | Database raises PostgreSQL error `23505` (unique violation) on `users.email`. Express error handler translates this into HTTP `409 Conflict` ("Email already registered"). |
| **New User with Zero Workouts** | In analytics calculations (`volumeGrowthPercentage`), divide-by-zero is guarded defensively: `lastWeekVolume === 0 ? 0 : ((thisWeek - lastWeek) / lastWeek) * 100`. |
| **Negative Weight or 0 Reps** | Zod validation middleware at API gateway rejects payloads with HTTP `400 Bad Request` before queries reach the database. Even if bypassed, PostgreSQL `CHECK` constraint halts execution. |
| **Unset Optional Attributes** | Fields like `notes`, `avatar_url`, and `rpe` are declared `NULL` with proper `COALESCE()` and `NULLS LAST` query handling in analytical reporting. |

---

## 3. Comprehensive Indexing Strategy

Indexing optimizes lookup latency from $O(N)$ full table scans to $O(\log N)$ B-Tree lookups:

```
+---------------------------+-----------------------------------+--------------------------------------------------------------+
|        Table Name         |           Indexed Column          |                      Business Justification                  |
+---------------------------+-----------------------------------+--------------------------------------------------------------+
| users                     | email                             | Fast user authentication during login (O(1) index probe).    |
| exercises                 | primary_muscle, category          | Filter chips in mobile exercise picker screen.               |
| exercises                 | is_custom, created_by_id          | Separates global library from user's custom exercises.       |
| workout_sessions          | user_id, status, start_time DESC  | Composite index for rendering Workout History timeline fast. |
| set_logs                  | session_id, exercise_id           | Joins sets to sessions and aggregates volume without scans.  |
| personal_records          | user_id, exercise_id, type        | Instant PR verification when a set is completed.             |
| routine_exercises         | routine_id, order_index           | Renders exercise prescriptions in deterministic sequence.    |
+---------------------------+-----------------------------------+--------------------------------------------------------------+
```

### The Composite Index Advantage:
```sql
CREATE INDEX idx_workout_sessions_user_status_time 
ON workout_sessions(user_id, status, start_time DESC);
```
When querying `SELECT * FROM workout_sessions WHERE user_id = $1 AND status = 'COMPLETED' ORDER BY start_time DESC`, PostgreSQL satisfies the `WHERE` filter and the `ORDER BY` clause using a single index scan, eliminating the costly in-memory sort operation (`Sort Method: quicksort`).

---

## 4. Scalability for Increasing Data Volume

As FitTrack scales from hundreds of users to hundreds of thousands of users logging millions of sets, the database architecture supports the load through the following strategies:

1. **Horizontal Range Partitioning (Time-Series Table Partitioning):**
   * The `set_logs` and `workout_sessions` tables grow linearly with user activity. PostgreSQL native **Declarative Table Partitioning by Range** can partition `set_logs` by month or year:
     ```sql
     CREATE TABLE set_logs_2026_q4 PARTITION OF set_logs
     FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');
     ```
   * Queries for recent workouts automatically prune older partitions, maintaining rapid search performance regardless of historical table size.
2. **Read Replica Architecture with Connection Pooling:**
   * Write transactions (logging sets, creating routines) target the PostgreSQL Primary instance.
   * Analytical dashboards (8-week frequency, PR history, progress charts) target read-only replicas using PgBouncer for lightweight connection multiplexing.
3. **Database Materialized Views for Heavy Analytics:**
   * Complex aggregates (such as career total volume and monthly muscle distribution) can be pre-computed using `MATERIALIZED VIEW` refreshed periodically (`REFRESH MATERIALIZED VIEW CONCURRENTLY`), offloading real-time calculation costs from production OLTP tables.

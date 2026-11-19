# Section E: Query Writing, Execution & Output Analysis

This document details 12 mission-critical, project-specific SQL queries addressing actual business logic inside the FitTrack system.

---

### Query 1: Log a New Workout Set with Validation & Volume Calculation
* **Concepts:** `INSERT`, `uuid_generate_v4()`, `CURRENT_TIMESTAMP`, `RETURNING` clause, calculated expressions.
* **Business Use Case:** Invoked when the user taps "Complete Set" on the workout logging screen in the mobile app.
* **SQL:**
```sql
INSERT INTO set_logs (
    id, session_id, exercise_id, set_number, weight_kg, reps, rpe, is_personal_record, completed_at
) VALUES (
    uuid_generate_v4(),
    's0000004-0000-0000-0000-000000000004',
    'e0000001-0000-0000-0000-000000000001',
    4,
    102.5,
    3,
    9.5,
    TRUE,
    CURRENT_TIMESTAMP
)
RETURNING id, session_id, exercise_id, weight_kg, reps, (weight_kg * reps) AS set_volume_kg;
```
* **Expected Output:**
```
| id                                   | session_id                           | exercise_id                          | weight_kg | reps | set_volume_kg |
|:-------------------------------------|:-------------------------------------|:-------------------------------------|:----------|:-----|:--------------|
| 7a2b9f14-3c82-4f11-9a72-88b17c2f00a1 | s0000004-0000-0000-0000-000000000004 | e0000001-0000-0000-0000-000000000001 | 102.5     | 3    | 307.5         |
```

---

### Query 2: Finalize Completed Workout Session & Recalculate Aggregate Volume
* **Concepts:** `UPDATE`, Correlated Subquery with `SUM()` & `COALESCE()`, `RETURNING`.
* **Business Use Case:** Called when the user presses "Finish Workout" to seal the session duration and compute total tonnage.
* **SQL:**
```sql
UPDATE workout_sessions
SET 
    status = 'COMPLETED',
    end_time = CURRENT_TIMESTAMP,
    total_volume_kg = (
        SELECT COALESCE(SUM(weight_kg * reps), 0)
        FROM set_logs
        WHERE session_id = 's0000004-0000-0000-0000-000000000004'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE id = 's0000004-0000-0000-0000-000000000004'
RETURNING id, name, status, start_time, end_time, total_volume_kg;
```
* **Expected Output:**
```
| id                                   | name                   | status    | start_time          | end_time            | total_volume_kg |
|:-------------------------------------|:-----------------------|:----------|:--------------------|:--------------------|:----------------|
| s0000004-0000-0000-0000-000000000004 | Push Overload Session  | COMPLETED | 2026-11-08 07:00:00 | 2026-11-08 08:20:00 | 7420.0          |
```

---

### Query 3: Delete Routine with Referential Cascade Verification
* **Concepts:** `DELETE`, `ON DELETE CASCADE` testing, multi-condition `WHERE`.
* **Business Use Case:** User deletes an obsolete routine; database automatically cascades delete to `routine_exercises`.
* **SQL:**
```sql
DELETE FROM workout_routines
WHERE id = 'r0000003-0000-0000-0000-000000000003' 
  AND user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
RETURNING id, name;
```
* **Expected Output:**
```
| id                                   | name              |
|:-------------------------------------|:------------------|
| r0000003-0000-0000-0000-000000000003 | Legs & Core Power |
```

---

### Query 4: Filter and Sort Exercise Catalog
* **Concepts:** `SELECT`, Multi-clause `WHERE`, `IN` operator, `ORDER BY` multiple columns.
* **Business Use Case:** Powers the exercise search picker when adding exercises to a routine.
* **SQL:**
```sql
SELECT id, name, category, primary_muscle, equipment, difficulty
FROM exercises
WHERE primary_muscle = 'CHEST'
  AND equipment IN ('BARBELL', 'DUMBBELL')
  AND is_custom = FALSE
ORDER BY difficulty ASC, name ASC;
```
* **Expected Output:**
```
| id                                   | name                  | category | primary_muscle | equipment | difficulty   |
|:-------------------------------------|:----------------------|:---------|:---------------|:----------|:-------------|
| e0000001-0000-0000-0000-000000000001 | Barbell Bench Press   | BARBELL  | CHEST          | BARBELL   | INTERMEDIATE |
| e0000002-0000-0000-0000-000000000002 | Incline Dumbbell Press| DUMBBELL | CHEST          | DUMBBELL  | INTERMEDIATE |
```

---

### Query 5: Full Routine Template Details with Exercise Prescriptions
* **Concepts:** Multi-table `INNER JOIN` (`workout_routines`, `routine_exercises`, `exercises`), sorting by sequence index.
* **Business Use Case:** Renders the workout routine details screen with target sets, target reps, and rest periods.
* **SQL:**
```sql
SELECT 
    r.name AS routine_name,
    re.order_index,
    e.name AS exercise_name,
    e.primary_muscle,
    re.target_sets,
    re.target_reps,
    re.rest_seconds,
    re.notes
FROM workout_routines r
INNER JOIN routine_exercises re ON r.id = re.routine_id
INNER JOIN exercises e ON re.exercise_id = e.id
WHERE r.id = 'r0000001-0000-0000-0000-000000000001'
ORDER BY re.order_index ASC;
```
* **Expected Output:**
```
| routine_name        | order_index | exercise_name         | primary_muscle | target_sets | target_reps | rest_sec | notes                   |
|:--------------------|:------------|:----------------------|:---------------|:------------|:------------|:---------|:------------------------|
| Push Hypertrophy Day| 1           | Barbell Bench Press   | CHEST          | 4           | 6-8         | 120      | Heavy primary compound  |
| Push Hypertrophy Day| 2           | Incline Dumbbell Press| CHEST          | 3           | 8-10        | 90       | Focus on chest stretch  |
| Push Hypertrophy Day| 3           | Overhead Barbell Press| SHOULDERS      | 3           | 8-10        | 90       | Strict military form    |
| Push Hypertrophy Day| 4           | Lateral Dumbbell Raise| SHOULDERS      | 3           | 12-15       | 60       | Burnout side delts      |
| Push Hypertrophy Day| 5           | Tricep Rope Pushdown  | ARMS           | 3           | 10-12       | 60       | Tricep finisher         |
```

---

### Query 6: Weekly Volume and Workout Consistency Aggregation
* **Concepts:** `DATE_TRUNC('week', ...)`, `COUNT()`, `SUM()`, `AVG()`, `GROUP BY`, `HAVING`.
* **Business Use Case:** Generates the Weekly Consistency bar chart on the user's Analytics screen.
* **SQL:**
```sql
SELECT 
    DATE_TRUNC('week', start_time) AS week_start,
    COUNT(id) AS total_sessions,
    ROUND(CAST(SUM(total_volume_kg) AS NUMERIC), 2) AS weekly_volume_kg,
    ROUND(CAST(AVG(total_volume_kg) AS NUMERIC), 2) AS avg_session_volume_kg
FROM workout_sessions
WHERE user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
  AND status = 'COMPLETED'
GROUP BY DATE_TRUNC('week', start_time)
HAVING COUNT(id) >= 1
ORDER BY week_start DESC;
```
* **Expected Output:**
```
| week_start                 | total_sessions | weekly_volume_kg | avg_session_volume_kg |
|:---------------------------|:---------------|:-----------------|:----------------------|
| 2026-11-02 00:00:00+00     | 3              | 23210.00         | 7736.67               |
| 2026-10-26 00:00:00+00     | 1              | 6840.00          | 6840.00               |
```

---

### Query 7: Muscle Group Volume Distribution Analysis
* **Concepts:** Multi-table `JOIN`, `GROUP BY`, Subquery inside scalar projection for percentage calculation, `ROUND()`.
* **Business Use Case:** Displays the Muscle Group Radar/Pie breakdown so users know if they are skipping leg day.
* **SQL:**
```sql
SELECT 
    e.primary_muscle,
    COUNT(sl.id) AS total_sets_completed,
    SUM(sl.reps) AS total_reps_completed,
    ROUND(CAST(SUM(sl.weight_kg * sl.reps) AS NUMERIC), 2) AS total_tonnage_kg,
    ROUND(CAST(
        SUM(sl.weight_kg * sl.reps) * 100.0 / (
            SELECT NULLIF(SUM(s2.weight_kg * s2.reps), 0)
            FROM set_logs s2
            INNER JOIN workout_sessions ws2 ON s2.session_id = ws2.id
            WHERE ws2.user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
        ) AS NUMERIC
    ), 1) AS volume_percentage
FROM set_logs sl
INNER JOIN workout_sessions ws ON sl.session_id = ws.id
INNER JOIN exercises e ON sl.exercise_id = e.id
WHERE ws.user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
GROUP BY e.primary_muscle
ORDER BY total_tonnage_kg DESC;
```
* **Expected Output:**
```
| primary_muscle | total_sets_completed | total_reps_completed | total_tonnage_kg | volume_percentage |
|:---------------|:---------------------|:---------------------|:-----------------|:------------------|
| CHEST          | 9                    | 64                   | 5055.00          | 68.1%             |
| SHOULDERS      | 2                    | 18                   | 1450.00          | 19.5%             |
| ARMS           | 3                    | 32                   | 915.00           | 12.4%             |
```

---

### Query 8: Analytical Window Function - Top 3 Heaviest Lifts per Exercise
* **Concepts:** Window Function `DENSE_RANK() OVER (PARTITION BY ... ORDER BY ...)`, Subquery filtering.
* **Business Use Case:** Detects Personal Record history and top milestone performances.
* **SQL:**
```sql
SELECT 
    ranked_sets.exercise_name,
    ranked_sets.weight_kg,
    ranked_sets.reps,
    ranked_sets.set_volume,
    ranked_sets.completed_at,
    ranked_sets.rank_by_weight
FROM (
    SELECT 
        e.name AS exercise_name,
        sl.weight_kg,
        sl.reps,
        (sl.weight_kg * sl.reps) AS set_volume,
        sl.completed_at,
        DENSE_RANK() OVER (
            PARTITION BY sl.exercise_id 
            ORDER BY sl.weight_kg DESC, sl.reps DESC
        ) AS rank_by_weight
    FROM set_logs sl
    INNER JOIN workout_sessions ws ON sl.session_id = ws.id
    INNER JOIN exercises e ON sl.exercise_id = e.id
    WHERE ws.user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
) ranked_sets
WHERE ranked_sets.rank_by_weight <= 3
ORDER BY ranked_sets.exercise_name, ranked_sets.rank_by_weight;
```
* **Expected Output:**
```
| exercise_name         | weight_kg | reps | set_volume | completed_at        | rank_by_weight |
|:----------------------|:----------|:-----|:-----------|:--------------------|:---------------|
| Barbell Bench Press   | 100.0     | 4    | 400.0      | 2026-11-08 07:20:00 | 1              |
| Barbell Bench Press   | 92.5      | 6    | 555.0      | 2026-11-08 07:15:00 | 2              |
| Barbell Bench Press   | 90.0      | 6    | 540.0      | 2026-11-01 07:18:00 | 3              |
| Incline Dumbbell Press| 32.5      | 8    | 260.0      | 2026-11-01 07:34:00 | 1              |
| Incline Dumbbell Press| 30.0      | 10   | 300.0      | 2026-11-01 07:30:00 | 2              |
```

---

### Query 9: Personal Record Showcase with Inactive Catalog Exercises
* **Concepts:** Multiple `LEFT JOIN` on conditional filters, `NULLS LAST` sorting.
* **Business Use Case:** Renders the PR Screen in React Native, displaying user trophies alongside unattempted exercises.
* **SQL:**
```sql
SELECT 
    e.name AS exercise_name,
    e.primary_muscle,
    pr_weight.value AS max_weight_pr_kg,
    pr_weight.reps AS max_weight_reps,
    pr_weight.achieved_at AS max_weight_date,
    pr_volume.value AS max_volume_pr_kg
FROM exercises e
LEFT JOIN personal_records pr_weight ON e.id = pr_weight.exercise_id 
    AND pr_weight.user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
    AND pr_weight.type = 'MAX_WEIGHT'
LEFT JOIN personal_records pr_volume ON e.id = pr_volume.exercise_id 
    AND pr_volume.user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
    AND pr_volume.type = 'MAX_VOLUME'
WHERE e.is_custom = FALSE
ORDER BY pr_weight.value DESC NULLS LAST;
```
* **Expected Output:**
```
| exercise_name         | primary_muscle | max_weight_pr_kg | max_weight_reps | max_weight_date     | max_volume_pr_kg |
|:----------------------|:---------------|:-----------------|:----------------|:--------------------|:-----------------|
| Barbell Deadlift      | BACK           | 170.0            | 2               | 2026-11-03 08:15:00 | NULL             |
| Barbell Back Squat    | LEGS           | 140.0            | 3               | 2026-11-05 07:45:00 | NULL             |
| Barbell Bench Press   | CHEST          | 100.0            | 4               | 2026-11-08 07:20:00 | 800.0            |
| Incline Dumbbell Press| CHEST          | NULL             | NULL            | NULL                | NULL             |
| Lat Pulldown          | BACK           | NULL             | NULL            | NULL                | NULL             |
```

---

### Query 10: Fetch Previous Workout Sets for Tap-To-Fill Feature
* **Concepts:** Correlated Subquery with `ORDER BY start_time DESC LIMIT 1`.
* **Business Use Case:** Pre-fills weights and reps as placeholder hints in the React Native logger from the last time the exercise was performed.
* **SQL:**
```sql
SELECT 
    sl.exercise_id,
    sl.set_number,
    sl.weight_kg AS previous_weight_kg,
    sl.reps AS previous_reps,
    ws.start_time AS last_performed_date
FROM set_logs sl
INNER JOIN workout_sessions ws ON sl.session_id = ws.id
WHERE ws.user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
  AND sl.exercise_id = 'e0000001-0000-0000-0000-000000000001'
  AND ws.id = (
      SELECT ws_sub.id 
      FROM workout_sessions ws_sub
      INNER JOIN set_logs sl_sub ON ws_sub.id = sl_sub.session_id
      WHERE ws_sub.user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
        AND sl_sub.exercise_id = 'e0000001-0000-0000-0000-000000000001'
        AND ws_sub.status = 'COMPLETED'
      ORDER BY ws_sub.start_time DESC
      LIMIT 1
  )
ORDER BY sl.set_number ASC;
```
* **Expected Output:**
```
| exercise_id                          | set_number | previous_weight_kg | previous_reps | last_performed_date |
|:-------------------------------------|:-----------|:-------------------|:--------------|:--------------------|
| e0000001-0000-0000-0000-000000000001 | 1          | 85.0               | 8             | 2026-11-08 07:00:00 |
| e0000001-0000-0000-0000-000000000001 | 2          | 92.5               | 6             | 2026-11-08 07:00:00 |
| e0000001-0000-0000-0000-000000000001 | 3          | 100.0              | 4             | 2026-11-08 07:00:00 |
```

---

### Query 11: Strength Progression Time-Series for Individual Exercise
* **Concepts:** Time-bucket aggregation with `DATE_TRUNC`, `MAX()`, `AVG()`.
* **Business Use Case:** Renders the Strength Progression Line Chart tracking progressive overload over 8 weeks.
* **SQL:**
```sql
SELECT 
    DATE_TRUNC('week', sl.completed_at) AS workout_week,
    MAX(sl.weight_kg) AS weekly_top_weight_kg,
    ROUND(CAST(AVG(sl.weight_kg * sl.reps) AS NUMERIC), 2) AS avg_set_volume_kg,
    COUNT(sl.id) AS sets_logged
FROM set_logs sl
INNER JOIN workout_sessions ws ON sl.session_id = ws.id
WHERE ws.user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
  AND sl.exercise_id = 'e0000001-0000-0000-0000-000000000001'
GROUP BY DATE_TRUNC('week', sl.completed_at)
ORDER BY workout_week ASC;
```
* **Expected Output:**
```
| workout_week               | weekly_top_weight_kg | avg_set_volume_kg | sets_logged |
|:---------------------------|:---------------------|:------------------|:------------|
| 2026-10-26 00:00:00+00     | 90.0                 | 612.50            | 4           |
| 2026-11-02 00:00:00+00     | 100.0                | 465.00            | 3           |
```

---

### Query 12: Executive KPI Dashboard Overview
* **Concepts:** Multi-table `LEFT JOIN`, `COUNT(DISTINCT ...)`, `COALESCE()`.
* **Business Use Case:** Powers the home overview metric cards (Total Workouts, Career Volume, PRs Broken).
* **SQL:**
```sql
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    up.weight_kg AS current_weight,
    up.target_weight_kg,
    COUNT(DISTINCT ws.id) AS total_workouts_completed,
    COALESCE(SUM(ws.total_volume_kg), 0) AS total_career_volume_kg,
    COUNT(DISTINCT pr.id) AS total_prs_achieved
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN workout_sessions ws ON u.id = ws.user_id AND ws.status = 'COMPLETED'
LEFT JOIN personal_records pr ON u.id = pr.user_id
WHERE u.id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
GROUP BY u.id, u.name, up.weight_kg, up.target_weight_kg;
```
* **Expected Output:**
```
| user_id                              | user_name            | current_weight | target_weight_kg | total_workouts | total_career_volume_kg | total_prs |
|:-------------------------------------|:---------------------|:---------------|:-----------------|:---------------|:-----------------------|:----------|
| 809d7c77-4ecc-4ff3-9f20-8c3408d76d15 | Alex Hunter (Demo)   | 78.50          | 82.00            | 4              | 30630.0                | 4         |
```

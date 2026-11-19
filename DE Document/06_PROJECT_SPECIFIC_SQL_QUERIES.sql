-- ============================================================================
-- FitTrack Progressive Overload & Fitness Tracking System
-- Section E: 12 Project-Specific SQL Queries with Real Business Use Cases
-- Author / Backend Lead: Raj Kumar
-- ============================================================================

-- ----------------------------------------------------------------------------
-- QUERY 1 (DML - INSERT): Log a New Workout Set with Validation
-- Business Requirement: Called when user taps "Complete Set" in workout logger.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 2 (DML - UPDATE): Update Completed Workout Session Aggregate Metrics
-- Business Requirement: Finalize workout session, calculate end time & total volume.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 3 (DML - DELETE): Delete a Routine with Cascade Verification
-- Business Requirement: User deletes an unwanted routine; tests ON DELETE CASCADE.
-- ----------------------------------------------------------------------------
DELETE FROM workout_routines
WHERE id = 'r0000003-0000-0000-0000-000000000003' 
  AND user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
RETURNING id, name;

-- ----------------------------------------------------------------------------
-- QUERY 4 (FILTERING & SORTING): Exercise Catalog Search with Multi-Filter
-- Business Requirement: Frontend exercise picker filtering by muscle, category and search term.
-- ----------------------------------------------------------------------------
SELECT 
    id,
    name,
    category,
    primary_muscle,
    equipment,
    difficulty
FROM exercises
WHERE primary_muscle = 'CHEST'
  AND equipment IN ('BARBELL', 'DUMBBELL')
  AND is_custom = FALSE
ORDER BY difficulty ASC, name ASC;

-- ----------------------------------------------------------------------------
-- QUERY 5 (MULTI-TABLE JOIN): Full Routine Template Details with Exercise Prescriptions
-- Business Requirement: Load full routine preview screen before user starts workout.
-- ----------------------------------------------------------------------------
SELECT 
    r.id AS routine_id,
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

-- ----------------------------------------------------------------------------
-- QUERY 6 (AGGREGATION - GROUP BY & HAVING): Weekly Volume & Workout Consistency
-- Business Requirement: Powers the weekly frequency bar chart on the Analytics dashboard.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 7 (AGGREGATION & SUBQUERY): Muscle Group Volume Distribution Analysis
-- Business Requirement: Breakdown of total tonnage lifted per primary muscle group.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 8 (WINDOW FUNCTION): Rank Top Lifts to Detect All-Time PRs
-- Business Requirement: Computes the top 3 heaviest lifts per exercise for a user.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 9 (LEFT JOIN): Personal Records Showcase with Inactive Exercises
-- Business Requirement: PR showcase screen showing user's current records alongside catalog.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 10 (CORRELATED SUBQUERY): Fetch Previous Workout Sets for Tap-To-Fill
-- Business Requirement: When logging bench press, pre-fill what user lifted LAST TIME.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 11 (TIME-SERIES AGGREGATION): Strength Progression Line Chart
-- Business Requirement: Progressive overload curve (Weekly max weight for Bench Press).
-- ----------------------------------------------------------------------------
SELECT 
    DATE_TRUNC('week', sl.completed_at) AS workout_week,
    MAX(sl.weight_kg) AS weekly_top_weight_kg,
    AVG(sl.weight_kg * sl.reps) AS avg_set_volume_kg,
    COUNT(sl.id) AS sets_logged
FROM set_logs sl
INNER JOIN workout_sessions ws ON sl.session_id = ws.id
WHERE ws.user_id = '809d7c77-4ecc-4ff3-9f20-8c3408d76d15'
  AND sl.exercise_id = 'e0000001-0000-0000-0000-000000000001'
GROUP BY DATE_TRUNC('week', sl.completed_at)
ORDER BY workout_week ASC;

-- ----------------------------------------------------------------------------
-- QUERY 12 (COMPLEX JOIN & COALESCE): User Overview Executive Dashboard Summary
-- Business Requirement: Powers the Top KPI cards on the Home Dashboard.
-- ----------------------------------------------------------------------------
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

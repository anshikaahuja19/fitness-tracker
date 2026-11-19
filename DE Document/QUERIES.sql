-- ============================================================================
-- FitTrack - 10 Essential Project-Specific SQL Queries for Viva & Evaluation
-- Author: Raj Kumar (Backend & Database Lead)
-- ============================================================================

-- 1. [INSERT]: Log a completed set for an exercise in a session
INSERT INTO set_logs (id, session_id, exercise_id, set_number, weight_kg, reps, rpe)
VALUES (uuid_generate_v4(), 'session-id-here', 'exercise-id-here', 1, 80.0, 10, 8.0);

-- 2. [UPDATE]: Finalize a completed workout session with total volume
UPDATE workout_sessions
SET status = 'COMPLETED',
    end_time = CURRENT_TIMESTAMP,
    total_volume_kg = (
        SELECT COALESCE(SUM(weight_kg * reps), 0)
        FROM set_logs
        WHERE session_id = 'session-id-here'
    )
WHERE id = 'session-id-here';

-- 3. [DELETE]: Delete a routine (Cascades to routine_exercises automatically)
DELETE FROM workout_routines
WHERE id = 'routine-id-here' AND user_id = 'user-id-here';

-- 4. [SELECT with FILTER & SORT]: Filter exercises by muscle and category
SELECT name, primary_muscle, category, equipment, difficulty
FROM exercises
WHERE primary_muscle = 'CHEST' AND equipment = 'BARBELL'
ORDER BY difficulty ASC, name ASC;

-- 5. [INNER JOIN]: Fetch full routine template with all exercises and prescribed reps/sets
SELECT r.name AS routine_name, re.order_index, e.name AS exercise_name, re.target_sets, re.target_reps
FROM workout_routines r
INNER JOIN routine_exercises re ON r.id = re.routine_id
INNER JOIN exercises e ON re.exercise_id = e.id
WHERE r.id = 'routine-id-here'
ORDER BY re.order_index ASC;

-- 6. [AGGREGATION + GROUP BY]: Weekly workout frequency and total volume for charts
SELECT DATE_TRUNC('week', start_time) AS week_start,
       COUNT(id) AS total_workouts,
       SUM(total_volume_kg) AS weekly_volume
FROM workout_sessions
WHERE user_id = 'user-id-here' AND status = 'COMPLETED'
GROUP BY DATE_TRUNC('week', start_time)
ORDER BY week_start DESC;

-- 7. [HAVING]: Find exercises where user has logged more than 5 total sets
SELECT e.name, COUNT(sl.id) AS total_sets, MAX(sl.weight_kg) AS top_weight
FROM set_logs sl
INNER JOIN exercises e ON sl.exercise_id = e.id
GROUP BY e.name
HAVING COUNT(sl.id) >= 5;

-- 8. [LEFT JOIN]: Show user's Personal Records (PR) alongside exercise catalog
SELECT e.name AS exercise, pr.type, pr.value AS pr_value, pr.reps
FROM exercises e
LEFT JOIN personal_records pr ON e.id = pr.exercise_id AND pr.user_id = 'user-id-here'
WHERE e.is_custom = FALSE
ORDER BY pr.value DESC NULLS LAST;

-- 9. [SUBQUERY]: Find the heaviest single set logged by a specific user
SELECT e.name AS exercise, sl.weight_kg, sl.reps, sl.completed_at
FROM set_logs sl
INNER JOIN exercises e ON sl.exercise_id = e.id
WHERE sl.weight_kg = (
    SELECT MAX(weight_kg) 
    FROM set_logs sl2
    INNER JOIN workout_sessions ws ON sl2.session_id = ws.id
    WHERE ws.user_id = 'user-id-here'
);

-- 10. [AGGREGATION]: Home Dashboard KPI cards (Total Workouts, Total Volume, Total PRs)
SELECT u.name,
       COUNT(DISTINCT ws.id) AS total_workouts,
       COALESCE(SUM(ws.total_volume_kg), 0) AS total_volume_lifted,
       COUNT(DISTINCT pr.id) AS total_prs
FROM users u
LEFT JOIN workout_sessions ws ON u.id = ws.user_id AND ws.status = 'COMPLETED'
LEFT JOIN personal_records pr ON u.id = pr.user_id
WHERE u.id = 'user-id-here'
GROUP BY u.name;

# Section F: Database and Backend Integration Evidence

## 1. Integration Architecture Overview

The FitTrack backend application utilizes a decoupled **Layered Repository-Controller Pattern** built on **Node.js (Express.js)** and **Prisma ORM**, interfacing directly with a managed **PostgreSQL 16** database.

```
+--------------------------------------------------------------------------+
|                       FitTrack React Native Client                       |
|           (Mobile UI Screens: Auth, Routines, Logger, Charts)            |
+--------------------------------------------------------------------------+
                                     |
                                     | RESTful JSON HTTP Requests (JWT Bearer)
                                     v
+--------------------------------------------------------------------------+
|                     Express.js Web Application Layer                     |
|           Routes -> Security (Helmet, RateLimit) -> Middleware           |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|                            Controller Layer                              |
|           Request Validation (Zod) -> Business Logic Execution           |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|                            Repository Layer                              |
|           Encapsulates Prisma Client Queries & Relational Logic          |
+--------------------------------------------------------------------------+
                                     |
                                     | Connection Pool (`pg` driver / socket)
                                     v
+--------------------------------------------------------------------------+
|                           PostgreSQL 16 Engine                           |
|        Transactions, Referential Integrity, Indexing, Disk Storage        |
+--------------------------------------------------------------------------+
```

---

## 2. Code Evidence: How the Application Performs Database CRUD

### A. CREATE Operation (Atomic Transaction for Logging Sets & PRs)
**File:** `backend/src/repository/session.repository.js` & `backend/src/services/prDetection.service.js`

When a user logs a batch of completed sets, Prisma executes an atomic database transaction (`prisma.$transaction`) to write the set logs and update the parent session:

```javascript
// Database Insertion via Prisma ORM
const appendSetsToSession = async (sessionId, sets) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Bulk insert set logs
        const createdSets = await Promise.all(
            sets.map((set, idx) =>
                tx.setLog.create({
                    data: {
                        sessionId,
                        exerciseId: set.exerciseId,
                        setNumber: idx + 1,
                        weightKg: parseFloat(set.weightKg),
                        reps: parseInt(set.reps, 10),
                        rpe: set.rpe ? parseFloat(set.rpe) : null,
                    },
                })
            )
        );

        // 2. Aggregate total session volume
        const sessionSets = await tx.setLog.findMany({
            where: { sessionId },
            select: { weightKg: true, reps: true },
        });

        const totalVolume = sessionSets.reduce(
            (sum, s) => sum + s.weightKg * s.reps, 
            0
        );

        // 3. Update parent session with aggregated tonnage
        await tx.workoutSession.update({
            where: { id: sessionId },
            data: { totalVolumeKg: totalVolume },
        });

        return createdSets;
    });
};
```
* **Underlying SQL Generated:**
  ```sql
  BEGIN;
  INSERT INTO set_logs (id, session_id, exercise_id, set_number, weight_kg, reps, rpe)
  VALUES ('uuid-1', 'session-1', 'exercise-1', 1, 100.0, 5, 8.5);
  SELECT weight_kg, reps FROM set_logs WHERE session_id = 'session-1';
  UPDATE workout_sessions SET total_volume_kg = 500.0 WHERE id = 'session-1';
  COMMIT;
  ```

---

### B. READ Operation (Relational Retrieval with Filtering & Pagination)
**File:** `backend/src/repository/exercise.repository.js`

Fetches master exercises matching filters while supporting custom user-created exercises:

```javascript
const listExercises = async (userId, filters) => {
    const where = {
        AND: [
            // User sees global catalog (createdById: null) OR their own custom exercises
            { OR: [{ createdById: null }, { createdById: userId }] },
            filters.muscle ? { primaryMuscle: filters.muscle } : {},
            filters.category ? { category: filters.category } : {},
            filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {},
        ]
    };

    const [items, total] = await prisma.$transaction([
        prisma.exercise.findMany({
            where,
            orderBy: { name: 'asc' },
            skip: (filters.page - 1) * filters.limit,
            take: filters.limit,
        }),
        prisma.exercise.count({ where }),
    ]);

    return { items, total };
};
```
* **Underlying SQL Generated:**
  ```sql
  SELECT * FROM exercises 
  WHERE (created_by_id IS NULL OR created_by_id = $1)
    AND primary_muscle = $2
  ORDER BY name ASC 
  OFFSET $3 LIMIT $4;
  ```

---

### C. UPDATE Operation (User Profile & Biometric Progress)
**File:** `backend/src/repository/user.repository.js`

```javascript
const updateUserProfile = async (userId, data) => {
    return await prisma.userProfile.upsert({
        where: { userId },
        update: {
            weightKg: data.weightKg,
            targetWeightKg: data.targetWeightKg,
            goal: data.goal,
            activityLevel: data.activityLevel,
            updatedAt: new Date(),
        },
        create: {
            userId,
            ...data,
        },
    });
};
```
* **Underlying SQL Generated:**
  ```sql
  INSERT INTO user_profiles (id, user_id, weight_kg, target_weight_kg, goal, activity_level)
  VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
  ON CONFLICT (user_id) DO UPDATE SET
      weight_kg = EXCLUDED.weight_kg,
      target_weight_kg = EXCLUDED.target_weight_kg,
      goal = EXCLUDED.goal,
      updated_at = NOW();
  ```

---

### D. DELETE Operation (Cascading Routine Removal)
**File:** `backend/src/repository/routine.repository.js`

```javascript
const deleteRoutine = async (id, userId) => {
    // Verifies ownership before deletion
    return await prisma.workoutRoutine.delete({
        where: {
            id,
            userId, // Security guard: Prevents users from deleting other people's routines
        },
    });
};
```
* **Underlying SQL Generated:**
  ```sql
  DELETE FROM workout_routines WHERE id = $1 AND user_id = $2;
  -- Foreign key ON DELETE CASCADE automatically removes associated routine_exercises rows in PostgreSQL
  ```

---

## 3. Communication and Connection Pool Management

The backend establishes communication with PostgreSQL using `@prisma/adapter-pg` and the Node.js `pg` driver:

1. **Connection String Injection:** Configured securely via environment variables (`DATABASE_URL=postgresql://user:password@host:5432/fittrack_db?sslmode=require`).
2. **Connection Pooling:** Maintains an active pool of up to 10-20 persistent database connections, eliminating the latency of opening a new TCP socket per API call.
3. **Graceful Shutdown:** Implemented in `server.js` using `process.on('SIGTERM', async () => await prisma.$disconnect())` to release socket handles cleanly.

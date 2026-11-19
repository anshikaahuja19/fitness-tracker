# Database Engineering (DE) Portfolio - FitTrack

**Project Name:** FitTrack - Progressive Overload & Fitness Tracking System  
**Module:** Database Management Systems (DBMS) / Database Engineering (DE)  
**Author / Backend & Database Lead:** Raj Kumar  
**Target Database:** PostgreSQL 16 (Relational Database Management System)

---

# Section A: Database Selection and Justification

## 1. Selected Database
For the **FitTrack** application, **PostgreSQL** was selected as the primary Database Management System (DBMS), operated via **Prisma ORM** with raw SQL query execution capabilities.

---

## 2. Nature of Data Stored in FitTrack
A fitness and workout progression tracking application deals with structured, interconnected, transactional, and time-series relational data:

| Data Category | Examples | Relational Characteristics |
| :--- | :--- | :--- |
| **User & Profile Entity** | Account credentials, physical attributes (height, weight, target weight), fitness goals. | Strict 1-to-1 relationship with unique constraints (`user_id`, `email`). |
| **Exercise Catalog** | Exercise names, categories, primary/secondary muscle groups, required equipment. | Reusable master catalog entity referenced by thousands of user routines and workouts. |
| **Workout Routines (Templates)** | Push, Pull, Legs splits, routine orders, target rep/set parameters. | Hierarchical 1-to-Many relationship (`Routine -> RoutineExercises`). |
| **Logged Workout Sessions** | Workout timestamp, duration, total session tonnage/volume, status. | Strict time-series relational records tied to specific users and optional routines. |
| **Set Logs** | Set index, actual weight lifted, reps completed, RPE (Rate of Perceived Exertion), PR status. | High-volume granular relational records tied via foreign key to `session_id` and `exercise_id`. |
| **Personal Records (Milestones)** | Max weight lifted, max volume per set, historical milestone attribution. | Strict business-rule driven records derived from analytical comparison across historical set logs. |

---

## 3. Justification: PostgreSQL vs. MongoDB

We conducted a technical trade-off analysis between a Relational DBMS (**PostgreSQL**) and a Document-oriented NoSQL DBMS (**MongoDB**):

```
+------------------------------------+------------------------------------+
|       PostgreSQL (Selected)        |        MongoDB (Evaluated)         |
+------------------------------------+------------------------------------+
| Strong ACID Compliance:            | Eventual Consistency:              |
| Guarantees immediate consistency   | Complex multi-document             |
| across sessions, sets, and PRs.    | transactions add overhead.         |
|                                    |                                    |
| Normalized Relational Structure:   | Document Embedding Denormalization:|
| Exercises are stored once. Routine | Embedding exercises duplicates data|
| exercises and set logs reference   | and causes update anomalies when   |
| the master ID.                     | exercise attributes change.        |
|                                    |                                    |
| Complex Relational Joins:          | Unwieldy Aggregation Pipelines:    |
| Native JOIN operations efficiently | Multiple $lookup stages for sets,  |
| combine Users, Sessions, Sets,     | sessions, and exercises introduce  |
| and Exercises for analytics.       | query latency and memory overhead. |
|                                    |                                    |
| Data Integrity Constraints:        | Loose Document Schema:             |
| Foreign keys with ON DELETE        | Validation at application level;   |
| CASCADE, CHECK constraints, and    | risk of orphan set logs or         |
| UNIQUE constraints prevent corrupt | invalid enum strings entering the  |
| database state at engine level.    | database.                          |
+------------------------------------+------------------------------------+
```

### Why PostgreSQL is the Ideal Choice:
1. **Strict Relational Integrity via Foreign Keys:**
   * In workout tracking, an orphan `SetLog` (a set with no parent session or non-existent exercise) invalidates analytics and progressive overload calculations. PostgreSQL guarantees referential integrity at the engine level through foreign keys with `ON DELETE CASCADE` and `ON DELETE RESTRICT`.
2. **ACID Transaction Support for PR Milestones:**
   * When a workout session is logged, inserting multiple sets, recalculating total volume, and detecting new Personal Records (PRs) must occur atomically. If inserting set #3 fails, the entire session must roll back to avoid partial, corrupt state. PostgreSQL provides full multi-statement ACID transactions (`BEGIN ... COMMIT / ROLLBACK`).
3. **Advanced Analytics with Window Functions & Aggregations:**
   * FitTrack features weekly volume progression charts, 8-week frequency bar charts, and 1RM (One Rep Max) tracking. PostgreSQL offers superior aggregate functions (`SUM`, `AVG`, `COUNT`), window functions (`ROW_NUMBER()`, `RANK() OVER (PARTITION BY ...)`), and date-truncation (`DATE_TRUNC('week', start_time)`).
4. **Elimination of Data Redundancy:**
   * In a NoSQL document database like MongoDB, embedding exercise details in every set duplicates exercise names, categories, and instructions millions of times. In PostgreSQL, standard 3NF schema design stores 55-60 master exercises once, referencing them via 16-byte UUID foreign keys.

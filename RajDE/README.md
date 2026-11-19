# FitTrack Database Engineering (DE) Portfolio

**Student Name / Author:** Raj Kumar  
**Role:** Backend, Database & DevOps Lead  
**Project:** FitTrack - Progressive Overload & Fitness Tracking System  
**Target RDBMS:** PostgreSQL 16 (Object-Relational DBMS) with Prisma ORM  
**Date:** November 2026  

---

## 📂 Deliverables Index in `RajDE/`

| Document / Script | Description | Evaluated Requirement |
| :--- | :--- | :--- |
| **`01_DATABASE_SELECTION_AND_JUSTIFICATION.md`** | PostgreSQL selection analysis, nature of fitness data, trade-off comparison with MongoDB, ACID guarantees. | Section 2.A |
| **`02_DATA_MODEL_AND_ER_DIAGRAM.md`** | 8 entity specifications, PKs, FKs, constraints, Cardinality (1:1, 1:N, M:N), and Mermaid ER Diagram. | Section 2.B |
| **`03_DATABASE_NORMALIZATION.md`** | Un-normalized anomalies demonstration, Functional Dependencies, step-by-step walkthrough of 1NF, 2NF, and 3NF. | Section 2.C |
| **`04_DATABASE_SCHEMA_AND_CONSTRAINTS.sql`** | Raw PostgreSQL 16 DDL: Tables, Enums, Constraints (CHECK, UNIQUE, NOT NULL, CASCADE), and Composite Indexes. | Section 2.D |
| **`05_SAMPLE_DATA_POPULATION.sql`** | Realistic seed DML: Users, Profiles, Master Exercise catalog, Push/Pull/Legs Routines, Workout Sessions, Set Logs, PRs. | Section 2.D |
| **`06_PROJECT_SPECIFIC_SQL_QUERIES.sql`** | 12 mission-critical SQL queries covering CRUD, multi-table JOINs, GROUP BY/HAVING, Subqueries, and Window Functions. | Section 2.E |
| **`06_PROJECT_SPECIFIC_SQL_QUERIES.md`** | Comprehensive documentation of the 12 queries: Business requirements, technical concepts used, and expected execution tables. | Section 2.E |
| **`07_BACKEND_INTEGRATION_EVIDENCE.md`** | Explanation of Node.js/Express + Prisma ORM to PostgreSQL integration with real repository code snippets for all CRUD operations. | Section 2.F |
| **`08_DATA_INTEGRITY_AND_PERFORMANCE.md`** | Dual-layer validation, edge-case defensive programming, composite indexing strategy, and database scalability architectures. | Section 2.G |

---

## 🎯 Executive Summary for Evaluators

1. **Relational Fitness Data Modeling:**  
   FitTrack was designed around progressive overload metrics (volume, sets, reps, weight) and athlete profiles. We chose **PostgreSQL** over MongoDB due to strict referential integrity requirements (preventing orphaned set logs), ACID transactions (atomic multi-set logging and PR detection), and powerful analytical aggregation capabilities.

2. **Rigorous 3NF Normalization:**  
   The schema cleanly separates authentication (`users`), biometric parameters (`user_profiles`), master catalog movements (`exercises`), template splits (`workout_routines`), prescriptive junctions (`routine_exercises`), realized instances (`workout_sessions`), granular execution (`set_logs`), and milestones (`personal_records`), fully eliminating insertion, update, and deletion anomalies.

3. **High Performance via Indexing:**  
   Composite indexes such as `(user_id, status, start_time DESC)` on workout sessions allow instantaneous rendering of historical workouts without costly in-memory sorts.

4. **100% Integrated & Production Verified:**  
   All database operations are integrated into the live Express backend repository layer and tested across automated smoke testing suites.

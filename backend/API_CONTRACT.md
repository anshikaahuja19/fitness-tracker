# FitTrack API Contract & Integration Guide

Production Base URL: `https://fittrack-backend-ny70.onrender.com`  
React Native Base URL: `https://fittrack-backend-ny70.onrender.com/api`

---

## 🔐 Authentication & Headers

Protected routes accept **either**:
1. `Authorization: Bearer <JWT_TOKEN>`
2. `x-user-id: <USER_UUID>` (fallback for local client development)

All requests containing a body must include:
```http
Content-Type: application/json
```

---

## 📋 Endpoints Overview

### 1. Health & Status
* `GET /health` or `GET /api/health` — Returns service status and uptime.

### 2. Authentication
* `POST /api/auth/register`
  * Body: `{ "email": "...", "password": "...", "name": "..." }`
  * Status: `201 Created`
* `POST /api/auth/login`
  * Body: `{ "email": "...", "password": "..." }`
  * Response: `{ "success": true, "token": "...", "user": { ... } }`

### 3. Exercises Catalog
* `GET /api/exercises` — Paginated exercise list with muscle group filter (`?muscle=Chest&equipment=Dumbbell`).
* `GET /api/exercises/options` — Lightweight dropdown list of all active exercises.
* `GET /api/exercises/previous-sets?ids=id1,id2` — Fetch last logged weights and reps for auto-filling logger screens.
* `POST /api/exercises` — Create custom exercise (authenticated).

### 4. Workout Routines
* `GET /api/routines` — List user's saved routines with exercise relations.
* `POST /api/routines` — Create a routine with exercises and target set counts.
* `GET /api/routines/:id` — Routine details.
* `PUT /api/routines/:id/exercises` — Reorder or update exercises in routine.
* `DELETE /api/routines/:id` — Delete user routine.

### 5. Workout Sessions & Logging
* `GET /api/sessions` — Workout session history ordered by date.
* `POST /api/sessions` — Start or record a workout session with sets.
* `GET /api/sessions/:id` — Session details with completed sets and PR markers.
* `PATCH /api/sessions/:id` — Update notes or end time.
* `GET /api/sessions/:id/sets` — Fetch sets logged in a specific session.
* `POST /api/sessions/:id/sets` — Append a completed set (triggers auto-PR check).
* `PUT /api/sessions/:id/sets` — Batch replace or update sets for a session.

### 6. Personal Records (PRs)
* `GET /api/prs` — Full PR showcase across all exercises (Max Weight & Max Volume).
* `GET /api/prs/exercise/:exerciseId` — PR history for a specific exercise.

### 7. Analytics & Progress
* `GET /api/analytics/summary` — Weekly workout count, total volume (kg), streak, and active days.
* `GET /api/analytics/charts` — Aggregated progression data for charts.
* `GET /api/analytics/charts/weekly-frequency` — 8-week workout frequency bar chart data.
* `GET /api/analytics/charts/strength-progression/:exerciseId` — 8-week max-weight progression line chart.

### 8. User Profile
* `GET /api/users/profile` — User profile, body weight, fitness goals.
* `PUT /api/users/profile` — Update fitness goals, weight, experience level.

---

## 🧪 Demo Credentials for Mobile Testing
* **Email:** `demo@fittrack.com`
* **Password:** `Password123!`
* Pre-populated with 30-day realistic progressive overload history, Push/Pull/Legs routines, and historical PRs.

# FitTrack - Simple Backend & Database Viva Guide
*(Aapko Teacher ke samne kya bolna hai - Simple & Direct Answers)*

---

## 1. Teacher ka pehla sawal: "Is project mein tumhara role kya tha?"
**Aapko bolna hai:**
> "Sir, is project mein main **Backend & Database Lead** tha. Maine:
> 1. PostgreSQL database design kiya with 8 tables.
> 2. Node.js aur Express use karke REST APIs banayi (Auth, Routines, Workout Logging, PR detection, Analytics).
> 3. Database ko Render cloud platform par live deploy kiya."

---

## 2. "Database kaunsa use kiya aur wahi kyu choose kiya? (PostgreSQL vs MongoDB)"
**Aapko bolna hai:**
> "Sir, humne **PostgreSQL** choose kiya because:
> 1. Hamara fitness data relational hai — ek user ke multiple routines hain, ek routine ke exercises hain, aur ek workout session ke andar multiple sets hain.
> 2. **Data Integrity:** PostgreSQL mein Foreign Keys (`ON DELETE CASCADE`) se orphan data prevent hota hai. Agar MongoDB mein exercise embed karte toh data duplicate hota.
> 3. **ACID Transactions:** Jab user workout save karta hai, multiple sets ek sath save hone chahiye — iske liye relational database best hai."

---

## 3. "Database Schema mein kaunse models hain?"
**Aapko bolna hai:**
> "Sir, total 8 tables hain:
> 1. `users` — Login email aur password hash store hota hai.
> 2. `user_profiles` — User ka weight, height aur fitness goal (1-to-1 with User).
> 3. `exercises` — 55+ gym exercises ka catalog (Bench press, Squat, etc.).
> 4. `workout_routines` — Workout split templates jaise Push Day, Pull Day (1-to-Many with User).
> 5. `routine_exercises` — Routine aur Exercise ka relation (target sets aur reps).
> 6. `workout_sessions` — User ne kab workout kiya aur total volume kitna tha.
> 7. `set_logs` — Har set ka weight aur reps (1-to-Many with Session).
> 8. `personal_records` — User ka all-time highest weight ya volume PR."

---

## 4. "Database Normalization kaise kiya? (1NF, 2NF, 3NF)"
**Aapko bolna hai:**
> "Sir, humne schema ko **3NF (Third Normal Form)** tak normalize kiya hai taaki redundant data na rahe:
> * **1NF:** Har column mein single atomic value hai (sets ko array ya string mein nahi rakha, har set ki alag row hai).
> * **2NF:** Partial dependency remove ki — `session` metadata (name, date) aur `set` metrics (weight, reps) ko alag tables mein divide kiya.
> * **3NF:** Transitive dependency remove ki — exercise details (`muscle_group`, `equipment`) ko `set_logs` se nikal kar alag `exercises` catalog table mein daal diya. Isse update aur delete anomalies khatam ho gayi."

---

## 5. "PR (Personal Record) calculation kaise kaam karta hai?"
**Aapko bolna hai:**
> "Sir, jab user naya set log karta hai, backend do checks karta hai:
> 1. **Max Weight PR:** Kya is exercise ke liye current weight pichle record se zyada hai?
> 2. **Max Volume PR:** Single set ka volume (`Weight × Reps`) pichle volume record se zyada hai kya?
> Agar naya PR banta hai, toh `personal_records` table update hoti hai aur frontend ko response mein PR alert milta hai."

---

## 6. "Security aur Performance ke liye kya kiya?"
**Aapko bolna hai:**
> "Sir, 3 main cheezein ki:
> 1. **Password Security:** `bcryptjs` se passwords hash karke store kiye.
> 2. **Rate Limiting & Helmet:** `express-rate-limit` lagaya DDoS aur brute force attacks rokne ke liye, aur `helmet` secure HTTP headers ke liye.
> 3. **Database Indexing:** Frequent queries par Composite Index lagaya (jaise `user_id, status, start_time DESC`) taaki workout history fast load ho."

---

## 7. "Frontend team ke sath integrate kaise kiya?"
**Aapko bolna hai:**
> "Sir, mobile team (React Native) ke liye humne clean REST APIs banayi. Initially unko 404 error aa raha tha kyunki unka frontend `/api/exercises` call kar raha tha jabki routes root par the. Maine routes ko multi-prefix mount kar diya (`/api/*` aur root `/*`), jisse sabhi mobile screens bina kisi error ke connect ho gayi."

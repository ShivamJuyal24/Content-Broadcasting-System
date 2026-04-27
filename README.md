# Content Broadcasting System

A backend system that allows teachers to upload content (question papers, announcements, materials), principals to approve it, and students to access live/scheduled content via a public API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL (Neon DB — serverless) |
| Auth | JWT + bcrypt |
| File Upload | Multer (local disk storage) |
| ORM/Query | pg (node-postgres) |
| Rate Limiting | express-rate-limit |

---

## Setup Instructions

### Prerequisites

- Node.js v18+
- A [Neon](https://neon.tech) account (or any PostgreSQL instance)
- Git

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd content-broadcasting-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create `.env` File

Create a `.env` file in the project root:

```env
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
JWT_SECRET=your_super_secret_key
```

### 4. Run Database Migrations

Connect to your PostgreSQL instance and run the following SQL to create all tables:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('teacher', 'principal')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(100) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  uploaded_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('uploaded','pending','approved','rejected')),
  rejection_reason TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject VARCHAR(100) NOT NULL,
  teacher_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject, teacher_id)
);

CREATE TABLE content_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content(id),
  slot_id UUID REFERENCES content_slots(id),
  rotation_order INTEGER NOT NULL,
  duration INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_content_uploaded_by ON content(uploaded_by);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_slots_subject_teacher ON content_slots(subject, teacher_id);
CREATE INDEX idx_schedule_slot_id ON content_schedule(slot_id);
```

### 5. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs at `http://localhost:3000`

---

## API Documentation

> Base URL: `http://localhost:3000`
> For protected routes, include the header:
> `Authorization: Bearer <your_jwt_token>`

---

### Auth Routes

#### Register
```
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@school.com",
  "password": "password123",
  "role": "teacher"        // "teacher" or "principal"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": { "id": "...", "name": "John Doe", "email": "...", "role": "teacher" }
}
```

---

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "john@school.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "<jwt_token>",
  "user": { "id": "...", "name": "John Doe", "role": "teacher" }
}
```

---

### Content Routes (Teacher Only)

#### Upload Content
```
POST /content/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  title        (required) — string
  subject      (required) — e.g. "maths", "science"
  file         (required) — JPG / PNG / GIF, max 10MB
  description  (optional) — string
  start_time   (optional) — ISO 8601 timestamp, e.g. "2026-04-28T09:00:00Z"
  end_time     (optional) — ISO 8601 timestamp
  duration     (optional) — rotation duration in minutes (default: 5)
```

**Response:**
```json
{
  "message": "Content uploaded successfully",
  "content": { "id": "...", "title": "...", "status": "pending", ... }
}
```

---

#### View My Uploads
```
GET /content/my
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "...",
    "title": "Chapter 1 Questions",
    "subject": "maths",
    "status": "approved",
    "rejection_reason": null,
    "start_time": "2026-04-28T09:00:00Z",
    "end_time": "2026-04-28T17:00:00Z"
  }
]
```

---

### Approval Routes (Principal Only)

#### View Pending Content
```
GET /approval/pending
Authorization: Bearer <token>
```

---

#### View All Content (with Filters & Pagination)
```
GET /approval/all
Authorization: Bearer <token>
```

**Query Parameters (all optional):**

| Param | Type | Description | Example |
|---|---|---|---|
| `status` | string | Filter by content status | `approved`, `pending`, `rejected` |
| `subject` | string | Filter by subject | `maths`, `science` |
| `teacher` | string | Filter by teacher name (partial match) | `john` |
| `page` | number | Page number (default: 1) | `2` |
| `limit` | number | Results per page (default: 10) | `5` |

**Examples:**
```
GET /approval/all?status=approved
GET /approval/all?subject=maths&page=2&limit=5
GET /approval/all?teacher=john&status=pending
GET /approval/all?status=approved&subject=science&page=1&limit=10
```

**Response:**
```json
{
  "content": [
    {
      "id": "...",
      "title": "Chapter 3 Questions",
      "subject": "maths",
      "status": "approved",
      "teacher_name": "John Doe",
      ...
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

#### Approve Content
```
POST /approval/:contentId/approve
Authorization: Bearer <token>
```

**Response:**
```json
{ "message": "Content approved and scheduled successfully" }
```

---

#### Reject Content
```
POST /approval/:contentId/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "rejection_reason": "File quality is too low"
}
```

**Response:**
```json
{ "message": "Content rejected" }
```

---

### Public Broadcasting API (No Auth Required)

> **Rate Limited:** 60 requests per minute per IP.
> Exceeding the limit returns `429 Too Many Requests`.

#### Get Live Content for a Teacher
```
GET /content/live/:teacherId
GET /content/live/:teacherId?subject=maths
```

**Response — content is live:**
```json
{
  "active_content": [
    {
      "id": "...",
      "title": "Chapter 3 — Algebra",
      "subject": "maths",
      "file_url": "uploads/1714300000000.jpg",
      "description": "Practice questions",
      "rotation_order": 2,
      "duration": 5,
      "start_time": "2026-04-28T09:00:00Z",
      "end_time": "2026-04-28T17:00:00Z"
    }
  ]
}
```

**Response — nothing live:**
```json
{ "message": "No content available" }
```

**Response — rate limit exceeded:**
```json
{ "message": "Too many requests, please try again later." }
```

---

## Scheduling Logic (How Rotation Works)

Each teacher × subject pair has its own independent rotation slot.

- Content items are ordered by `rotation_order` within a slot
- Each item has a `duration` (in minutes)
- The system calculates a total cycle length (sum of all durations)
- Using `(now - anchor) % totalCycle`, it determines which content is active right now
- The cycle loops continuously

**Example — Maths slot:**
```
Content A → 5 min (rotation_order: 1)
Content B → 5 min (rotation_order: 2)
Content C → 5 min (rotation_order: 3)
Total cycle: 15 min

At t=7min  → B is active
At t=12min → C is active
At t=17min → A is active again (looped)
```

Content is only shown if:
- Status is `approved`
- Current time is within `start_time` and `end_time`

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| No approved content for teacher | Returns `{ message: "No content available" }` |
| Approved content but outside time window | Not shown |
| Content approved but no start/end time set | Not shown |
| Invalid or non-existent teacherId | Returns `{ message: "No content available" }` |
| Invalid subject filter | Returns `{ message: "No content available" }` |
| File type not allowed | Returns 400 with error message |
| File size > 10MB | Returns 400 with error message |
| Rate limit exceeded on public API | Returns 429 with error message |

---

## Project Structure

```
root/
  server.js                 ← starts HTTP server
  uploads/                  ← local file storage
  src/
    app.js                  ← Express app setup, route mounting,
                               rate limiter on /content/live
    models/
      db.js                 ← Neon PostgreSQL connection pool
    controllers/
      auth.controller.js
      content.controller.js
      approval.controller.js   ← includes filters + pagination
      broadcast.controller.js
    routes/
      auth.routes.js
      content.routes.js
      approval.routes.js
      broadcast.routes.js
    middlewares/
      auth.middleware.js    ← authenticate + authorize(role)
    services/
      scheduling.service.js ← getOrCreateSlot, addToSchedule, getActiveContent
    utils/
      storage.js            ← multer config
```

---

## Assumptions & Skipped Features

### Assumptions

1. `start_time` and `end_time` are required for content to ever go live. Content without these fields is approved but never broadcast — this is intentional per the spec ("without start_time/end_time → content is not active").
2. `duration` defaults to 5 minutes if not provided at upload time.
3. Subject values are free-form lowercase strings. No predefined enum is enforced so new subjects can be added without schema changes.
4. The `rotation_order` for a new content item is assigned as `MAX(rotation_order) + 1` within its slot at the time of approval.
5. The teacher's UUID is used directly in the public URL (`/content/live/:teacherId`). This is safe because UUIDs are non-enumerable.

### Bonus Features Implemented

| Feature | Details |
|---|---|
| Rate Limiting | `express-rate-limit` on `GET /content/live/*` — 60 req/min/IP |
| Pagination & Filters | `GET /approval/all` supports `?status`, `?subject`, `?teacher`, `?page`, `?limit` |

### Skipped Bonus Features

| Feature | Reason |
|---|---|
| S3 file storage | Local disk storage used as per base requirement |
| Redis caching | Not implemented; architecture notes describe the approach |
| Subject-wise analytics | Out of scope for base submission |

---

## Author

Built as a technical assignment for Backend Developer evaluation.
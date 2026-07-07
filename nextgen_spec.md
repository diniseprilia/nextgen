# Product Specification: NextGen (Ninja Van + Genin)

> **Source of truth** for product behavior, data models, and APIs. Read this document before implementing or changing features. Backend setup and API details: [`server/README.md`](server/README.md).

**NextGen** (NV + Genin = "Ninja Van Rookie") is a specialized web portal built for new rookies of Ninja Van to learn about Ninja Van processes and take assessments. NextGen's primary goal is to build an assessment and course management portal for rookies to start or continue their learning journey.

---

## 1. User Roles & Access Matrix

The system supports three user roles with granular permission levels. Notably, **Masters** have full management rights over teams and team mates, but only **Admins** can manage other Admin accounts.

| Feature / Action | Rookie | Master | Admin |
| :--- | :---: | :---: | :---: |
| **Take Quizzes & View Material** | Yes | Yes | Yes |
| **View Personal & Team Dashboard** | Yes | Yes | Yes |
| **Manage Admins** (Assign / Remove) | No | No | **Yes** |
| **Manage Teams** (Create / Remove) | No | **Yes** | **Yes** |
| **Manage Team Mates** (Add, Remove, Assign Master/Rookie roles) | No | **Yes** | **Yes** |
| **Manage Courses** (Create, Delete, Save Draft, Publish, Open/Close dates) | No | **Yes** | **Yes** |
| **Manage Materials** (Group, Upload, Sync URLs, Delete) | No | **Yes** | **Yes** |
| **Monitor Results & Performance** (Individual & Question-level) | No | **Yes** | **Yes** |
| **Settings** (Gemini API key) | No | No | **Yes** |

---

## 2. Visual Design & Theme

NextGen uses a **fixed light CRM-style layout** (no user theme toggle). Design tokens live in `design-system/tokens.css`; shared UI components in `mockups/mockups.css`.

| Color | Hex | Usage |
| :--- | :--- | :--- |
| **Brand Red** | `#C41E3A` | Primary buttons, active nav, chart accents, brand highlights |
| **Charcoal** | `#2D2D2D` | Fixed sidebar background, dark hero panels |
| **Page Background** | `#F4F7F9` | Main content area |
| **Surface White** | `#FFFFFF` | Header bar, cards, tables, dialogs |
| **Gold** | `#D97706` | Rank indicators, chart gradients, podium accents |

### Layout
*   **Login**: Split-screen — brand panel (ninja icon + NextGen wordmark) left, email/password form right.
*   **App shell**: Fixed dark sidebar (252px) with ninja icon + nav; white top header (page title, search, user chip); rounded cards on light page background.
*   **Team Board tabs**: Pill-style tabs below the always-visible Team Performance hero.

### Branding
*   The **NextGen** wordmark appears with the **ninja icon** in the sidebar and login screen.
*   All **modals and dialogs** (confirmations, alerts, forms) open **centered** on the viewport with rounded corners and soft shadow.

---

## 3. Comprehensive Navigation & User Flow

Navigation differs by role. **Dashboard** and **Team Board** are shared by all users. **Top-level Management** (sidebar) is restricted by role.

### Admin

```
Home / Login
 │
 ├── Dashboard — My Performance
 │    ├── Global Gamification message (top, centered, borderless)
 │    ├── Progress charts (module completion, progress rings, weekly hours)
 │    └── Team progress tables
 │
 ├── Team Board (switch between Team 1, Team 2, etc.)
 │    ├── Team Performance Hero (always visible, top center)
 │    │    ├── Podium visualization (Top 3)
 │    │    ├── Gamification badge (Lead Pack / Keep Pushing)
 │    │    └── Score bars for all teammates
 │    ├── Courses Tab
 │    │    ├── View course list; start / continue / re-attempt
 │    │    ├── Create course (opens course dialog)
 │    │    ├── Edit course (opens course dialog)
 │    │    └── Review course (view questions)
 │    ├── Team Mates Tab
 │    │    ├── View teammates (name, score, role)
 │    │    ├── Add teammate
 │    │    ├── Update teammate
 │    │    └── Remove teammate
 │    └── Materials Tab
 │         ├── View material library
 │         ├── Add material
 │         ├── Update material
 │         └── Remove material
 │
 └── Top-Level Management (sidebar)
      ├── Analytics (course results & question performance)
      ├── Users & Roles (admins, teams)
      └── Settings (Gemini API key)
```

### Master

```
Home / Login
 │
 ├── Dashboard — My Performance
 │    ├── Global Gamification message (top, centered, borderless)
 │    ├── Progress charts (module completion, progress rings, weekly hours)
 │    └── Team progress tables
 │
 ├── Team Board (switch between Team 1, Team 2, etc.)
 │    ├── Team Performance Hero (always visible, top center)
 │    │    ├── Podium visualization (Top 3)
 │    │    ├── Gamification badge (Lead Pack / Keep Pushing)
 │    │    └── Score bars for all teammates
 │    ├── Courses Tab
 │    │    ├── View course list; start / continue / re-attempt
 │    │    ├── Create course (opens course dialog)
 │    │    ├── Edit course (opens course dialog)
 │    │    └── Review course (view questions)
 │    ├── Team Mates Tab
 │    │    ├── View teammates (name, score, role)
 │    │    ├── Add teammate
 │    │    ├── Update teammate
 │    │    └── Remove teammate
 │    └── Materials Tab
 │         ├── View material library
 │         ├── Add material
 │         ├── Update material
 │         └── Remove material
 │
 └── Top-Level Management (sidebar)
      └── Analytics (course results & question performance)
```

### Rookie

```
Home / Login
 │
 ├── Dashboard — My Performance
 │    ├── Global Gamification message (top, centered, borderless)
 │    ├── Progress charts (module completion, progress rings, weekly hours)
 │    └── Team progress tables
 │
 └── Team Board (switch between Team 1, Team 2, etc.)
      ├── Team Performance Hero (always visible, top center)
      │    ├── Podium visualization (Top 3)
      │    ├── Gamification badge (Lead Pack / Keep Pushing)
      │    └── Score bars for all teammates
      ├── Courses Tab
      │    └── View course list (Open & Closed); start / continue / re-attempt when Open
      |── Team Mates Tab
      |    └── View teammates (name, score, role — read-only)
 │    └── Materials Tab
 │         ├── View material library
```

**Notes:**
* Course management actions (**create**, **edit**, **publish**, **remove**) are available from the **course dialog** (Create course / Edit course). The course list shows **Review** and **Edit** only.
* The **Materials** tab (library & ingestion) is visible on Team Board for **Master and Admin only**.
* **Users & Roles** and **Settings** are **Admin-only** top-level sidebar items. **Analytics** is available to both Master and Admin.

### Application URLs

The SPA uses path-based URLs (History API). Refreshing the browser keeps the user on the same page when served via the API (`http://localhost:3000`).

| Page | URL |
| :--- | :--- |
| Login | `/` |
| Dashboard | `/dashboard` |
| Team Board → Courses | `/teamboard/courses/{team-slug}` |
| Team Board → Team Mates | `/teamboard/teammates/{team-slug}` |
| Team Board → Materials | `/teamboard/materials/{team-slug}` |
| Analytics | `/analytics/{team-slug}` |
| Users & Roles | `/userandroles` |
| Settings | `/settings` |

`{team-slug}` is the team name lowercased with spaces replaced by hyphens (e.g. **Ops Fleet Hub** → `ops-fleet-hub`).

*   The Team Board and Analytics team dropdowns update the URL when the selection changes.
*   Reloading `/teamboard/materials/ops-fleet-hub` restores the Materials tab with **Ops Fleet Hub** selected.
*   Reloading `/analytics/ops-fleet-hub` restores Analytics with that team selected and its courses in the dropdown.
*   Sidebar navigation and Team Board tab switches update the URL (team slug is preserved when switching tabs).
*   Browser back/forward restores the matching page, tab, and team.
*   In-course flows (quiz, course intro, result) do not change the URL; returning to Team Board restores `/teamboard/courses/{team-slug}`.

---

## 4. Detailed Component Specifications

### 4.1 Authentication & Session Life Cycle

*   **Sign-in method**: Users authenticate via **Auth0** using **Google SSO** (Ninja Van Google accounts). Password login is not supported. Flow: app → Auth0 → Google → domain check → Auth0 → app session.
*   **Allowed accounts**:
    - Primary: `@ninjavan.co` Google accounts only.
    - Bootstrap exception: `diniseprilia@gmail.com` (seeded as **Admin** on first server boot).
*   **First-time login**: When a user signs in for the first time with an allowed Google account:
    - A new account is created automatically.
    - **Display name** is derived from the email local part (e.g. `jane.doe@ninjavan.co` → **Jane Doe**).
    - Role defaults to **Rookie**.
    - `teamIds` starts empty — no team membership until invited.
    - They are directed to the dashboard with **empty data**.
*   **No team yet**: Users without a team see an empty dashboard. On **Team Board** they see:
    > *You don't have a team yet. Please ask your Master to invite you to the team.*
*   **Team invitations**:
    - Only **Master** and **Admin** can invite users to teams.
    - **Master**: may invite only to teams they belong to.
    - **Admin**: may invite to any team.
    - Invitations pick from the list of **registered users** (search by name or email). Users must have signed in at least once.
*   **Access Token Expiration**: Sessions expire automatically **every 24 hours** (HTTP-only cookie). When expired, the user is redirected to the Login page.
*   **Audit Logging**: The system logs and displays the timestamp of each user's latest login.

#### Auth REST API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/auth/config` | Public Auth0 settings and OAuth callback URL |
| `GET` | `/api/auth/login` | Redirect to Auth0 → Google sign-in |
| `GET` | `/api/auth/oauth/callback` | Auth0 OAuth callback; verify token; set session cookie |
| `GET` | `/api/auth/me` | Current authenticated user |
| `GET` | `/api/auth/logout` | Clear session and redirect to Auth0 logout |
| `POST` | `/api/auth/logout` | Clear session cookie (API) |

#### Users & Teams REST API (authenticated)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/users?q=` | List/search registered users |
| `PATCH` | `/api/users/:id/role` | Update user role (Master/Admin) |
| `PATCH` | `/api/users/:id/promote-admin` | Promote user to Admin (Admin only) |
| `PATCH` | `/api/users/:id/demote-admin` | Demote Admin to Master (Admin only) |
| `GET` | `/api/teams` | List all teams |
| `POST` | `/api/teams` | Create team (Master/Admin) |
| `DELETE` | `/api/teams/:id` | Delete team (Master/Admin) |
| `POST` | `/api/teams/:id/members` | Invite user to team |
| `DELETE` | `/api/teams/:id/members/:userId` | Remove user from team |

### 4.2 Leaderboards & Gamification Badges
Ranks are calculated dynamically based on scores. Each score is the **average of the user's latest completed attempt per course** (see §4.4).

#### Global Leaderboard (Dashboard — Top 3 of all platform users)
Displayed at the **top center** of My Performance with **no border or card frame** — text only on the page background.

*   Scores aggregate **all courses** the user has completed across **every team** they belong to.
*   Users in multiple teams have one global rank that reflects their combined performance.

#### Global gamification badges
*   **If Top 3**:
    > 👑 **Elite Elite Status!**
    > *"Phenomenal! Out of all users on the platform, you have climbed into the top 3. You are demonstrating true NextGen excellence. Wear this badge with pride!"*
*   **If Not Top 3**:
    > 📈 **The Climb Continues!**
    > *"Every step forward counts! You didn't make the global top 3 this time, but you are well on your way. Keep up the momentum, stay focused, and don’t hesitate to ask for help from our community if you want to level up!"*

#### Team Leaderboard (Team Board — always visible at top center)
Team Performance is **always shown** when the user opens Team Board (not hidden behind a tab). It includes a visual podium for Top 3, animated score bars, and the gamification badge below the team selector.

*   Scores on the **Team Board** and **Team Mates** tab reflect only courses belonging to the **currently selected team**. The same user may have different scores on different teams.
*   **If Top 3**:
    > 🏆 **NextGen Lead Pack!**
    > *"Incredible effort! You’ve secured a spot in the Top 3 of your team leaderboard. Your dedication is setting the standard for the team. Keep leading the charge!"*
*   **If Not Top 3**:
    > 💪 **Keep Pushing, NextGen!**
    > *"You're making great progress! You aren't in the top 3 yet, but the leaderboard is tight. Don't give up—keep refining your goals. If you need tips or get stuck, reach out to your team or mentor!"*

### 4.3 Dialogs & Popups
*   All `<dialog>` elements (confirm, alert, material editor, course editor, user form, attempt history) are **viewport-centered**.
*   Simple alert messages (e.g. validation errors, settings saved) use a centered alert dialog instead of browser `alert()`.

---

### 4.4 Courses & Progress Tracking
Users can view materials and access courses tailored to their team.

#### Course List Visibility & Attempt Rules
*   **Draft**: Visible on the course list to **Master and Admin only**. Rookies do not see draft courses.
*   **Open**: Visible to all users. Start, continue, re-attempt, and view-result actions follow progress rules below.
*   **Closed**: Visible to **all users** on the course list, but **no new attempts** (Start / Continue / Re-attempt are hidden). Users who already completed may still **View** their result. **Master/Admin** retain **Review** and **Edit** actions.
*   **Re-opening a closed course**: When Master/Admin edits a course and sets the close date to a **future date** (or clears it), the course status returns to **Open** automatically and all users can attempt again.

#### Course Metadata & Attempt Tracking
*   **Latest Open Date**: Tracks when the course was last opened. If the course has never been opened/attempted, this is displayed as `"-"`.
*   **Progress Statuses**:
    - **Not started**: User has not opened/started the course yet (no history).
    - **In progress**: User started the course but has not finished.
    - **Completed (Passed/Failed)**: User finished the course. Failed status applies if their score falls below the minimum passing score.
*   **Close Course (In-Session)**:
    - While taking a course, the user can click **Close Course**.
    - A centered confirmation dialog must appear before closing.
    - On confirm: answers and elapsed time are saved, status becomes **In progress**, and **last open time** (`openedAt`) is updated to the current timestamp.
    - The user is returned to Team Board.
*   **Re-attempt Conditions**:
    - A course can be re-attempted if the user **Failed** (did not reach the minimum score).
    - Re-attempts reset the course, but the user starts with the **exact same questions** they had in their previous attempt, *unless the course has been synced/updated* by a Master/Admin.
    - Full history of all previous attempts must be kept.
    - Leaderboards (My Performance and Team Performance) only reflect the **latest attempt score**.

---

### 4.5 Materials & Course Management (Master / Admin — Team Board)

**Materials** are managed via the **Materials** tab on Team Board (Master/Admin only).

**Courses** are managed via actions on the **Courses** tab (Master/Admin only): create, edit, publish, and remove. There is no separate Course Management tab.

#### Material Library & File Management

Materials are stored in **MongoDB** (metadata) and **MinIO** (uploaded file binaries). All roles can **view** materials; only **Master** and **Admin** can add, edit, or delete.

##### Material Types

Every material record has a `sourceType` of either **`file`** or **`url`**.

| Type | How it is added | Storage | User action on View |
| :--- | :--- | :--- | :--- |
| **File** | Upload a document (PDF, Word, or PowerPoint) | Binary in MinIO; metadata + optional extracted text in MongoDB | Open in-app preview dialog; **Download** available |
| **URL** | Paste an external link (no file upload) | Metadata + cached fetched text in MongoDB (`sourceUrl`, `content`) | Redirect to the external page in a new tab |

##### Upload (File type)

*   Supported formats: **PDF** (`.pdf`), **Word** (`.doc`, `.docx`), and **PowerPoint** (`.ppt`, `.pptx`) only.
*   Uploading any other file type shows the error: **"File format is not supported."**
*   On successful upload, the server stores the file in MinIO and creates a material document in MongoDB.
*   PDF, Word, and PowerPoint files have their text extracted into the `content` field for quiz question generation where possible.

##### View & Download (File type)

*   After upload, any user can **View** the material from the Materials tab or linked course.
*   **View** opens a centered dialog showing file metadata (name, type, size, group, updated date) and a preview when possible.
*   **PDF** files render in an embedded preview. **Word** and **PowerPoint** files show extracted text when available; users can **Download** the original file to open it locally.
*   **Download** fetches the original file from MinIO via the API.

##### External Link (URL type)

*   Master/Admin adds a material by providing **title**, **group**, and **source URL** (no file upload).
*   The record is saved in MongoDB with `sourceType: "url"`.
*   When question generation or the content API needs text, the server **fetches and caches** the page content from `sourceUrl` (HTML is stripped to plain text). Cached text is stored in `content`.
*   When any user clicks **View**, the app redirects them to the external URL (`target="_blank"`, `rel="noopener"`).

##### Grouping & Audit

*   Materials can be grouped into categories (e.g. Operations, Customer Experience).
*   Each material maintains `createdAt` and `updatedAt` timestamps.

##### Deletion (Hard delete)

*   Master/Admin clicks **Delete** on a material row.
*   A centered confirmation dialog appears before deletion.
*   On confirm, the material document is **permanently removed** from MongoDB.
*   If `sourceType` is `file`, the corresponding object is also **permanently removed** from MinIO.

#### Course Creation & Editing
*   **Form Parameters**: Title, description, **multiple material selection**, **multiple question formats**, question count, min score, open/close dates.
*   **Required fields**: Title, min score, description, at least one material, at least one question format, and question count must be filled before **Generate questions** is enabled.
*   **Generate questions** is disabled until all required fields are complete. **Publish** is disabled until questions have been generated and an open date is set (defaults to today after generation).
*   **Multiple Materials**:
    - Master/Admin can select **one or more** materials when creating or editing a course.
    - Selected materials are displayed in a **Selected Materials** list beside the picker, with the ability to remove individual selections.
    - Question generation loads text from material `content` (including PDF/Word/PowerPoint extraction and URL fetching via the API when needed).
*   **Multiple Question Formats**:
    - Master/Admin can choose **one or more** formats: Multiple Choice, True/False, Short Answer.
    - Question generation distributes the requested question count across the selected formats.
*   **Question formats & schemas**:
    - **Multiple choice** (`format: "multiple"`): Open question with exactly 4 options. `correctAnswer` is the 0-based index of the correct option.
    - **True/False** (`format: "truefalse"`): Statement with options `["True", "False"]`. `correctAnswer` is `0` (True) or `1` (False).
    - **Short answer** (`format: "short"`): Open-ended question with **no options**. The learner types a free-text answer. `correctAnswer` is a string of **one or two words** expected from the material. Scoring is case-insensitive exact match; optional `acceptableAnswers[]` may list alternate acceptable strings (also one or two words each).
*   **Question Generation**: Generates questions from selected material contents and formats (Gemini API if configured, otherwise local parser). Available only from the **create/edit course** dialog. Short-answer questions use a distinct JSON shape (no `options` array).
*   **Review Flow**: Master/Admin can:
    - Open **Review** from the course list to see generated questions and correct answers (read-only).
    - Open **Edit course** to change settings, generate or re-generate questions, save draft, publish, or delete.
*   **Min Score**: Define a minimum passing score.
*   **Course States** (automatic — no manual status dropdown):
    - **Draft**: Set when the user clicks **Save draft**. Only visible to Master/Admin on the course list.
    - **Open**: Set when the user clicks **Publish**; open date is set to the current date if not already set. All users can see and attempt the course (subject to their own progress).
    - **Closed**: Set automatically when the course close date is on or before the current date. Still visible to all users, but attempts are blocked. Master/Admin can edit the course (e.g. extend the close date) to re-open it.
*   **Course Deletion**: Available in the course edit dialog only. Requires centered confirmation before deleting.

#### Course & Attempt Sync

Courses and quiz attempts are stored in **MongoDB** and synced via the REST API. All authenticated users share the same course catalog; published courses appear for every user (subject to Draft/Closed visibility rules). Attempts are persisted server-side so **Analytics** and team leaderboards reflect completions across browsers and users.

*   **Client modules**: `js/courses-api.js`, `js/attempts-api.js` (with `localStorage` fallback when the API is unreachable).
*   **Team Board refresh**: Opening the Courses tab re-fetches courses from the server.
*   **Analytics refresh**: Selecting a course in Analytics loads all attempts for that course; the view updates after a teammate completes a quiz on their own session.

### 4.6 Course Analytics & Performance Metrics (Master / Admin)

Analytics includes **Open** and **Closed** courses for the **selected team** (draft courses are excluded). Changing the team selector refreshes the course list to match that team. Closed courses appear in the dropdown with **(Closed)** beside the course name. Results refresh automatically when a teammate completes a course (pass or fail), so Master/Admin see up-to-date progress without reloading the page.

#### Teammate Results Tracker
Provides a breakdown of each teammate's progress for the selected course and team:
*   **Status Indicators**: Shows `"-"` for not attempted, `"in progress"`, or `"Completed (Pass/Fail)"`.
*   **Attempt Counter**: Tracks the total number of attempts.
*   **User Taken Time**: Tracks the time taken to complete the course, including the cumulative duration the status remained "in progress."
*   **Answer History**: Master/Admin can review the teammate's history of answers for each attempt.

#### Question Quality Analytics
*Currently hidden in the UI.* Aggregates statistics on a per-question basis to monitor performance:
*   **Most Fail**: Questions with the lowest accuracy.
*   **Most Correct**: Questions with the highest accuracy.
*   **Take Longer to Take**: Questions that users spend the most time answering.
*   **Take Shorter to Take**: Questions answered most quickly.

---

## 5. Database Architecture

NextGen uses **MongoDB** for application data and **MinIO** (S3-compatible) for material file storage. The API server (`server/`) connects to both services.

### 5.1 Infrastructure

| Service | Purpose | Default (local dev) |
| :--- | :--- | :--- |
| **MongoDB** | Users, teams, courses, attempts, material metadata | `mongodb://localhost:27017/nextgen` |
| **MinIO** | Uploaded material files (PDF, Word, PowerPoint) | `http://localhost:9000`, bucket `nextgen-materials` |
| **API Server** | REST API + static frontend | `http://localhost:3000` |

Run local dependencies with `docker compose up -d` from the project root.

### 5.2 Collection: `materials`

Primary store for the material library. File binaries are **not** stored in MongoDB — only a reference to the MinIO object.

```json
{
  "_id": "ObjectId",
  "title": "Delivery Operations Guide",
  "group": "Operations",
  "sourceType": "file",
  "sourceUrl": null,
  "file": {
    "bucket": "nextgen-materials",
    "objectKey": "materials/64abc123/Delivery_Operations_Guide.pdf",
    "originalName": "Delivery Operations Guide.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 2516582,
    "extension": "pdf"
  },
  "content": "Optional extracted plain text for quiz generation…",
  "createdBy": "u_admin",
  "createdAt": "2026-06-15T10:00:00.000Z",
  "updatedAt": "2026-06-15T10:00:00.000Z"
}
```

**URL-type material example:**

```json
{
  "_id": "ObjectId",
  "title": "Last Mile Safety Handbook",
  "group": "Safety",
  "sourceType": "url",
  "sourceUrl": "https://docs.ninjavan.co/safety/last-mile",
  "file": null,
  "content": null,
  "createdBy": "u2",
  "createdAt": "2026-06-14T08:00:00.000Z",
  "updatedAt": "2026-06-14T08:00:00.000Z"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `title` | String | Yes | Display name |
| `group` | String | Yes | Category / grouping label |
| `sourceType` | `"file"` \| `"url"` | Yes | Determines storage and view behavior |
| `sourceUrl` | String | URL type only | External link; required when `sourceType` is `url` |
| `file` | Object | File type only | MinIO location and file metadata |
| `file.bucket` | String | — | MinIO bucket name |
| `file.objectKey` | String | — | Unique object path in MinIO |
| `file.originalName` | String | — | Original upload filename |
| `file.mimeType` | String | — | MIME type |
| `file.sizeBytes` | Number | — | File size in bytes |
| `file.extension` | String | — | Lowercase extension without dot |
| `content` | String | No | Extracted text (file uploads) for question generation |
| `createdBy` | String | No | User ID of uploader |
| `createdAt` | Date | Yes | Auto-set on create |
| `updatedAt` | Date | Yes | Auto-set on create/update |

**Indexes:** `{ group: 1 }`, `{ sourceType: 1 }`, `{ updatedAt: -1 }`

### 5.3 MinIO Object Layout

```
nextgen-materials/
  materials/
    {materialId}/
      {sanitized-original-filename}
```

Objects are created on file upload and **hard-deleted** when the parent material is removed.

### 5.4 Materials REST API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/materials` | List all materials (metadata only) |
| `GET` | `/api/materials/:id` | Get one material by ID |
| `POST` | `/api/materials` | Create material (`multipart/form-data` for file, JSON for URL) |
| `PUT` | `/api/materials/:id` | Update metadata; optional file replacement |
| `DELETE` | `/api/materials/:id` | Hard delete from MongoDB and MinIO |
| `GET` | `/api/materials/:id/download` | Stream / download the file (file type only) |

### 5.5 Collections: `users` and `teams`

Users and teams are stored in **MongoDB**.

#### Collection: `users`

| Field | Type | Description |
| :--- | :--- | :--- |
| `email` | String | Unique; lowercase `@ninjavan.co` (or allowlisted exception) |
| `name` | String | Derived from email local part on auto-registration |
| `role` | String | `Rookie`, `Master`, or `Admin` |
| `teamIds` | ObjectId[] | Teams the user belongs to |
| `googleSub` | String | Legacy Google subject ID (optional; pre-Auth0 users) |
| `auth0Sub` | String | Auth0 subject ID (set on first SSO login) |
| `lastLogin` | Date | Latest successful sign-in |

**Bootstrap**: On first server boot, seeds `diniseprilia@gmail.com` as **Admin** if not present.

#### Collection: `teams`

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | String | Team display name |
| `members` | ObjectId[] | User IDs in this team (kept in sync with `users.teamIds`) |

**Default seed teams** (empty members): Logistics Operations, Last Mile Delivery.

### 5.6 Collection: `courses`

Courses are stored in **MongoDB**. All users read from the same collection; Draft courses are filtered client-side for Rookies.

```json
{
  "_id": "ObjectId",
  "title": "Ops Basics 101",
  "description": "Introductory course for logistics dispatch routing.",
  "materialIds": ["64abc123"],
  "questions": [
    {
      "id": "q1",
      "question": "What is the primary dispatch cutoff time?",
      "options": ["10 AM", "12 PM", "2 PM", "4 PM"],
      "correctAnswer": 2,
      "explanation": "Cutoff is 2 PM to ensure packaging time.",
      "format": "multiple"
    },
    {
      "id": "q2",
      "question": "What must drivers do before marking a COD delivery complete?",
      "correctAnswer": "collect payment",
      "acceptableAnswers": ["collect cod", "collect cash"],
      "explanation": "COD parcels require payment collection at delivery.",
      "format": "short"
    }
  ],
  "minScore": 80,
  "status": "Open",
  "openDate": "2026-06-01",
  "closeDate": null,
  "formats": ["multiple", "short"],
  "format": "multiple",
  "questionCount": 10,
  "synced": true,
  "createdBy": "64user123",
  "createdAt": "2026-06-15T10:00:00.000Z",
  "updatedAt": "2026-06-15T10:00:00.000Z"
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `title` | String | Course display name |
| `description` | String | Course summary |
| `materialIds` | String[] | Linked material document IDs |
| `questions` | Object[] | Generated question set (see §4.5 formats) |
| `minScore` | Number | Minimum passing percentage |
| `status` | `"Draft"` \| `"Open"` \| `"Closed"` | Auto-managed from publish/close dates |
| `openDate` | String (ISO date) | When the course opens |
| `closeDate` | String \| null | When the course auto-closes |
| `formats` | String[] | Selected generation formats |
| `synced` | Boolean | When `true`, re-attempts use updated questions after Master/Admin regenerates |
| `createdBy` | String | User ID of creator |

**Indexes:** `{ status: 1 }`, `{ updatedAt: -1 }`

### 5.7 Collection: `attempts`

Quiz attempts are stored in **MongoDB** and keyed by `userId` + `courseId`.

```json
{
  "_id": "ObjectId",
  "userId": "64user456",
  "courseId": "64course789",
  "score": 90,
  "passed": true,
  "openedAt": "2026-06-15T10:30:00.000Z",
  "completedAt": "2026-06-15T11:00:00.000Z",
  "durationSeconds": 1800,
  "answers": { "q1": 2, "q2": "collect payment" },
  "qIndex": 0,
  "timestamp": "2026-06-15T11:00:00.000Z"
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | String | Attempting user's ID |
| `courseId` | String | Course document ID |
| `score` | Number | Percentage score (0–100) |
| `passed` | Boolean | Whether score ≥ course `minScore` |
| `openedAt` | Date | Latest open timestamp |
| `completedAt` | Date \| null | Set when quiz is submitted; null while in progress |
| `durationSeconds` | Number | Cumulative active time |
| `answers` | Object | Map of `questionId` → selected option index (MC/TF) or text string (short answer) |
| `qIndex` | Number | Saved question index for in-progress attempts |

**Indexes:** `{ userId: 1, courseId: 1 }`, `{ courseId: 1, completedAt: -1 }`

### 5.8 Courses REST API

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/courses` | Session | List all courses (schedule statuses applied) |
| `GET` | `/api/courses/:id` | Session | Get one course |
| `POST` | `/api/courses` | Master/Admin | Create course |
| `PUT` | `/api/courses/:id` | Master/Admin | Update course (publish, edit, regenerate questions) |
| `DELETE` | `/api/courses/:id` | Master/Admin | Delete course |

### 5.9 Attempts REST API

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/attempts` | Session | List attempts for current user; Master/Admin receive all attempts |
| `GET` | `/api/attempts?courseId=` | Session | List attempts for a course (all users for Master/Admin; own only for Rookie) |
| `POST` | `/api/attempts` | Session | Create attempt (start quiz) |
| `PUT` | `/api/attempts/:id` | Session | Update attempt (save progress or submit) |

### 5.10 Question generation API

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/questions/generate` | Master/Admin | Generate questions from material text via Gemini |

**Multiple choice / true-false response shape:**

```json
{ "question": "…", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "…", "format": "multiple" }
```

**Short answer response shape:**

```json
{ "question": "…", "correctAnswer": "expected text", "explanation": "…", "format": "short" }
```

### 5.11 Browser `localStorage` (legacy fallback)

When the API server is unreachable, courses and attempts fall back to `nextgen_courses` and `nextgen_attempts` in browser `localStorage` (seed data on first boot). **Sign-in and cross-user sync require the server.**

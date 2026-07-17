# NextGen Backend

Express API server for the NextGen learning portal. It handles **Auth0 + Google SSO authentication**, **users & teams**, **courses & quiz attempts**, material **metadata** in **MongoDB**, and uploaded **file binaries** in **MinIO**. The server also serves the static frontend from the project root on the same origin.

For product requirements, see [`nextgen_spec.md`](../nextgen_spec.md) — sections **4.1** (authentication), **4.4–4.6** (courses, analytics), **4.5** (materials & course management), and **5** (database architecture).

---

## Architecture

```
Browser (index.html + js/*.js client modules)
        │
        ▼
  Express API (:3000)
    ├── /api/auth      →  Auth0 + Google SSO + session cookies
    ├── /api/users     →  MongoDB (users)
    ├── /api/teams     →  MongoDB (teams)
    ├── /api/materials →  MongoDB (metadata) + MinIO (binaries)
    ├── /api/courses   →  MongoDB (courses)
    ├── /api/attempts  →  MongoDB (quiz attempts)
    └── /api/questions →  Gemini AI question generation
```

| Layer | Technology | Role |
| :--- | :--- | :--- |
| API | Express + Mongoose | REST endpoints, validation, static file serving |
| Auth | Auth0 server-side OAuth + `jose` (JWKS) | Google via Auth0; `@ninjavan.co` domain (+ allowlist) enforced server-side |
| Sessions | HTTP-only signed cookie (`nextgen_session`, 24 h) | Authenticated API access |
| Users & teams | MongoDB (`users`, `teams` collections) | Accounts, roles, team membership |
| Courses & attempts | MongoDB (`courses`, `attempts` collections) | Shared course catalog and quiz progress |
| Metadata | MongoDB (`materials` collection) | Material documents |
| File storage | MinIO (`nextgen-materials` bucket) | PDF, Word, and PowerPoint uploads |
| Frontend client | `js/auth.js`, `js/users-api.js`, `js/materials-api.js`, `js/courses-api.js`, `js/attempts-api.js` | Calls API; falls back to `localStorage` when offline |

---

## Material types

Every material has `sourceType: "file"` or `sourceType: "url"`.

| Type | How to add | Stored in | View behavior |
| :--- | :--- | :--- | :--- |
| **File** | Upload PDF, Word, or PowerPoint | MinIO + MongoDB | In-app preview dialog + download |
| **URL** | Provide title, group, and external link | MongoDB (`sourceUrl`, cached `content`) | Opens external page in a new tab |

### Supported upload formats

`.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx` (max 50 MB per file)

Other file types are rejected with: **File format is not supported.**

**PDF**, **Word** (`.docx`; legacy `.doc` when extractable), and **PowerPoint** (`.ppt`, `.pptx`) have text extracted into the `content` field for quiz question generation.

**URL** materials fetch page text on first content request; HTML is stripped and cached in `content`. **Confluence** wiki links (when `CONFLUENCE_*` env vars are set) are fetched via the Confluence REST API instead of anonymous HTTP.

### Confluence URL materials (optional)

Masters add Confluence pages the same way as any **URL** material (title, group, paste the wiki link). When quiz generation calls `GET /api/materials/:id/content`, the server detects Confluence URLs and reads page body text using an API token.

**Supported URL shapes:**

- `https://yourcompany.atlassian.net/wiki/spaces/SPACE/pages/123456789/Page+Title`
- `https://yourcompany.atlassian.net/wiki/pages/viewpage.action?pageId=123456789`

**Setup:**

1. Create an [Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens) for an account that can read the target wiki pages.
2. Add to `.env`:

```bash
CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net/wiki
CONFLUENCE_EMAIL=you@ninjavan.co
CONFLUENCE_API_TOKEN=your-api-token
```

3. Restart the server. Paste Confluence links as URL materials — no UI changes required.

If Confluence is not configured, URL materials fall back to anonymous HTTP fetch (works only for public pages).

### Deletion

`DELETE /api/materials/:id` performs a **hard delete**:

1. Removes the MongoDB document permanently.
2. If `sourceType` is `file`, also removes the object from MinIO.

---

## Prerequisites

- **Node.js** 18+
- **Docker** (recommended) for MongoDB and MinIO

---

## Quick start

Run all commands from the **project root** unless noted.

```bash
# 1. Start MongoDB and MinIO
docker compose up -d

# 2. Configure environment (project root)
cp .env.example .env

# 3. Install dependencies and start the server
cd server
npm install
npm run dev
```

Open **http://localhost:3000**

On first boot the server:

- Connects to MongoDB and ensures the MinIO bucket exists.
- Seeds bootstrap **Admin** (`diniseprilia@gmail.com`) and two default teams if missing.
- Seeds three sample URL materials if the collection is empty.
- Seeds three sample courses (two Open, one Draft) if the courses collection is empty.

---

## Auth0 + Google SSO setup

NextGen uses **Auth0** as the identity broker. Users still sign in with Google, but the app never talks to Google directly — Auth0 handles the OAuth flow and returns an ID token that the backend verifies.

```
Browser → GET /api/auth/login → Auth0 → Google → GET /api/auth/oauth/callback → session cookie → /
```

### 1. Create an Auth0 application

1. Sign up or log in at [Auth0](https://auth0.com/).
2. Create an application with type **Regular Web Application** (server-side OAuth).
3. Under **Settings**, set:
   - **Allowed Callback URLs**: `http://localhost:3000/api/auth/oauth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
4. Copy **Domain**, **Client ID**, and **Client Secret** into `.env`:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret
AUTH0_CALLBACK_URL=http://localhost:3000/api/auth/oauth/callback
AUTH0_GOOGLE_CONNECTION=google-oauth2
```

> If you previously created a **Single Page Application** and saw `Unauthorized` at login, create a new **Regular Web Application** instead — the server exchanges the auth code using the client secret, which avoids SPA token-endpoint issues.

### 2. Enable Google connection

1. In Auth0 Dashboard → **Authentication** → **Social**, enable **Google**.
2. Open your **NextGen** application → **Connections** tab → enable **google-oauth2**.
3. Use Auth0 dev keys for testing, or add your own Google OAuth credentials for production.

### 3. Restrict to `@ninjavan.co` (recommended)

Enforce domain rules in **two places**:

1. **Auth0 Post-Login Action** (blocks bad logins early):

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const email = (event.user.email || '').toLowerCase();
  const allowlist = ['diniseprilia@gmail.com'];
  if (!email.endsWith('@ninjavan.co') && !allowlist.includes(email)) {
    api.access.deny('Please use your @ninjavan.co Google account.');
  }
};
```

2. **NextGen backend** — `isEmailAllowed()` on `GET /api/auth/oauth/callback` (defense in depth).

### 4. Start the app

```bash
docker compose up -d
cd server && npm install && npm run dev
```

Open **http://localhost:3000** and click **Sign in with Google**.

### Who can sign in

| Account | Access |
| :--- | :--- |
| `@ninjavan.co` Google accounts | Auto-registered as **Rookie** on first sign-in |
| `diniseprilia@gmail.com` | Bootstrap **Admin** (allowlisted exception) |
| Other emails | Rejected at sign-in |

New `@ninjavan.co` users start with **no team** until a Master or Admin invites them.

---

## Environment variables

Copy `.env.example` to `.env` in the **project root** (loaded by `server/src/config.js`).

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | API and static app port |
| `MONGODB_URI` | `mongodb://localhost:27017/nextgen` | MongoDB connection string |
| `MINIO_ENDPOINT` | `localhost` | MinIO host |
| `MINIO_PORT` | `9000` | MinIO API port |
| `MINIO_USE_SSL` | `false` | Use HTTPS for MinIO |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_BUCKET` | `nextgen-materials` | Bucket for uploaded files |
| `AUTH0_DOMAIN` | *(empty)* | Auth0 tenant domain (e.g. `your-tenant.us.auth0.com`) |
| `AUTH0_CLIENT_ID` | *(empty)* | Auth0 application client ID |
| `AUTH0_CLIENT_SECRET` | *(empty)* | Auth0 application client secret (Regular Web App) |
| `AUTH0_CALLBACK_URL` | *(auto)* | OAuth callback URL; default `http://localhost:3000/api/auth/oauth/callback` |
| `AUTH0_GOOGLE_CONNECTION` | `google-oauth2` | Auth0 connection name used for Google sign-in |
| `SESSION_SECRET` | *(dev default)* | HMAC secret for session cookies — change in production |
| `ALLOWED_EMAIL_DOMAIN` | `ninjavan.co` | Required email domain for SSO |
| `EMAIL_ALLOWLIST` | `diniseprilia@gmail.com` | Comma-separated extra allowed emails |
| `BOOTSTRAP_ADMIN_EMAIL` | `diniseprilia@gmail.com` | Admin user seeded on first boot |
| `GEMINI_API_KEY` | *(empty)* | Google Gemini API key for AI question generation (optional; can also be set in Admin Settings) |
| `CONFLUENCE_BASE_URL` | *(empty)* | Confluence wiki base URL (e.g. `https://company.atlassian.net/wiki`); optional if derivable from material URL |
| `CONFLUENCE_EMAIL` | *(empty)* | Atlassian account email for Confluence API |
| `CONFLUENCE_API_TOKEN` | *(empty)* | Atlassian API token for Confluence page fetch |

---

## Question generation API

`POST /api/questions/generate` (authenticated; **Master** or **Admin** only)

The frontend extracts text from selected materials, sends it to this endpoint, and the server calls Gemini with a reading-comprehension prompt. The response is structured JSON consumed by the course editor.

**Request body:**

```json
{
  "texts": ["Extracted plain text from material 1…", "Material 2 text…"],
  "formats": ["multiple", "truefalse"],
  "count": 10,
  "apiKey": "optional override from Admin Settings"
}
```

**Response (multiple choice / true-false):**

```json
{
  "questions": [
    {
      "id": "q_1719312000_0",
      "question": "What is the primary dispatch cutoff time?",
      "options": ["10 AM", "12 PM", "2 PM", "4 PM"],
      "correctAnswer": 2,
      "explanation": "The material states cutoff is 2 PM.",
      "format": "multiple"
    }
  ]
}
```

**Response (short answer — no `options` array):**

```json
{
  "questions": [
    {
      "id": "q_1719312000_1",
      "question": "What must drivers collect before marking a COD delivery complete?",
      "correctAnswer": "payment",
      "explanation": "COD parcels require payment collection at delivery.",
      "format": "short"
    }
  ]
}
```

If no Gemini key is configured (neither `GEMINI_API_KEY` nor Settings), the API returns `400` and the frontend falls back to its local question parser.

---

## Services (local dev)

| Service | URL | Credentials |
| :--- | :--- | :--- |
| App + API | http://localhost:3000 | — |
| Health check | http://localhost:3000/api/health | Returns `{ ok, materials, courses }` |
| MongoDB | `mongodb://localhost:27017/nextgen` | — |
| MinIO API | http://localhost:9000 | `minioadmin` / `minioadmin` |
| MinIO Console | http://localhost:9001 | `minioadmin` / `minioadmin` |

---

## Project structure

```
server/
├── package.json
├── README.md
└── src/
    ├── index.js
    ├── config.js
    ├── db.js
    ├── seed.js
    ├── minio.js
    ├── middleware/
    │   └── auth.js
    ├── models/
    │   ├── Material.js
    │   ├── User.js
    │   ├── Team.js
    │   ├── Course.js
    │   └── Attempt.js
    ├── routes/
    │   ├── auth.js
    │   ├── users.js
    │   ├── teams.js
    │   ├── materials.js
    │   ├── courses.js
    │   ├── attempts.js
    │   └── questions.js
    ├── services/
    │   └── gemini.js
    └── utils/
        ├── email.js
        ├── files.js
        └── session.js
```

---

## Database: `materials` collection

File binaries are **not** stored in MongoDB — only metadata and an optional `file` reference to MinIO.

**File-type example:**

```json
{
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
  "content": "Optional extracted plain text…",
  "createdBy": "u_admin",
  "createdAt": "2026-06-15T10:00:00.000Z",
  "updatedAt": "2026-06-15T10:00:00.000Z"
}
```

**URL-type example:**

```json
{
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

**Indexes:** `{ group: 1 }`, `{ sourceType: 1 }`, `{ updatedAt: -1 }`

---

## MinIO object layout

```
nextgen-materials/
  materials/
    {materialId}/
      {sanitized-original-filename}
```

Objects are created on upload and removed on material delete.

---

## API reference

### Health

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Server status; material and course counts |

### Auth

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/config` | Public | Auth0 settings and callback URL |
| `GET` | `/api/auth/login` | Public | Start Auth0 Google sign-in |
| `GET` | `/api/auth/oauth/callback` | Public | OAuth callback; create session |
| `GET` | `/api/auth/me` | Session | Current user |
| `GET` | `/api/auth/logout` | Public | Clear session; Auth0 logout |
| `POST` | `/api/auth/logout` | Session | Clear session cookie |

### Users

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users?q=` | Master/Admin | Search registered users |
| `PATCH` | `/api/users/:id/role` | Master/Admin | Update role |
| `PATCH` | `/api/users/:id/promote-admin` | Admin | Promote to Admin |
| `PATCH` | `/api/users/:id/demote-admin` | Admin | Demote Admin to Master |

### Teams

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/teams` | Session | List teams |
| `POST` | `/api/teams` | Master/Admin | Create team |
| `DELETE` | `/api/teams/:id` | Master/Admin | Delete team |
| `POST` | `/api/teams/:id/members` | Master/Admin | Invite user (scoped by role) |
| `DELETE` | `/api/teams/:id/members/:userId` | Master/Admin | Remove member |

### Materials

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/materials` | List all materials (metadata only) |
| `GET` | `/api/materials/:id` | Get one material by ID |
| `POST` | `/api/materials` | Create material |
| `PUT` | `/api/materials/:id` | Update metadata; optional file replacement |
| `DELETE` | `/api/materials/:id` | Hard delete from MongoDB and MinIO |
| `GET` | `/api/materials/:id/download` | Download file (file type only) |
| `GET` | `/api/materials/:id/preview` | Inline file preview (file type only) |
| `GET` | `/api/materials/:id/content` | Extracted plain text for quiz generation (caches PDF text in MongoDB) |

### Courses

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/courses` | Session | List all courses |
| `GET` | `/api/courses/:id` | Session | Get one course |
| `POST` | `/api/courses` | Master/Admin | Create course |
| `PUT` | `/api/courses/:id` | Master/Admin | Update course |
| `DELETE` | `/api/courses/:id` | Master/Admin | Delete course |

### Attempts

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/attempts` | Session | List attempts (all for Master/Admin; own for Rookie) |
| `GET` | `/api/attempts?courseId=` | Session | Attempts for a course (scoped by role) |
| `POST` | `/api/attempts` | Session | Create attempt |
| `PUT` | `/api/attempts/:id` | Session | Update attempt (progress or submit) |

### Questions

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/questions/generate` | Master/Admin | Generate questions from material text via Gemini |

### Create file material (`multipart/form-data`)

```bash
curl -X POST http://localhost:3000/api/materials \
  -F "title=Ops Handbook" \
  -F "group=Operations" \
  -F "sourceType=file" \
  -F "createdBy=u_admin" \
  -F "file=@./handbook.pdf"
```

### Create URL material (`application/json`)

```bash
curl -X POST http://localhost:3000/api/materials \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Safety Guide",
    "group": "Safety",
    "sourceType": "url",
    "sourceUrl": "https://example.com/safety",
    "createdBy": "u_admin"
  }'
```

### Update material

```bash
# Update URL material metadata
curl -X PUT http://localhost:3000/api/materials/{id} \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title","group":"Operations","sourceUrl":"https://example.com/new"}'

# Replace file on a file-type material
curl -X PUT http://localhost:3000/api/materials/{id} \
  -F "title=Updated Handbook" \
  -F "file=@./new-handbook.pdf"
```

### Delete material

```bash
curl -X DELETE http://localhost:3000/api/materials/{id}
```

### Download file

```bash
curl -O -J http://localhost:3000/api/materials/{id}/download
```

---

## Frontend integration

| UI area | Client module | API |
| :--- | :--- | :--- |
| Login | `js/auth.js` | `GET /api/auth/login`, `GET /api/auth/me` |
| Users & teams | `js/users-api.js` | `/api/users`, `/api/teams` |
| Materials tab | `js/materials-api.js` | `/api/materials` |
| Courses tab | `js/courses-api.js` | `/api/courses` |
| Quiz & analytics | `js/attempts-api.js` | `/api/attempts` |
| Question generation | `js/questions-api.js` | `/api/questions/generate` |

When the API is unreachable, materials, courses, and attempts fall back to browser `localStorage`. **Sign-in requires the server** (Auth0 SSO cannot work offline). Cross-user course sync and analytics require the server.

---

## npm scripts

| Command | Description |
| :--- | :--- |
| `npm start` | Start the server |
| `npm run dev` | Start with `--watch` (auto-restart on file changes) |

---

## Troubleshooting

| Issue | Fix |
| :--- | :--- |
| Sign-in button missing / "not configured" | Set `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, and `AUTH0_CLIENT_SECRET` in `.env` and restart the server |
| `Unauthorized` during login | Use a **Regular Web Application** in Auth0; callback URL must be `http://localhost:3000/api/auth/oauth/callback` |
| "Please sign in with your @ninjavan.co Google account" | Use a `@ninjavan.co` account, or the allowlisted admin email |
| `Failed to start server` / MongoDB connection error | Ensure `docker compose up -d` is running and `MONGODB_URI` is correct |
| MinIO upload errors | Check MinIO is up at `:9000`; verify `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` |
| Materials tab shows "API offline" | Start this server from `server/` — do not open `index.html` directly via `file://` |
| Empty materials list after first run | Check `/api/health`; seed data runs only when the collection is empty |
| Unsupported file type (400) | Use allowed extensions: pdf, xlsx, xls, ppt, pptx, csv, txt, md |
| New user sees empty dashboard | Expected until a Master/Admin invites them to a team |
| Published course not visible to other users | Ensure the server is running; courses sync via `/api/courses`, not `localStorage` |
| Analytics missing teammate results | Open Analytics and select the course (loads `/api/attempts?courseId=`); attempts require server |
| Short answer shows radio buttons | Regenerate questions with `format: "short"` — short answer uses a text input, not options |

---

## Related docs

- Product spec: [`nextgen_spec.md`](../nextgen_spec.md) — **read this before changing features or APIs**
- AI prompt reference: [`nextgen_ai_prompt.md`](../nextgen_ai_prompt.md)

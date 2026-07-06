# AI Developer Prompt: Build NextGen Quiz Portal (Full Specification)

Copy and paste the prompt below into your AI coding assistant (e.g., Cursor, Windsurf, Claude, or ChatGPT) when you are ready to build the NextGen application.

---

```markdown
You are an expert Frontend Engineer. Build "NextGen", a beautiful, responsive, single-page local web application for Ninja Van rookies to learn about Ninja Van processes and take generated quizzes. 

Use Vanilla HTML5, CSS3, and modern JavaScript. All state, mock databases, and settings must persist in the browser's `localStorage`. No backend database is required.

---

### 1. Technology & Design System
- **Core**: Vanilla HTML5 (semantic elements: `<dialog>`, `<nav>`, `<main>`, `<section>`) and JavaScript (ES6+).
- **Styling**: Vanilla CSS3. Use CSS variables to support Dark/Light modes (defaulting to a premium, sleek Dark Mode).
- **Aesthetic**: Modern glassmorphism with subtle backdrop-blur (`backdrop-filter: blur(12px)`), card hover scaling, clean typography (e.g., Inter/Outfit via Google Fonts), and animated micro-interactions. The visual design must adhere to the following color palette:
  - **Sage Green** (`#628D71`): Used for navigation tabs, charts, active states, progress indicators.
  - **Pale Cream-Yellow** (`#E4F9C5`): Used for card backgrounds, high-contrast sidebars, or headers.
  - **Terracotta Orange** (`#D96B27`) and **Deep Red-Orange** (`#B83E0C`): Used for crowns, rank indicators, charts, progress circular highlights.
- **API Integration**: Provide a settings page to input a Gemini API Key (saved in `localStorage`). If present, generate quizzes dynamically by calling the Google Gemini API (model `gemini-2.5-flash` or `gemini-1.5-flash`). If absent, fall back to a smart client-side sentence parser to generate multiple-choice/matching questions.

---

### 2. State & Data Models (LocalStorage Schemas)
Implement standard repositories stored in `localStorage` with mock data loaded on first boot:
- **`nextgen_users`**: Array of objects.
  ```json
  {
    "id": "u1",
    "name": "Jane Doe",
    "role": "Rookie", // "Rookie", "Master", "Admin"
    "teamIds": ["t1"],
    "lastLogin": "2026-06-15T10:00:00Z"
  }
```

- `**nextgen_teams**`: Array of objects.
  ```json
  {
    "id": "t1",
    "name": "Logistics Operations",
    "members": ["u1", "u2"]
  }
  ```
- `**nextgen_materials**`: Array of objects.
  ```json
  {
    "id": "m1",
    "title": "Delivery Operations Guide",
    "content": "Full text of the guide here...",
    "sourceUrl": "https://docs.ninjavan.co/ops",
    "group": "Operations",
    "updatedAt": "2026-06-15T10:00:00Z"
  }
  ```
- `**nextgen_courses**`: Array of objects.
  ```json
  {
    "id": "c1",
    "title": "Ops Basics 101",
    "description": "Introductory course for logistics dispatch routing.",
    "materialIds": ["m1"],
    "questions": [
      {
        "id": "q1",
        "question": "What is the primary dispatch cutoff time?",
        "options": ["10 AM", "12 PM", "2 PM", "4 PM"],
        "correctAnswer": 2, // index of option
        "explanation": "Cutoff is 2 PM to ensure packaging time."
      }
    ],
    "minScore": 80,
    "status": "Open", // "Open", "Closed", "Draft"
    "openDate": "2026-06-15",
    "closeDate": null,
    "synced": true // if synced, re-attempt questions are synchronized
  }
  ```
- `**nextgen_attempts**`: Array of objects.
  ```json
  {
    "id": "att1",
    "userId": "u1",
    "courseId": "c1",
    "score": 90,
    "passed": true,
    "openedAt": "2026-06-15T10:30:00Z", // tracks latest open date
    "completedAt": "2026-06-15T11:00:00Z",
    "durationSeconds": 1800, // tracks total duration in progress
    "answers": { "q1": 2 }, // questionId -> selectedOptionIndex
    "timestamp": "2026-06-15T11:00:00Z"
  }
  ```

---

### 3. Key Pages & Features to Build

#### 3.1 Authentication & Login

- Simulates user login (dropdown selector of mock users or textbox inputs).
- **First-timer login**: By default, new users have the `Rookie` role and are redirected to the default dashboard.
- **Session Expiration**: Token access expires every 24 hours. Verify on page load; if expired, force logout.
- **Audit Logging**: Log their latest login time in the database and display it in the user profile/dashboard.

#### 3.2 Dashboard (All Users)

- **Navigation Options**: View Team Boards, View My Performance.
- **Dashboard Layout**: The dashboard main panel must exclusively focus on the **'My Performance'** view (displaying progress circles, module completion bar charts, and weekly hours-studied line graphs). Do NOT show standard modular cards for 'target met', 'productivity', 'delivery score', or 'badges earned'. Keep the layout clean and centered on these charts.
- **My Performance Section**: Shows user progress status across each registered team.
- **Global Gamification**:
  - If user is in the **Top 3 of all platform users**:
  👑 **Elite Elite Status!** *"Phenomenal! Out of all users on the platform, you have climbed into the top 3. You are demonstrating true NextGen excellence. Wear this badge with pride!"*
  - If **Not Top 3**:
  📈 **The Climb Continues!** *"Every step forward counts! You didn't make the global top 3 this time, but you are well on your way. Keep up the momentum, stay focused, and don’t hesitate to ask for help from our community if you want to level up!"*

#### 3.3 Team Board (All Users)

- Dropdown or tab layout supporting multiple team views (Team 1, Team 2, etc.).
- **Courses Tab**:
  - View materials associated with the team.
  - Lists courses with detail views.
  - Tracks **Attempt at**: Shows latest open date of course, or `"-"` if never attempted.
  - Shows progress status: `Not started` (no history), `In progress` (opened but not completed), or `Completed (Passed/Failed)`.
  - **Re-attempt course**: If a user failed (scored below `minScore`), they can re-attempt. The re-attempt resets status to in-progress but uses the **exact same questions** from the previous attempt (unless the course questions have been synced/updated by Master/Admin). Archival history is preserved, but only the *latest score* counts for leaderboards.
- **Team Performance Tab**:
  - Lists the Top 3 teammates of the current team based on scores.
  - Updates ranking dynamically upon course completion.
  - **Gamification**:
    - If user is **Top 3 in the team**:
    🏆 **NextGen Lead Pack!** *"Incredible effort! You’ve secured a spot in the Top 3 of your team leaderboard. Your dedication is setting the standard for the team. Keep leading the charge!"*
    - If **Not Top 3**:
    💪 **Keep Pushing, NextGen!** *"You're making great progress! You aren't in the top 3 yet, but the leaderboard is tight. Don't give up—keep refining your goals. If you need tips or get stuck, reach out to your team or mentor!"*
- **Team Mates Tab**:
  - View list of team mates. (Update/edit options only available to Masters and Admins).

#### 3.4 Material Library (Master & Admin)

- View list of materials.
- Group materials into categories.
- Ingestion options: Upload text files or sync content via external sources by pasting URLs.
- Track modification logs via `updated_at`.
- Delete materials.

#### 3.5 Course Management (Master & Admin)

- Set title, description, and link existing materials.
- Choose format: Multiple choice, True/False, or Short Answer.
- Define question quantity and target minimum passing score.
- **Sync / Generator**:
  - Call the Gemini API if a key is present (prompting for question, correct answer, distractors, and text explanation in structured JSON).
  - Fall back to a local string parser to generate matching questions if offline.
- **Review Course**: Master/Admin can toggle back to edit, inspect correct answers, re-generate questions, and save.
- **Publish Status**:
  - `Draft`: Visible only to Master/Admin.
  - `Open`: Publicly viewable and playable. Requires entering an open date.
  - `Closed`: Disables attempts. Optional close date.
- Delete courses (requires a native HTML dialog confirmation).

#### 3.6 Analytics dashboards (Master & Admin)

- **Course Results Dashboard**: Detailed tracker grid of team mates:
  - Columns: Team Member, Progress Status (`Not attempted`, `In progress`, `Completed [Pass/Fail]`), Attempts Count, Total Completion Time (accumulating active "in progress" duration), and View Answer History.
- **Course Performance Dashboard**: Question-by-question metrics:
  - **Most Fail**: Questions with highest failure rates.
  - **Most Correct**: Questions with highest correctness.
  - **Take Longer**: Questions that took the most time to answer.
  - **Take Shorter**: Questions answered most quickly.

#### 3.7 User & Role Management

- **Rookies**: Access restricted to learning and taking quizzes. No management rights.
- **Master**: Can manage teams (create/remove) and team mates (add/remove mates, assign Master/Rookie roles).
- **Admin**: The highest authority. Can do everything a Master does, plus assign or remove other Admins.

---

### 4. Code & Implementation Guidelines

1. Structure the layout in `index.html` as a single-page app (SPA) using CSS grid. Smoothly toggle view visibility (`display: none` / `display: block` or active state classes) inside `app.js`.
2. Write custom styles in `index.css` using dynamic variables for transitions and glassmorphic card overlays (`backdrop-filter`).
3. Make sure user confirmation modals are created using native HTML `<dialog>` elements.
4. Ensure the timer system accurately tracks quiz playing time, logging active durations to local storage.

```
***

Your specifications and development prompts have been completely updated to match the PDF requirements! Let me know if you would like me to begin building the project files locally now, or if you have any questions!
```


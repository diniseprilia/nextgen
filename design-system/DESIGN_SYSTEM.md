# NextGen Design System

A light-theme design system for the **NextGen** (Ninja Van Rookie) learning portal. Visual language combines Ninja Van brand colors with a **CRM-inspired layout** (see `reference/style-sample.png`): dark fixed sidebar, white header bar, large rounded cards, and dark hero panels.

## Reference Screenshots

| File | Context |
|------|---------|
| `login-sample.png` | Original NV split-screen login |
| `dashboard-sample.png` | Original NV operations dashboard |
| `form-sample.png` | Original NV modal form |
| `style-sample.png` | **Primary layout reference** — dark sidebar, hero cards, metrics |
| `icon-ninja.png` | NextGen ninja mascot (logo) |

---

## Design Principles

1. **Operational clarity** — Scannable cards, tables, and pill tabs.
2. **Brand presence** — Red (`#C41E3A`) for CTAs and accents; charcoal (`#2D2D2D`) for sidebar.
3. **Light & fixed** — Single light theme; page background `#F4F7F9`.
4. **Generous radius** — Cards 20–28px; buttons pill-shaped where primary.
5. **Centered dialogs** — All modals viewport-centered with dimmed backdrop.
6. **Role-aware UI** — Master/Admin-only controls hidden for Rookies.

---

## Color Palette

See `tokens.css` for all CSS variables.

| Token | Hex | Usage |
|-------|-----|-------|
| `--ng-brand-red` | `#C41E3A` | Primary buttons, active tabs, accents |
| `--ng-charcoal` | `#2D2D2D` | Sidebar background |
| `--ng-page-bg` | `#F4F7F9` | Main workspace |
| `--ng-surface` | `#FFFFFF` | Cards, header, dialogs |
| `--ng-text-link` | `#1565C0` | Inline links |

---

## Layout — App Shell (v1 CRM style)

```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │  White header — title · search · user        │
│ (dark)   ├──────────────────────────────────────────────┤
│          │  Main content (#F4F7F9)                   │
│ Logo     │  ┌─ Hero card (dark, rounded) ─────────┐  │
│ Nav      │  │ Metric cards · panels · tables       │  │
│ Mgmt     │  └─────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────┘
```

- **Sidebar:** 252px fixed, full height, charcoal background
- **Header:** White sticky bar, page title left, search center, user right
- **Content:** `margin-left: 252px`, padding 24–32px

### Login

- Split screen: gradient brand panel (left) + rounded login card (right)
- Ninja icon beside enlarged **NextGen** wordmark

---

## Components

### Sidebar navigation

- Brand lockup: ninja icon + wordmark
- Pill-shaped active state (`rgba(196,30,58,0.35)`)
- Section label: "Management" (uppercase, muted)
- Icons beside each link

### Header

- Title: 24px bold
- Search: pill input with icon
- User profile: pill chip with avatar

### Hero card (`.ng-hero`)

- Dark gradient background, 28px radius
- Decorative gradient circles (brand red / blue)
- Badge pill, greeting, subtitle, CTA buttons

### Metric cards (`.ng-metric`)

- White, 20px radius, colored icon square top-left
- Large value, label, trend line (↗ green / red)

### Tables (`.ng-table-wrap`)

- Rounded 20px container
- Action links as pill buttons (`.ng-btn-link`)

### Tabs (`.ng-tabs`)

- Pill container with filled active tab (brand red)

### Dialogs (`.ng-dialog`)

- Centered, 24px radius (wide variant 720px for forms)
- Header / body / footer sections
- Course edit form: sections for details, materials, questions, publishing

### Toast (`.ng-toast`)

- Fixed top-center, slides down
- Success variant: green background
- Auto-dismiss after 3s

### Loader (`.ng-loader-overlay`)

- Full-screen white overlay with spinner
- Used during sync operations

### Role visibility

| Class | Visible to |
|-------|------------|
| `.ng-admin-only` | Master, Admin |
| `.ng-superadmin-only` | Admin only |

Set `body[data-role="rookie|master|admin"]` to toggle in mockups.

---

## Page Inventory (Mockups v1.2)

| Area | Files |
|------|-------|
| Core | `login.html`, `dashboard.html`, `team-board.html` |
| Courses (Rookie) | `course-view.html`, `course-continue.html`, `course-reattempt.html`, `course-start.html` |
| Materials | `material-view-file.html`, `material-view-link.html` |
| Course Mgmt | `course-mgmt-view.html`, `course-mgmt-edit.html` |
| Management | `analytics.html`, `user-management.html`, `settings.html` |

Hub: `mockups/index.html` · Version log: `mockups/VERSION.md`

---

## Course Management Form Fields

Per product spec (`nextgen_spec.md` §4.5):

| Section | Fields |
|---------|--------|
| Course details | Title*, Description |
| Materials | Multi-select picker + selected chips (removable) |
| Question generation | Formats (MC, T/F, Short Answer)*, Question count, Min score |
| Publishing | Status (Draft/Open/Closed), Open date, Close date (optional) |
| Actions | Delete, Cancel, Save draft, Generate questions, Publish |

---

## Analytics (Master/Admin)

- **Teammate Results:** status, attempts, completion time, answer history
- **Question Performance:** most fail, most correct, take longer/shorter

---

## User Management

- **Teams:** create/remove (Master/Admin)
- **All users:** roster view
- **Admins:** assign/remove (Admin only)

---

## Settings

- Gemini API key (masked input, show/hide toggle)
- Model selection
- Save → toast confirmation

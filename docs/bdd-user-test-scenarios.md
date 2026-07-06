# NextGen — BDD User Test Scenarios

**Product:** NextGen (Ninja Van Rookie learning portal)  
**Format:** Given / When / Then / And  
**Source of truth:** [`nextgen_spec.md`](../nextgen_spec.md)

## Test personas

| Persona | Role | Team | Notes |
| :--- | :--- | :--- | :--- |
| **Admin** | Admin | Any team | Full access including Users & Roles, Settings |
| **Master** | Master | Own team(s) | Course/material/team management; Analytics |
| **Rookie** | Rookie | Invited team | Take courses, view materials (read-only) |
| **New user** | Rookie (auto-created) | None | First Google SSO login |
| **Blocked user** | — | — | Non-`@ninjavan.co` email (except bootstrap allowlist) |

## Global UI rules

- All dialogs are **centered** on the viewport.
- Toast messages auto-dismiss after ~3 seconds.
- **Save** on material form uses HTML `required` validation (title, group, file or URL) — incomplete fields block submit.
- **Generate questions** and **Publish** on course form stay **disabled** until all required fields are filled; Publish also requires generated questions and an open date.

---

## A. Authentication & session

### Scenario A1: First-time Google sign-in (allowed domain)

**Given** a user has never signed in before  
**And** the user has a valid `@ninjavan.co` Google account  
**When** the user opens `/`  
**And** clicks **Sign in with Google**  
**And** completes Google authentication  
**Then** a new account is created with role **Rookie**  
**And** display name is derived from email (e.g. `jane.doe@ninjavan.co` → **Jane Doe**)  
**And** the user is redirected to **Dashboard — My Performance**  
**And** dashboard shows empty progress data  
**And** `teamIds` is empty (no team yet)

### Scenario A2: Returning user sign-in

**Given** a registered user with an active session cookie  
**When** the user opens the app  
**Then** the user lands on **Dashboard** without seeing the login screen

### Scenario A3: Session expired (24 hours)

**Given** a user whose session cookie has expired  
**When** the user opens any app page  
**Then** the user is redirected to the **Login** page

### Scenario A4: Sign-in rejected (disallowed email)

**Given** a Google account that is not `@ninjavan.co` and not on the bootstrap allowlist  
**When** the user attempts Google sign-in  
**Then** sign-in fails  
**And** an error message is shown on the login screen

### Scenario A5: Sign out

**Given** an authenticated user  
**When** the user signs out  
**Then** the session cookie is cleared  
**And** the user is returned to the **Login** page

---

## B. Dashboard — My Performance

### Scenario B1: Rookie with no team

**Given** a Rookie user with no team membership  
**When** the user opens **Dashboard**  
**Then** progress charts and tables show empty or zero state  
**And** last login timestamp is displayed

**When** the user opens **Team Board**  
**Then** the message is shown: *"You don't have a team yet. Please ask your Master to invite you to the team."*  
**And** team tabs (Courses, Team Mates, Materials) are hidden

### Scenario B2: Global gamification badge — Top 3

**Given** a user ranked in the **global top 3** by average latest course scores  
**When** the user opens **Dashboard**  
**Then** the badge **👑 Elite Elite Status!** is shown at the top center  
**And** the motivational message for top-3 users is displayed

### Scenario B3: Global gamification badge — Not top 3

**Given** a user not in the global top 3  
**When** the user opens **Dashboard**  
**Then** the badge **📈 The Climb Continues!** is shown  
**And** the encouragement message for non-top-3 users is displayed

### Scenario B4: Dashboard progress reflects completed courses

**Given** a user who has completed at least one course  
**When** the user opens **Dashboard**  
**Then** module completion, progress rings, and weekly hours charts reflect their attempts  
**And** team progress tables show data for teams they belong to

---

## C. Team Board — navigation & team performance

### Scenario C1: Switch team via dropdown

**Given** a user belongs to multiple teams  
**When** the user opens **Team Board**  
**And** selects a different team from the team dropdown  
**Then** the URL updates to `/teamboard/{tab}/{team-slug}`  
**And** Team Performance hero refreshes for the selected team  
**And** the active tab content refreshes for that team

### Scenario C2: Team performance hero — Top 3 on team

**Given** a user is in the **top 3** of the selected team's leaderboard  
**When** the user opens **Team Board**  
**Then** the Team Performance hero is always visible at the top  
**And** a podium shows the top 3 teammates  
**And** score bars show all teammates  
**And** the badge **🏆 NextGen Lead Pack!** is displayed

### Scenario C3: Team performance hero — Not top 3

**Given** a user is not in the team top 3  
**When** the user opens **Team Board**  
**Then** the badge **💪 Keep Pushing, NextGen!** is displayed

### Scenario C4: Browser back/forward restores state

**Given** a user navigates Dashboard → Team Board → Materials tab  
**When** the user clicks the browser **Back** button  
**Then** the previous page, tab, and team selection are restored from the URL

---

## D. Material management (Master / Admin)

> **Note:** Only **Master** and **Admin** see **+ Add Material**, **Edit**, and **Delete**. **Rookie** sees the Materials tab as read-only (Scenario D7).

### Scenario D1: Create material — upload file (PDF)

**Given** a Master or Admin user  
**And** the user has selected a team on Team Board  
**When** the user opens **Team Board**  
**And** opens the **Materials** tab  
**And** clicks **+ Add Material**  
**Then** the **Add Material** dialog is shown (centered)  
**And** **Upload file** is selected by default

**When** the user enters **Title** and **Group / Category**  
**And** chooses **Upload file**  
**And** uploads a `.pdf` file  
**And** clicks **Save**  
**Then** a loader shows **Uploading…**  
**And** a toast shows **✓ Material saved**  
**And** the dialog closes  
**And** the new material appears in the list with type **File**  
**And** the URL is `/teamboard/materials/{team-slug}`

**When** the user clicks **View** on that material  
**Then** a centered preview dialog opens  
**And** PDF is shown in an embedded preview  
**And** **⬇ Download file** is available

### Scenario D2: Create material — upload file (Word / PowerPoint)

**Given** a Master or Admin on the Materials tab  
**When** the user adds a material with a `.doc`, `.docx`, `.ppt`, or `.pptx` file  
**And** fills title and group  
**And** clicks **Save**  
**Then** toast shows **✓ Material saved**  
**And** the material appears in the list

**When** the user clicks **View**  
**Then** extracted text preview is shown when available  
**Or** a message to use **Download** when preview is unavailable  
**And** **⬇ Download file** opens the original file

### Scenario D3: Create material — external URL

**Given** a Master or Admin on the Materials tab  
**When** the user clicks **+ Add Material**  
**And** enters **Title** and **Group / Category**  
**And** selects **External URL**  
**And** pastes a valid `https://…` URL in **Source URL**  
**And** clicks **Save**  
**Then** toast shows **✓ Material saved**  
**And** the new material appears in the list with type **Link**

**When** the user clicks **View**  
**Then** the external URL opens in a **new browser tab**  
**And** toast shows **Opening external material…**

### Scenario D4: Save blocked until required fields are complete

**Given** the **Add Material** dialog is open  
**When** the user has not filled all required fields (title, group, and file or URL)  
**And** clicks **Save**  
**Then** the form does not submit (browser validation)  
**And** no material is created

### Scenario D5: Unsupported file format rejected

**Given** the **Add Material** dialog is open with **Upload file** selected  
**When** the user selects a file that is not PDF, Word, or PowerPoint (e.g. `.jpg`, `.xlsx`)  
**And** clicks **Save**  
**Then** an alert shows **File format is not supported.**  
**And** the material is not saved

### Scenario D6: Edit and delete material

**Given** a material exists in the library  
**When** the Master/Admin clicks **Edit**  
**Then** the **Edit Material** dialog opens with existing title, group, and source type

**When** the user updates the title and clicks **Save**  
**Then** toast shows **✓ Material saved**  
**And** the list reflects the update

**When** the Master/Admin clicks **Delete**  
**Then** a centered confirmation dialog appears: *"This will permanently remove the material from the database…"*  
**When** the user confirms  
**Then** toast shows **✓ Material deleted**  
**And** the material is removed from the list  
**And** for file materials, the MinIO object is permanently deleted

### Scenario D7: Rookie views materials (read-only)

**Given** a Rookie user on a team  
**When** the user opens **Team Board → Materials**  
**Then** the message **View material library (read-only)** is shown  
**And** **+ Add Material** is not visible  
**And** **Edit** and **Delete** are not shown  
**And** the user can **View** file and URL materials per type rules (D1/D3)

---

## E. Course management (Master / Admin)

### Scenario E1: Create course — save draft

**Given** a Master or Admin on Team Board with at least one material  
**When** the user opens the **Courses** tab  
**And** clicks **+ Create course**  
**Then** the **Create Course** dialog opens

**When** the user fills **Title**, **Description**, **Min Score (%)**  
**And** selects at least one material  
**And** selects at least one **Question Format** (Multiple Choice, True/False, Short Answer)  
**And** sets **Question Count**  
**And** clicks **Save draft**  
**Then** toast shows **✓ Course saved**  
**And** the course appears on the list with status **Draft**  
**And** only Master/Admin can see the draft course (Rookie does not)

### Scenario E2: Generate questions disabled until form is complete

**Given** the **Create Course** dialog is open  
**When** required fields are incomplete  
**Then** **Generate questions** is disabled  
**And** **Publish** is disabled

**When** all required fields are complete  
**Then** **Generate questions** becomes enabled  
**And** **Publish** remains disabled until questions are generated

### Scenario E3: Generate questions and publish course

**Given** all required course fields are filled  
**When** the user clicks **Generate questions**  
**Then** a loader shows **Generating questions…**  
**And** generated questions appear in the **Review Questions** section  
**And** **Open Date** defaults to today if empty  
**And** **Publish** becomes enabled

**When** the user clicks **Publish**  
**Then** toast shows **✓ Course published**  
**And** the course status is **Open**  
**And** all team members (including Rookies) can see and attempt the course

### Scenario E4: Review course questions (read-only)

**Given** a published course with generated questions  
**When** the Master/Admin clicks **Review** on the course list  
**Then** the **Course Review** page opens  
**And** all questions and correct answers are shown read-only  
**And** **Edit course** navigates back to the course dialog

### Scenario E5: Edit course — extend close date to re-open

**Given** a **Closed** course (close date on or before today)  
**When** the Master/Admin clicks **Edit**  
**And** sets **Close Date** to a future date (or clears it)  
**And** saves/publishes  
**Then** the course status returns to **Open**  
**And** learners can **Start** / **Continue** / **Re-attempt** again

### Scenario E6: Delete course

**Given** the **Edit Course** dialog is open  
**When** the user clicks **Delete course**  
**Then** a centered confirmation appears: *"Delete permanently?"*  
**When** the user confirms  
**Then** toast shows **✓ Course removed**  
**And** the course is removed from the list

### Scenario E7: Create course without selecting a team

**Given** a Master/Admin with no team selected on Team Board  
**When** the user tries to save a material or course  
**Then** an alert shows **Select a team on Team Board before…**

---

## F. Course taking (all roles — learner flows)

### Scenario F1: Start an open course (not started)

**Given** a Rookie on Team Board with an **Open** course they have not started  
**When** the user clicks **Start** on the course row  
**Then** the **Start Course** intro page opens  
**And** course title, description, question count, and pass mark are shown  
**And** an info alert explains progress saves as **In progress** if they close

**When** the user clicks **Start Course**  
**Then** the quiz view opens with question 1 of N  
**And** a timer is visible  
**And** **Close Course** is available

### Scenario F2: Continue in-progress course

**Given** a user with status **In progress** on an Open course  
**When** the user clicks **Continue**  
**Then** the quiz resumes (same questions, saved answers/progress)

### Scenario F3: Close course mid-session

**Given** a user is taking a quiz  
**When** the user clicks **Close Course**  
**Then** a centered confirmation appears: *"Progress will be saved as In progress."*  
**When** the user confirms  
**Then** answers and elapsed time are saved  
**And** course status becomes **In progress**  
**And** the user returns to **Team Board → Courses**  
**And** **Attempt at** shows the updated last-open date

### Scenario F4: Complete course — pass

**Given** a user answers all questions on an Open course  
**When** the user clicks **Submit** on the last question  
**Then** the result screen shows **🎉 Passed!** (score ≥ min score)  
**And** score percentage is displayed  
**And** the course list shows **Completed (Passed)**  
**And** **View** is available instead of Start

### Scenario F5: Complete course — fail and re-attempt

**Given** a user submits a quiz with score below the minimum  
**When** the result screen appears  
**Then** **📚 Keep Learning** is shown  
**And** the course list shows **Completed (Failed)**  
**And** **Re-attempt** is available while the course is Open

**When** the user clicks **Re-attempt**  
**Then** the **Re-attempt Course** intro warns that questions stay the same unless the course was synced  
**When** the user starts again  
**Then** they receive the same question set (unless Master/Admin regenerated questions)  
**And** full attempt history is retained server-side

### Scenario F6: Closed course — no new attempts

**Given** a course with status **Closed**  
**When** a Rookie views the course list  
**Then** the course is visible with **Closed** badge  
**And** **Start**, **Continue**, and **Re-attempt** are hidden

**When** the Rookie had previously passed  
**Then** **View** result is still available

**When** the Rookie had not completed the course  
**Then** no attempt actions are shown

### Scenario F7: Draft course hidden from Rookie

**Given** a course in **Draft** status  
**When** a Rookie views the Courses tab  
**Then** the draft course does not appear in the list

### Scenario F8: Short-answer question validation

**Given** a quiz question with format **Short Answer**  
**When** the user leaves the answer empty and clicks **Next** or **Submit**  
**Then** an alert shows **Type your answer.**

---

## G. Team mates management

### Scenario G1: Master invites teammate to team

**Given** a Master user managing their team  
**When** the user opens **Team Board → Team Mates**  
**And** clicks **+ Invite teammate**  
**Then** the invite dialog opens  
**And** the user can search registered users by name or email  
**And** only users who have signed in at least once appear

**When** the user selects a user and confirms invite  
**Then** toast shows **✓ User invited to team**  
**And** the user appears in the teammates table

### Scenario G2: Admin invites user to any team

**Given** an Admin user  
**When** the Admin invites a user from **Users & Roles** or Team Mates  
**Then** any team can be selected (not limited to Admin's own teams)

### Scenario G3: Update teammate role

**Given** a Master or Admin on Team Mates  
**When** the manager changes a teammate's role via the role dropdown (Rookie / Master)  
**Then** the role updates immediately  
**And** permissions reflect the new role on next action

### Scenario G4: Remove teammate from team

**Given** a Master or Admin on Team Mates  
**When** the manager clicks **Remove** on a teammate  
**Then** a confirmation dialog appears: *"Remove this user from the team?"*  
**When** confirmed  
**Then** the user is removed from the team  
**And** they no longer see that team's courses on Team Board

### Scenario G5: Rookie views teammates (read-only)

**Given** a Rookie on Team Mates tab  
**Then** teammates are listed with name, role, and score  
**And** invite, role change, and remove actions are not available

---

## H. Analytics (Master / Admin)

### Scenario H1: View teammate results for a course

**Given** a Master or Admin  
**When** the user opens **Analytics** from the sidebar  
**And** selects a team and an **Open** or **Closed** course  
**Then** the **Teammate Results** table shows each member's progress, attempt count, and time taken  
**And** draft courses are excluded from the course dropdown  
**And** closed courses show **(Closed)** beside the name

### Scenario H2: View attempt answer history

**Given** a teammate has one or more attempts on the selected course  
**When** the Master/Admin clicks to view attempt history  
**Then** a centered dialog shows that user's answer history per attempt

### Scenario H3: Analytics refreshes after teammate completes quiz

**Given** Analytics is open for a course  
**When** a teammate completes that course in another session  
**Then** the results table updates without a full page reload

---

## I. Users & roles (Admin)

### Scenario I1: Create team

**Given** an Admin on **Users & Roles → Teams**  
**When** the Admin clicks add team  
**And** enters a team name  
**And** submits  
**Then** toast shows **✓ Team created**  
**And** the team appears in the teams table

### Scenario I2: Promote user to Admin

**Given** an Admin on **Users & Roles → Admins**  
**When** the Admin promotes a registered user to Admin  
**Then** toast shows **✓ User promoted to Admin**  
**And** the user appears in the admins list

### Scenario I3: Demote Admin

**Given** an Admin on the Admins segment  
**When** the Admin clicks **Remove** on another Admin  
**Then** the user is demoted (typically to Master)  
**And** they lose Admin-only sidebar items (Users & Roles management scope, Settings)

### Scenario I4: Delete team

**Given** an Admin or Master with permission on a team  
**When** they click **Remove** on a team  
**And** confirm deletion  
**Then** the team is removed from the system

### Scenario I5: Master cannot manage Admins

**Given** a Master user  
**When** they open the sidebar  
**Then** **Users & Roles** and **Settings** are not available  
**And** the Master cannot promote/demote Admin accounts

---

## J. Settings (Admin only)

### Scenario J1: Save Gemini API key

**Given** an Admin on **Settings**  
**When** the Admin enters a Gemini API key  
**And** clicks **Save settings**  
**Then** toast shows **✓ Settings saved**  
**And** subsequent **Generate questions** can use Gemini (when server is configured)

### Scenario J2: Settings not accessible to Master/Rookie

**Given** a Master or Rookie user  
**Then** **Settings** does not appear in the sidebar

---

## K. Cross-cutting / negative paths

### Scenario K1: API offline — materials cache

**Given** the API server is unreachable  
**When** a user opens Materials  
**Then** a notice shows **API offline — showing local cache**  
**And** cached materials may still be viewable locally

### Scenario K2: URL deep-link to Materials tab

**Given** an authenticated user with team access  
**When** the user navigates directly to `/teamboard/materials/ops-fleet-hub`  
**Then** Team Board opens with **Materials** tab active  
**And** team **Ops Fleet Hub** is selected

### Scenario K3: Leaderboard uses latest attempt only

**Given** a user has multiple attempts on the same course (including failed then passed)  
**When** team or global leaderboard is calculated  
**Then** only the **latest completed attempt score** per course is used in the average

---

## Appendix: Expected toast & alert messages

| Action | Expected message |
| :--- | :--- |
| Save material | `✓ Material saved` |
| Delete material | `✓ Material deleted` |
| Save course draft | `✓ Course saved` |
| Publish course | `✓ Course published` |
| Delete course | `✓ Course removed` |
| Invite to team | `✓ User invited to team` |
| Promote admin | `✓ User promoted to Admin` |
| Create team | `✓ Team created` |
| Save settings | `✓ Settings saved` |
| Open URL material | `Opening external material…` |
| Unsupported file | `File format is not supported.` |
| Quiz pass | `🎉 Passed!` |
| Quiz fail | `📚 Keep Learning` |

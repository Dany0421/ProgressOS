# VISION.md — ProgressOS

> A gamified personal productivity OS built around Sensory Processing Sensitivity (SPS). Progress must be **visible, satisfying, and obsessive**. Phone-first. Used daily. If it's ugly, it won't get used — and this **cannot** be ugly.

---

## 1. What This Is

A personal OS for daily momentum. Three pillars:

- **Daily Tasks** — things to do today
- **Habits** — recurring actions with streaks
- **Code Projects** — long-running projects with milestones + session tracking

Everything awards XP. XP feeds levels. Levels are visible everywhere. Progress must feel *earned* and *seen* — not abstracted, not buried.

**XP economy has guardrails** so the loop doesn't inflate and stop feeling good (see Section 4).

---

## 2. Design Identity — READ FIRST

> Claude must read `/mnt/skills/public/frontend-design/SKILL.md` before writing a single line of CSS or HTML.

Reference: **a cyber-terminal aesthetic meets a premium mobile RPG**. Think a hacker OS that also tracks your life. Dark, sharp, with one aggressive neon accent. Not cozy, not corporate — tactical.

### Color System

```css
/* Background layers — depth, not flat black */
--bg-base:        #0A0A0D;   /* deepest layer */
--bg-surface:     #101015;   /* cards, panels */
--bg-elevated:    #16161D;   /* modals, bottom sheets, active states */
--bg-subtle:      #1C1C26;   /* hover, input fields */

/* Primary accent — acid lime. Aggressive, cyber. */
--accent-primary: #A3FF12;
--accent-dim:     #7FCC0E;   /* pressed/hover state */
--accent-glow:    rgba(163, 255, 18, 0.22);

/* XP / reward — fire orange. Warm contrast vs lime. */
--xp-color:       #FF6B35;
--xp-glow:        rgba(255, 107, 53, 0.25);

/* Semantic */
--priority-high:  #FF3B3B;
--priority-med:   #FFB830;
--priority-low:   #4ECDC4;
--streak-fire:    #FF6B35;   /* same as XP — thematic unity */
--success:        #A3FF12;
--danger:         #FF3B3B;

/* Text */
--text-primary:   #F0F0F5;
--text-secondary: #8A8A9E;
--text-muted:     #44445A;

/* Borders */
--border-subtle:  rgba(255, 255, 255, 0.06);
--border-active:  rgba(163, 255, 18, 0.45);
```

### Typography

- **Display / Headers**: `Syne` (600/700/800) — geometric, assertive
- **Body / UI**: `DM Sans` (400/500/600) — clean, legible on mobile
- **Numbers / XP / Streaks**: `JetBrains Mono` (400/600) — terminal/system feel
- **Banned**: Inter, Roboto, Space Grotesk, Arial, system-ui

```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

### Motion Principles

Motion = feedback. Every interaction must confirm it happened.

- **Task complete** (the most repeated feedback — must feel amazing):
  - Haptic: `navigator.vibrate(15)` short tick
  - Sound: subtle tick via Web Audio API (~80ms, low volume)
  - Visual: card flashes lime border for 200ms, strikethrough draws left-to-right, `+XP` number floats up in fire orange for 800ms then fades
- **Habit toggle ON**: card border pulses lime, streak counter bounces (scale 1 → 1.2 → 1), fire icon flickers if streak milestone crossed
- **XP bar fill**: CSS transition 600ms `ease-out`, slight overshoot (spring feel)
- **Level-up**: persistent overlay, tap to dismiss, sound + haptic burst (see Section 5)
- **Page transitions**: none — keep it snappy
- **Bottom nav tap**: icon scales 1.0 → 1.15 → 1.0 (150ms)

**Sound strategy**: Web Audio API for micro-sounds. No external audio files. Global mute toggle stored in `localStorage`.

### Card Design

- `--bg-surface` background, `1px solid var(--border-subtle)`
- Radius: `16px` cards, `12px` inner, `8px` badges
- Active: border → `--border-active`, `box-shadow: 0 0 20px var(--accent-glow)`
- No colored drop shadows — glow only on active/focus
- Min `16px` padding
- Completed task card: `opacity: 0.5`, strikethrough title

### Mobile-First Rules

- Target: **390px width** (iPhone 14). Nothing else matters first.
- Bottom nav: fixed, `64px` height, safe-area aware
- Tap targets: minimum `48×48px`
- FAB: `56px` diameter, bottom-right, `20px` from edge, `84px` above nav
- No horizontal scroll
- Body text: `15–16px`, never below `14px`
- Primary actions in bottom 60% of screen (thumb reach)

---

## 3. Tech Stack

- **Frontend**: Vanilla JS + HTML + CSS (no frameworks, no npm, CDN only)
- **Backend**: Supabase (PostgreSQL + Auth + Row Level Security)
- **Supabase JS client**: pinned to `@supabase/supabase-js@2.45.4` via CDN. Never use `@latest` — version drift breaks sessions.
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
  ```
- **Hosting**: GitHub Pages (static HTML, free). Repo deployed from `main` branch root.
- **Auth**: Supabase Auth (email/password) — single-user now, multi-user ready

---

## 4. Core Rules — Time, XP Economy, Streak Protection

These rules apply globally. Every module respects them.

### 4.1 Definition of "Day" (CRITICAL)

- A "day" = the **local calendar date in Africa/Maputo (UTC+2)**
- All `date` columns store the **local date**, not UTC date
- Helper `todayLocal()` in `time.js` returns current Maputo date as `YYYY-MM-DD`
- Never use `new Date().toISOString().split('T')[0]` — that gives UTC date and will break streaks around midnight

```js
// js/time.js
const TIMEZONE = 'Africa/Maputo';

function todayLocal() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  // returns YYYY-MM-DD in local date
}
```

### 4.2 Daily XP Cap (Soft Cap on Tasks)

- **Tasks cap**: 250 XP/day from task completions
- When a task would cross the cap, it gets **partial XP** (only the amount up to 250). Further tasks in the same day award 0 XP with a subtle toast: "Daily task cap reached. You're crushing it."
- **Habits and Projects are NOT capped** — habits naturally limited (1/day), projects are effort-based
- Milestone / project completion bonuses **exempt** from cap (rare events should always feel rewarding)

### 4.3 What Counts as a Task/Habit (Protect the Loop)

No enforcement — this is **personal discipline, documented as philosophy**:

- Tasks = **intentional actions requiring decision or effort** — not passive life actions
- ❌ "Brush teeth", "Eat breakfast", "Go to work" — baseline, not XP-worthy
- ✅ "Finish RFQ module", "Write 30min", "Call contractor" — decisions with friction
- **XP represents effort, not existence**

### 4.4 Streak Freeze System

- **Automatic freezes**: 1 granted every 14 days (max stack of 3)
- **Purchasable freezes**: 150 XP each (deducted from `total_xp`), max stack of 3
- **Auto-consumption**: if a habit's streak would break, freeze is automatically consumed — streak preserved, logged in xp_feed as "Freeze consumed — streak saved"
- **Cannot freeze a streak below 3 days** — gotta earn the protection
- Freezes shown on Habits page header: `❄️ 2 freezes available`

---

## 5. XP & Leveling System

### XP Sources

| Action | XP |
|---|---|
| Low priority task | +10 |
| Medium priority task | +20 |
| High priority task | +35 |
| All tasks done (daily bonus) | +50 |
| Habit daily completion | +15 |
| 7-day streak milestone | +50 (once) |
| 30-day streak milestone | +150 (once) |
| 100-day streak milestone | +500 (once) |
| Complete project milestone | +40 |
| Complete full project | +200 bonus |
| **Project session** | **+5 XP per 30min block (min 15min)** |

### Session XP Calculation

```js
function sessionXP(durationMinutes) {
  if (durationMinutes < 15) return 0;
  return Math.floor(durationMinutes / 30) * 5;
}
// 15min → 0, 30min → 5, 60min → 10, 90min → 15, 3h → 30
```

### Level Formula

```js
function xpForLevel(n) {
  if (n <= 1) return 0;
  let total = 0;
  for (let i = 2; i <= n; i++) total += i * 150;
  return total;
}
// Level 1: 0, Level 2: 300, Level 3: 750, Level 4: 1350, Level 5: 2100...
```

### Category XP
Tasks, Habits, Projects each have independent XP pools + levels (shown on their pages). Global total on Dashboard.

### Level-Up Event

- Triggered inside `xp.js` after every XP award
- **Persistent full-screen overlay** — does NOT auto-dismiss
- Tap anywhere (or "Continue" button) to dismiss
- Backdrop: `--bg-base` at 95% opacity
- Center: huge level number in `Syne 800`, lime, with glow pulse
- Above: "LEVEL UP" in small caps, `JetBrains Mono`
- Below: "Keep going." in muted text
- Haptic: `navigator.vibrate([30, 50, 30])` pattern
- Sound: 3-note ascending chime (C5 → E5 → G5, 120ms each)
- Logged to Supabase, appears in XP feed

---

## 6. Pages & Navigation

Bottom nav — 4 tabs, Lucide icons + labels. Active: icon + label lime. Inactive: muted.

Icons via CDN: `https://unpkg.com/lucide@latest`

---

### Tab 1 — Dashboard (`index.html`)

1. **Player Card**
   - Avatar circle with initials, lime border
   - Username (`Syne`), level label (`LVL 7`), XP progress "4,280 / 5,000 XP"
   - Full-width XP bar — fills lime, fire-orange glow on fill edge
   - **Settings icon** (gear, Lucide `settings`) top-right corner, muted color — opens Settings bottom sheet on tap

2. **Mini Stats Row** — 3 cards
   - Tasks done today / Active streaks / Projects active
   - Numbers in `JetBrains Mono`, labels muted `DM Sans`

3. **30-Day Heatmap** — GitHub-style contribution graph
   - Last 30 days, one cell per day
   - Color intensity = total XP that day
   - Thresholds: 0 = empty (`--bg-subtle`), 1–50 = dim lime, 51–150 = med lime, 151–300 = bright lime, 300+ = full lime with glow
   - Tap a cell → popup with day's stats
   - Data source: `xp_events` aggregated by local `event_date`

4. **Today's Focus** — top 3 incomplete tasks, inline complete

5. **XP Feed** — last 5 XP events (amber number left, description right, muted timestamp below)

6. **FAB** — `+` adds task via bottom sheet

---

### Tab 2 — Tasks (`tasks.html`)

1. **Date Header** — "Monday, 20 Apr" in `Syne`
2. **Daily XP Counter** — pill top-right: `128 / 250 XP today`. Turns orange near cap, muted when capped.
3. **Filter Bar** — All / Pending / Done / **Carried Over**
4. **Task List**
   - Title left, priority badge top-right, XP reward bottom-right (fire orange `JetBrains Mono`)
   - Checkbox left — on complete: lime flash + strikethrough + XP float + haptic + tick sound
   - **Carried-over**: small amber badge "← carried"
5. **Empty State**: "All clear. Beast mode." in `Syne`, muted subtext with today's XP
6. **FAB** → bottom sheet: title, priority, optional due_date

### Tasks Not Completed by End of Day

- Tasks stay on their original `due_date`
- Next app load: tasks with `due_date < today AND completed = false` show in **"Carried Over"** filter
- User manually decides: **complete**, **reschedule** (change due_date), or **archive** (delete)
- No auto-archive. No guilt.

---

### Tab 3 — Habits (`habits.html`)

1. **Header** — "Today's Habits" + date + `❄️ 2 freezes available`
2. **Habit List**
   - Name (`DM Sans` medium)
   - Streak `🔥 14 days` in `JetBrains Mono`, fire orange
   - Large toggle right — OFF: muted outline / ON: filled lime with checkmark + glow
   - Milestone badges (7d / 30d / 100d) — unlocked glow, locked muted
   - XP reward under toggle
3. **Freeze Shop** — header button: "Buy freeze (150 XP)" — disabled if <150 XP or stack at 3
4. **Add Habit** — bottom sheet: name only
5. **Empty State**: "No habits yet. Start one."

### Streak Logic (runs on habits page load, before render)

```
For each habit:
  If last_completed_date == today → nothing
  If last_completed_date == yesterday → keep streak (pending today)
  If gap > 1 day:
    If freezes_available > 0:
      consume freeze
      keep streak (update last_completed_date to yesterday to keep chain logic clean)
      log xp_event: "Freeze consumed — streak saved" (0 XP, category 'system')
    Else:
      reset streak to 0
      log xp_event: "Streak broken — {habit_name}" (0 XP, category 'system')
```

### Freeze Grant Logic (runs on ANY page load, in auth.js after session check)

```
If today - last_freeze_grant_date >= 14 AND freezes_available < 3:
  freezes_available += 1
  last_freeze_grant_date = today
  toast: "❄️ Freeze earned"
```

---

### Tab 4 — Projects (`projects.html`)

**List View:**
- Name (`Syne`)
- Category pill
- Progress bar (`X of Y milestones`)
- XP earned (fire orange)
- Total time tracked (e.g. `⏱ 12h 30m`)
- Status badge: Active / Paused / Completed
- FAB → new project

**Project Detail View** (slides in):

1. Back button top-left
2. Header: name + description + category
3. **Session Timer** — prominent card:
   - Big timer display `HH:MM:SS` in `JetBrains Mono`
   - Start / Stop button (toggles lime "START" ↔ fire-orange "STOP")
   - Running state: lime pulse border on card
   - On stop: session saved, XP calculated, toast shown
   - **Timer persists across page navigation** via `localStorage` — survives refresh
4. **Milestones list**: name + complete button + XP reward. Completed = dimmed + strikethrough.
5. **Add milestone** inline input at bottom
6. **Recent Sessions** — last 5: "Yesterday 14:30 — 1h 45m (+15 XP)"
7. **Notes** — textarea, auto-save on blur

### Complete Project Logic
- Marked `completed` **manually** via button (not auto on last milestone)
- Button enabled only when ≥1 milestone completed
- On completion: status → 'completed', +200 XP bonus, toast + lime particle burst

---

## 7. Supabase Schema

```sql
-- Extended profile
profiles (
  id uuid references auth.users primary key,
  username text,
  total_xp integer default 0,
  current_level integer default 1,
  tasks_xp integer default 0,
  habits_xp integer default 0,
  projects_xp integer default 0,
  freezes_available integer default 0,
  last_freeze_grant_date date,  -- LOCAL date, set on first freeze grant via JS
  onboarding_completed boolean default false,
  created_at timestamptz default now()
)

-- Tasks
tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  completed boolean default false,
  completed_at timestamptz,
  due_date date,  -- stored as LOCAL Maputo date
  xp_awarded integer default 0,
  created_at timestamptz default now()
)
create index tasks_user_due on tasks(user_id, due_date);

-- Habits
habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_completed_date date,  -- LOCAL date
  total_completions integer default 0,
  created_at timestamptz default now()
)

-- Habit logs
habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references habits(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  completed_date date not null,
  xp_awarded integer default 0,
  streak_at_completion integer default 0,
  was_freeze_save boolean default false,
  unique (habit_id, completed_date)  -- prevent double-logging same day
)

-- Projects
projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  description text,
  category text,
  status text check (status in ('active', 'completed', 'paused')) default 'active',
  total_xp_earned integer default 0,
  total_minutes_tracked integer default 0,
  last_session_at timestamptz,
  notes text,
  created_at timestamptz default now()
)

-- Milestones
milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  completed boolean default false,
  completed_at timestamptz,
  xp_awarded integer default 40,
  created_at timestamptz default now()
)

-- Project sessions (NEW — for timer tracking)
project_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer,
  xp_awarded integer default 0,
  created_at timestamptz default now()
)
create index sessions_project on project_sessions(project_id, started_at desc);

-- XP event log
xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  description text not null,
  xp_amount integer not null,
  category text check (category in ('tasks', 'habits', 'projects', 'bonus', 'system')),
  event_date date not null,  -- LOCAL Maputo date, MUST be passed from JS via todayLocal()
  created_at timestamptz default now()
)
create index xp_events_user_date on xp_events(user_id, event_date desc);
-- NOTE: event_date has NO default on purpose. Postgres current_date = UTC date,
-- which breaks the heatmap around midnight. Always pass event_date explicitly from JS.
```

**RLS (apply to ALL tables):**
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_data" ON <table> FOR ALL USING (auth.uid() = user_id);
```

---

## 8. JS Module Structure (`/js/`)

```
/js/
  supabase.js      — client init
  auth.js          — session check, redirect to login.html, triggers freeze grant check
  time.js          — todayLocal(), yesterdayLocal(), daysBetween(), formatDate()
  xp.js            — awardXP(), level calc, level-up detection, daily cap check
  freezes.js       — grant check, auto-consume, purchase
  ui.js            — toast(), showLevelUp(), showBottomSheet(), floatXP(), haptic()
  sound.js         — Web Audio helpers: playTick(), playLevelUpChime(), setMuted()
  tasks.js         — tasks page + carried-over handling
  habits.js        — habits page, streak check, freeze consume
  projects.js      — projects page + session timer logic
  dashboard.js     — dashboard: player card, stats, heatmap, focus tasks, XP feed
```

### Key function signatures

```js
// xp.js
async function awardXP(userId, amount, category, description) {
  // Checks daily cap if category === 'tasks'
  // Awards XP → updates profile totals
  // Logs xp_event with local event_date
  // Checks for level-up → triggers showLevelUp() if needed
  // Returns: { awarded, leveled_up, new_level, capped }
}

// ui.js
function floatXP(element, amount)          // spawns "+35 XP" from element, floats up, fades
function showLevelUp(newLevel)             // persistent overlay, dismiss on tap
function toast(message, type='success')    // bottom toast, 3s auto-hide
function haptic(pattern=15)                // navigator.vibrate wrapper, respects muted

// sound.js
function playTick()                        // task complete
function playLevelUpChime()                // 3-note ascending
function playStreakMilestone()             // fire whoosh
function setMuted(bool)                    // global mute, persists in localStorage

// time.js
function todayLocal()                      // YYYY-MM-DD in Maputo
function yesterdayLocal()
function daysBetween(dateA, dateB)

// freezes.js
async function checkAndGrantFreeze(userId)         // runs on any page load
async function consumeFreeze(userId, habitId)
async function purchaseFreeze(userId)              // 150 XP cost
```

---

## 9. CSS File Structure (`/css/`)

```
/css/
  base.css        — tokens, reset, typography, bottom nav
  components.css  — cards, buttons, badges, bars, FAB, bottom sheet, filters, heatmap cells
  animations.css  — task complete, XP float, level-up overlay, habit toggle pulse, streak flash, particle burst
```

Base tokens:
```css
--radius-card: 16px;
--radius-inner: 12px;
--radius-badge: 8px;
--nav-height: 64px;
--fab-size: 56px;
--transition-fast: 150ms ease;
--transition-med: 300ms ease;
--transition-slow: 600ms ease-out;
```

---

## 10. Auth + Onboarding

### Auth
- `login.html` — email + password via Supabase Auth, same dark theme
- Every page: `auth.js` checks session. No session → redirect to `login.html`
- No registration page — user created manually in Supabase dashboard
- After login → `index.html`

### First-Use Onboarding
- On first login, if `profiles.onboarding_completed === false`:
  - Show single welcome modal (not a separate page)
  - Headline: "Welcome, Dany." in `Syne`
  - Body: 3 short lines explaining the three pillars (Tasks / Habits / Projects) with Lucide icons
  - Button: "Let's go." → sets `onboarding_completed = true`, dismisses modal
- User lands on empty dashboard, all empty states prompt first action

### Settings (bottom sheet, not a separate page)

Accessed via gear icon in Dashboard player card. Slides up from bottom using the same `showBottomSheet()` helper.

**Layout:**

1. **Header** — "Settings" in `Syne`, close (X) button top-right
2. **Profile section**
   - Shows username + email (read-only for now)
3. **Feedback toggles** — each is a row with label + toggle switch (lime when ON):
   - `Sound` — toggles `setMuted()` sound state (persisted in `localStorage`)
   - `Haptics` — toggles haptic feedback (persisted in `localStorage` as `haptic_muted`)
4. **Stats section** — read-only info:
   - Account created: DD Mon YYYY
   - Total XP earned (all-time)
   - Longest streak ever (across all habits)
5. **Danger zone** — separated with muted divider:
   - `Log out` button — full-width, outline style, `--danger` text color
     - On tap: confirm dialog ("Log out?"), then `supabase.auth.signOut()` → redirect to `login.html`

**New helper in `auth.js`:**
```js
async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}
```

**New localStorage keys:**
- `sound_muted` — boolean, read by `sound.js` on load
- `haptic_muted` — boolean, read by `ui.js` `haptic()` wrapper

**`haptic()` must respect mute:**
```js
function haptic(pattern = 15) {
  if (localStorage.getItem('haptic_muted') === 'true') return;
  if (navigator.vibrate) navigator.vibrate(pattern);
}
```

---

## 11. Build Rules for Claude Code

- Vanilla JS only. No npm. No frameworks. Supabase JS via CDN.
- Mobile-first. Build at 390px. Nothing breaks above.
- Bottom nav fixed, z-index 1000, always visible on main pages.
- No inline styles. All via CSS classes.
- Every Supabase call in try/catch. Errors via `toast()`, never silent.
- XP award + xp_event log must be atomic (same async function, both awaited).
- Level-up check runs inside `xp.js` after EVERY XP award.
- Streak check + freeze auto-consume runs on habits page load BEFORE render.
- Freeze grant check runs on ANY page load (in `auth.js` after session check).
- All "day" dates use `todayLocal()` from `time.js`. Never `new Date().toISOString()` for dates.
- **NEVER rely on Postgres `current_date` or `now()::date` for user-facing dates** — Postgres uses UTC and will be off by hours in Maputo. Any `date` column representing a user's day (e.g. `event_date`, `last_freeze_grant_date`, `due_date`, `completed_date`) must be set explicitly from JS using `todayLocal()`.
- Timer state persists in `localStorage` so it survives page refresh.
- `DEBUG` constant at top of each JS file — `if (DEBUG) console.log(...)`.
- Filenames: `lowercase-hyphen.js`. No camelCase.
- `on delete cascade` on all FKs. Indexes on `user_id` + date for common queries.
- Sound + haptic muted state in `localStorage`, read on app load.

---

## 12. What Success Looks Like

When Dany opens this app first thing in the morning:

1. Dashboard loads instantly — level, XP bar, last 30 days glowing lime on the heatmap
2. One glance: habits to mark, tasks pending, any carried-over tasks to review
3. Every completion hits hard — lime flash, fire-orange XP float, haptic tick, tiny sound
4. Starting a code session, timer runs in background — XP tracked automatically
5. End of day: XP feed shows the full picture. Level progress feels earned.
6. He comes back tomorrow because the streak is alive, the bar isn't full, and the system feels *his*.

**The app makes progress visible, addictive, and personal. That's the only metric.**

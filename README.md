# ProgressOS

**A gamified personal productivity OS.** Tasks, habits, and code projects — with XP, levels, streaks, and a heatmap that shows you're actually moving.

Built mobile-first for daily use. Dark, tactical, no fluff.

**[Live demo](https://dany0421.github.io/ProgressOS/)** · **[Vision](./VISION.md)** · **[Session notes](./SESSION.md)**

---

## Why this exists

Most productivity apps are either notebooks with badges slapped on, or games that forget you're trying to get work done. ProgressOS treats progress as something you should **see and feel** — not something buried under tabs and calendar views. Every completed task, every habit checked, every coding session — they all feed one visible number on a dashboard that rewards you for showing up.

Built for people who need progress to be *visible* to stay consistent.

---

## What's in it

Four tabs, one bottom nav, everything runs on the phone.

**Dashboard** — Player card with level + XP bar, a 30-day heatmap of your momentum, today's focus (top 3 pending tasks), recent XP events, and mini stats. Settings (mute sounds, toggle haptics, logout) in a bottom sheet.

**Tasks** — Daily to-dos with low/med/high priority, due dates, a daily XP counter showing your cap progress, and a "Carried Over" filter for anything you didn't finish yesterday.

**Habits** — Recurring daily actions with streak tracking, milestone bonuses at 7 / 30 / 100 days, and a freeze system that auto-saves your streak if you miss a day.

**Projects** — Long-running work with milestones, a session timer (start/stop, survives page refresh), recent session log, auto-saving notes, and a manual "complete project" for the big +200 XP payoff.

---

## The XP system

| Action | XP |
|---|---|
| Low-priority task | +10 |
| Medium-priority task | +20 |
| High-priority task | +35 |
| All tasks done (daily bonus) | +50 |
| Habit daily completion | +15 |
| 7 / 30 / 100-day streak milestone | +50 / +150 / +500 |
| Complete project milestone | +40 |
| Complete full project | +200 |
| Project session | +5 per 30min block (min 15min) |

**Daily cap on tasks**: 250 XP per day. If a task would cross the cap, it gets partial XP; further tasks in the same day award 0 XP. Habits, project milestones, and project completion bonuses are exempt from the cap so rare events always feel rewarding.

**Level formula** (matches both client and server): `xpForLevel(n) = sum(i * 150) for i = 2..n`. Level 2 hits at 300 XP, Level 3 at 750, Level 4 at 1350, etc.

**Streak freezes**: 1 freeze granted automatically every 14 days (max stack of 3). Can also be bought for 150 XP each. Auto-consumed when a streak would break — but only protects streaks of 3+ days.

---

## Tech

- **Frontend**: Vanilla JS + HTML + CSS. No frameworks, no npm, no build step.
- **Backend**: Supabase (Postgres + Auth + RLS).
- **Supabase JS client**: pinned to `@supabase/supabase-js@2.45.4` via CDN.
- **Icons**: Lucide via CDN.
- **Fonts**: Syne (display) + DM Sans (body) + JetBrains Mono (numbers), via Google Fonts.
- **Hosting**: GitHub Pages, deployed from `main`.

### Architecture notes

- **Timezone-aware**: all user-facing dates are stored as local Maputo dates (UTC+2). Postgres `current_date` / `now()::date` defaults are deliberately avoided — all date columns are set explicitly from JS via `todayLocal()`.
- **XP awards are atomic**: handled server-side by a Postgres RPC (`award_xp`) that runs cap check, increment, event log, and level-up detection in a single transaction. Prevents race conditions from rapid taps or multi-tab use.
- **Security**: every table has RLS enabled with a `user_own_data` policy. No user can read or write another user's rows. Anon key is safe in the client; service role is never shipped.
- **XSS-safe rendering**: all dynamic content uses `createElement` + `textContent`, never `innerHTML` with interpolation.

---

## Project structure

```
ProgressOS/
├── index.html          # Dashboard
├── tasks.html          # Tasks page
├── habits.html         # Habits page
├── projects.html       # Projects page
├── login.html          # Auth entry
├── schema.sql          # Full DB schema + RLS + award_xp RPC
├── css/                # base.css, components.css, animations.css
├── js/                 # supabase, auth, time, xp, freezes, ui, sound,
│                       # tasks, habits, projects, dashboard
├── VISION.md           # Product spec (the source of truth)
├── CLAUDE.md           # Working rules for Claude Code sessions
├── SESSION.md          # Current build state, roadmap, open questions
└── README.md           # This file
```

---

## Self-hosting

Want your own instance? ~10 minutes.

### 1. Create a Supabase project

[supabase.com](https://supabase.com) → New project. Region: closest to you. Grab the **Project URL** and **anon public key** from Settings → API.

### 2. Run the schema

Supabase dashboard → SQL Editor → paste the contents of [`schema.sql`](./schema.sql) → Run. This creates all tables, indexes, RLS policies, and the `award_xp` RPC in one go.

### 3. Create your user

Authentication → Users → Add user (enable "Auto Confirm"). Then Table Editor → `profiles` → Insert row with `id` = your auth user UUID, `username` = whatever you want.

### 4. Configure auth URLs

Authentication → URL Configuration. Add your local dev URL (e.g. `http://127.0.0.1:5500/**`) and your GitHub Pages URL (e.g. `https://yourname.github.io/ProgressOS/**`) to Redirect URLs. The `**` matters.

### 5. Clone + configure

```bash
git clone https://github.com/Dany0421/ProgressOS.git
cd ProgressOS
```

Open `js/supabase.js` and paste your Supabase URL + anon key:
```js
const SUPABASE_URL = 'https://xxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

### 6. Run it

Any static server works. Easiest:
- **VS Code Live Server** — right-click `login.html` → Open with Live Server
- **Python** — `python3 -m http.server 5500` and open `http://127.0.0.1:5500/login.html`

Log in with the credentials you set in step 3. Done.

---

## Design

Dark theme, cyber-terminal aesthetic. Acid lime (`#A3FF12`) for primary actions and XP bars. Fire orange (`#FF6B35`) for XP numbers, streaks, and reward moments. Backgrounds in dark neutrals (`#0A0A0D` to `#1C1C26`) with glow borders on active elements rather than flat shadows.

Motion: short haptic ticks on task complete, ascending chime on level-up, floating XP numbers on every gain. Everything tuned for a phone in your hand — not a desktop viewport.

See [`VISION.md`](./VISION.md) for the full design token system and motion spec.

---

## License

MIT. Fork it, tweak it, make it yours.

---

Vibe-coded in vanilla JS + Supabase. No frameworks. No build step. No nonsense.
— Dany

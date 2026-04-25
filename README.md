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

**Tasks** — Daily to-dos with low/med/high priority, due dates, a daily XP counter showing your cap progress, a "Carried Over" filter for anything you didn't finish yesterday, and optional **daily/weekly recurrence** — completing a recurring task automatically spawns the next instance.

**Habits** — Recurring daily actions with streak tracking, milestone bonuses at 7 / 30 / 100 days, a freeze system that auto-saves your streak if you miss a day, a **7-day sparkline** per habit, and your **best streak** shown underneath.

**Projects** — Long-running work with milestones, a session timer (start/stop, survives page refresh), recent session log, auto-saving notes, a manual "complete project" for the big +200 XP payoff, and an **Active / Completed** tab split so finished work archives cleanly.

**Profile + Achievements** — Tap the player card to open a Profile view with big stats (Total XP, days active, tasks / habits / projects done, best streak) and a **Titles** row: unlock archetype achievements to earn titles that show under your name. From there, the **Achievements Gallery** lists 40 badges across 7 categories (XP, Streak, Volume, Rare, Trinity, Archetype, Title) with common / rare / legendary rarities. Unlock animations are tiered — toast for common, mini-modal for rare, fullscreen celebration for legendary. Hidden archetype badges stay as `???` until discovered.

**Beta Player** — The first 10 people to sign up receive a permanent **Beta Player** legendary title (+250 XP). No action needed — it's awarded automatically on sign-up.

**Match Day Vibe** — Track football matches and F1 races alongside your productivity. Create an event (kickoff time, opponent, competition), make predictions before the match locks, and settle the result after. Every correct field earns XP — score, winner, first scorer, name — and a perfect prediction stacks them all. F1 has P1 / P2 / P3 / fastest lap + a perfect-podium bonus.

Supports any team — type "Spain", "Argentina", "Barça" — and optionally pick your side before saving the event. If your team wins and you called it, you get a +15 XP win bonus on top of your prediction XP.

The dashboard shows a **match widget**: UPCOMING badge before kickoff, LIVE timer during the match, ENTER RESULT when it's done, score once settled. Multiple events on the same day get a swipeable carousel. Past unsettled events surface as orange nudge cards so nothing gets forgotten.

**Theme skin**: when an active event exists today, the entire app shifts colour palette — blaugrana for Barça, green/gold for any other football team, your F1 team's livery for race day. It's CSS variables on `body`, so every page flips automatically. Clears when the last event of the day is settled.

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
| Project session | ~1 XP per 3min (min 5min — 15min = 5 XP, 1h = 20 XP) |
| Achievement unlock — common / rare / legendary | +25 / +100 / +500 |
| Match prediction: score correct | +50 |
| Match prediction: winner correct | +20 |
| Match prediction: 1st scorer team correct | +15 |
| Match prediction: 1st scorer name correct | +30 |
| F1 prediction: P1 / P2 / P3 each | +20 each |
| F1 prediction: fastest lap | +25 |
| F1 prediction: perfect podium bonus | +30 |
| Win bonus (side chosen + team won) | +15 |

**Daily cap on tasks**: 250 XP per day. If a task would cross the cap, it gets partial XP; further tasks in the same day award 0 XP. Habits, project milestones, project completion bonuses, prediction XP, win bonus, and achievement rewards are all exempt from the cap so rare events always feel rewarding.

**Bonus Day**: roughly once a week (14% chance per day, deterministic per-user), the task cap silently doubles to **500 XP**. You only discover it when you cross 250 — the next completed task still awards XP and a full-screen "BONUS DAY" overlay fires. Pure slot-machine dopamine.

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
- **XP awards are atomic**: handled server-side by a Postgres RPC (`award_xp`) that runs cap check, increment, event log, and level-up detection in a single transaction. Prevents race conditions from rapid taps or multi-tab use. Freeze consume/purchase use the same pattern (`consume_freeze`, `purchase_freeze`) with `FOR UPDATE` row locking.
- **Security**: every table has RLS enabled with a `user_own_data` policy. No user can read or write another user's rows. Anon key is safe in the client; service role is never shipped.
- **XSS-safe rendering**: all dynamic content uses `createElement` + `textContent`, never `innerHTML` with interpolation.
- **Achievements**: all 40 badges live in an `achievements` table; unlocks are stored per-user in `user_achievements`. A single `check_achievements(user_id, trigger)` RPC dispatches to the right rules based on what just happened (task complete, habit complete, session stop, match settled, etc.) and returns any new unlocks. A one-shot `backfill_achievements(user_id)` walks the full history, inserts every qualifying unlock silently, posts ONE aggregated XP event so the XP Feed doesn't spam, and flags the rarest unlock as a pending celebration — so existing users get one legendary moment on first load, not 15 toasts.
- **Match Day theme**: `applyMatchDayTheme(userId)` fetches today's first unsettled event and sets `--match-primary`, `--match-secondary`, `--match-accent` on `document.body`. Every page reads from these three CSS vars, so the entire app shifts palette with zero component changes — blaugrana for Barça, green/gold for international football, 10 F1 team liveries. No event today or all settled → palette removed.

---

## Project structure

```
ProgressOS/
├── index.html          # Dashboard
├── tasks.html          # Tasks page
├── habits.html         # Habits page
├── projects.html       # Projects page
├── login.html          # Auth entry (login / sign up / reset password)
├── sql/
│   ├── schema.sql      # Tables, indexes, RLS, award_xp RPC
│   ├── functions.sql   # Freeze RPCs (consume_freeze, purchase_freeze)
│   ├── achievements.sql# Achievements table, 40 seed rows, check/backfill RPCs
│   └── match-day.sql   # Events/predictions/results tables, settle_event RPC
├── css/
│   ├── base.css        # Design tokens, resets
│   ├── components.css  # Shared UI components
│   ├── animations.css  # Motion + transitions
│   └── match-day.css   # Match widget, match detail, theme skin overrides
├── js/
│   ├── supabase.js, auth.js, time.js
│   ├── xp.js, freezes.js, ui.js, sound.js
│   ├── tasks.js, habits.js, projects.js, dashboard.js
│   ├── achievements.js, profile.js, achievements-gallery.js
│   ├── events.js       # Event CRUD + prediction/settle helpers
│   ├── events-view.js  # Events list + event creation forms
│   ├── match-detail.js # Match detail page + prediction UI + settle sheet
│   ├── match-widget.js # Dashboard widget card + carousel + nudges
│   └── match-day.js    # Theme activation, F1/football palettes
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

Supabase dashboard → SQL Editor, run each file in order:

1. [`sql/schema.sql`](./sql/schema.sql) — all tables, indexes, RLS policies, `award_xp` RPC
2. [`sql/functions.sql`](./sql/functions.sql) — freeze RPCs (`consume_freeze`, `purchase_freeze`)
3. [`sql/achievements.sql`](./sql/achievements.sql) — achievements schema, 40 seed rows, `check_achievements` / `backfill_achievements` / `set_active_title` / `mark_achievements_seen` RPCs
4. [`sql/match-day.sql`](./sql/match-day.sql) — events / predictions / results tables, `settle_event` RPC, `_maputo_today()` utility

### 3. Create your account

Open the app (step 6 below), click **Create account** on the login screen, enter your email and a password. That's it — the app handles sign-up and creates your profile row automatically.

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

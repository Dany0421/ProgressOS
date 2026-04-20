# SESSION.md — ProgressOS Current State

> Read this at the start of every session. Update it at the end of every session.

---

## Last Updated
*YYYY-MM-DD — fill in when updating*

---

## Project Status

**Phase**: Setup / Foundation / Feature Build / Polish
*(update as project progresses)*

**Current focus**: *what you're actively building right now*

---

## Build Roadmap 🗺

*Build in this order. Do not skip ahead — later phases depend on earlier ones. Each phase should be testable on the phone before moving on.*

### Phase 0 — Setup (one-time, see SETUP.md)
- [ ] Supabase project created, keys saved
- [ ] Schema SQL run (all tables + indexes + RLS policies)
- [ ] `award_xp` RPC function created (see CLAUDE.md §6.7)
- [ ] Test user created manually in Supabase dashboard
- [ ] Folder structure scaffolded (empty HTML + CSS + JS files per VISION §8/§9)
- [ ] Git repo initialized, connected to GitHub, Pages enabled

### Phase 1 — Foundation (no visible UI yet)
- [ ] `supabase.js` — client init, pinned version
- [ ] `time.js` — `todayLocal()`, `yesterdayLocal()`, `daysBetween()`
- [ ] `auth.js` — session check, redirect logic, `logout()`
- [ ] `login.html` — minimal login form
- [ ] CSP meta tag + Google Fonts + Lucide CDN in HTML template
- [ ] `base.css` — tokens, reset, typography, safe-area handling

**Test**: can log in, session persists across reloads, logout redirects to login.

### Phase 2 — Shared components
- [ ] Bottom nav component (HTML structure + CSS + active state logic)
- [ ] `ui.js` — `toast()`, `showBottomSheet()`, `hideBottomSheet()`, `haptic()`
- [ ] `sound.js` — `playTick()`, `playLevelUpChime()`, mute state from localStorage
- [ ] `components.css` — cards, buttons, badges, FAB, bottom sheet
- [ ] `animations.css` — task complete, XP float, level-up overlay

**Test**: toast appears on demand, bottom sheet slides up/down, nav tabs navigate.

### Phase 3 — XP engine (core system)
- [ ] `xp.js` — `awardXP()` using `award_xp` RPC
- [ ] Level formula implementation
- [ ] `showLevelUp()` overlay (persistent, tap to dismiss)
- [ ] `floatXP()` animation helper
- [ ] Daily cap check inside RPC

**Test**: manually call `awardXP()` from console, see toast + XP update + level-up if crossed.

### Phase 4 — Tasks page (first real feature, end-to-end)
- [ ] Task list render (using `createElement`, NOT `innerHTML` — see CLAUDE §6.5)
- [ ] Complete task flow (with all feedback: haptic + sound + visual + XP float)
- [ ] Add task bottom sheet
- [ ] Filter bar: All / Pending / Done / Carried Over
- [ ] Carried-over detection + badge
- [ ] Daily XP counter pill (128 / 250 XP today)
- [ ] Empty state

**Test**: full task lifecycle on phone — create, complete, hit cap, carry over next day.

### Phase 5 — Habits page
- [ ] Habit list render
- [ ] `freezes.js` — grant check, consume, purchase
- [ ] Streak check logic (on page load, before render)
- [ ] Toggle completion flow + XP award + streak increment
- [ ] Milestone detection (7/30/100) + bonus XP
- [ ] Freeze shop button + purchase flow
- [ ] Freeze auto-consume + xp_event log

**Test**: complete habit, see streak advance, simulate missed day (change `last_completed_date` in DB), watch freeze auto-consume.

### Phase 6 — Projects page
- [ ] Projects list view
- [ ] Project detail view (slides in)
- [ ] Milestones CRUD
- [ ] Session timer (start/stop, localStorage persistence across refresh)
- [ ] Session XP calculation on stop
- [ ] Recent sessions list
- [ ] Notes auto-save on blur
- [ ] Manual "Complete Project" button + 200 XP bonus

**Test**: start timer, refresh page, timer still running, stop → correct XP.

### Phase 7 — Dashboard (depends on all above having data)
- [ ] Player card + XP bar
- [ ] Settings gear icon → Settings bottom sheet
- [ ] Settings sheet: mute toggles, stats, logout
- [ ] Mini stats row (live data from other tables)
- [ ] 30-day heatmap (aggregate query on `xp_events.event_date`)
- [ ] Today's Focus (top 3 incomplete tasks)
- [ ] XP Feed (last 5 events)
- [ ] FAB for quick task add

**Test**: everything shows correct data, heatmap cells show past days, tap cell → popup.

### Phase 8 — Onboarding + polish
- [ ] Welcome modal on first login (`onboarding_completed` flag)
- [ ] All empty states polished
- [ ] Level-up chime tested on phone (volume appropriate)
- [ ] CSP tested — no console violations
- [ ] All animations smooth on actual device (not just dev tools)

**Test**: nuke test data, go through full first-use flow.

---

## In Progress 🛠

*What's half-done. Be specific about the exact next step.*

Example format:
```
- Building habits page — streak reset logic
  Next step: write the freeze auto-consume branch in `habits.js` checkStreaks()
  Blocked on: nothing
```

---

## Open Questions for Dany ❓

*Stuff you asked him but haven't gotten an answer yet. Remove when resolved.*

Example:
```
- Should completed projects still show in the list or only in an archive view?
```

---

## Known Bugs 🐛

*Bugs discovered but not yet fixed. Include severity and where.*

Example:
```
- [LOW] Task complete animation jitters on first tap after page load
  Reproduce: open /tasks.html, immediately tap first task
  Suspected cause: CSS transition not yet loaded when JS fires animation
```

---

## Decisions Made This Session 📝

*Anything we decided that's not explicitly in VISION.md. Running log so we don't forget.*

Example:
```
- 2026-04-21 — Confirmed: heatmap tooltip shows XP breakdown by category (tasks/habits/projects), not just total
- 2026-04-21 — Confirmed: freeze purchase deducts from total_xp, does NOT affect category XP pools
```

---

## Tech Debt / Future

*Things we're aware of but deliberately deferred. Don't fix these unless Dany says to.*

Example:
```
- No loading skeletons on data fetches (deferred until after MVP)
- No offline support
- No multi-user support (single-user only for now)
```

---

## Quick Reference

**Project folder structure:**
```
/
  index.html
  tasks.html
  habits.html
  projects.html
  login.html
  /js/
    supabase.js, auth.js, time.js, xp.js, freezes.js,
    ui.js, sound.js, tasks.js, habits.js, projects.js, dashboard.js
  /css/
    base.css, components.css, animations.css
  VISION.md
  CLAUDE.md
  SESSION.md
```

**Supabase URL**: *paste from dashboard when set up*
**Test user email**: *paste when created*

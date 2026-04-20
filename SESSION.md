# SESSION.md — ProgressOS Current State

> Read this at the start of every session. Update it at the end of every session.

---

## Last Updated
2026-04-21

---

## Project Status

**Phase**: Feature Build

**Current focus**: Phase 5 (Habits) done — next is Phase 6 (Projects)

---

## Build Roadmap 🗺

*Build in this order. Do not skip ahead — later phases depend on earlier ones. Each phase should be testable on the phone before moving on.*

### Phase 0 — Setup ✅
- [x] Supabase project created, keys saved
- [x] Schema SQL run (all tables + indexes + RLS + award_xp RPC)
- [x] Test user created, profile row inserted manually
- [x] Folder structure scaffolded
- [x] Git repo + GitHub Pages live

### Phase 1 — Foundation ✅
- [x] `supabase.js`, `time.js`, `auth.js`, `login.html`, `base.css`
- [x] Login works, session persists, logout via Settings sheet on Dashboard

### Phase 2 — Shared components ✅
- [x] Bottom nav, `ui.js`, `sound.js`, `components.css`, `animations.css`

### Phase 3 — XP engine ✅
- [x] `xp.js` — `awardXP()` via `award_xp` RPC, level-up overlay, floatXP, daily cap

### Phase 4 — Tasks ✅
- [x] Task list, complete flow (haptic + sound + XP float), add sheet, filters, XP pill, empty state
- [x] All-tasks-done +50 XP bonus
- [x] Carried-over tasks

### Phase 5 — Habits ✅
- [x] Habit list render (filtered by active_days + today's day of week)
- [x] `freezes.js` — consume, purchase
- [x] Streak check on page load (with active_days logic)
- [x] Toggle completion + XP + streak increment
- [x] Milestone detection (7/30/100d) + bonus XP
- [x] Freeze pill in header + buy freeze button
- [x] Freeze auto-consume + xp_event log
- [x] Day-of-week selector in add sheet (Seg–Dom)
- [x] Long press to delete habit
- **Schema addition**: `habits.active_days integer[] default '{0,1,2,3,4,5,6}'`

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

- Phase 0 scaffolding complete. All files created.
  Next step: Dany runs `schema.sql` in Supabase SQL Editor, creates test user, pushes to GitHub, tests login on phone.
  Blocked on: Dany running schema.sql

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

**Supabase URL**: https://dhrgjtnsyzybjsfaftrm.supabase.co
**Supabase anon key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocmdqdG5zeXp5YmpzZmFmdHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTc5MTQsImV4cCI6MjA5MjI5MzkxNH0.wQ6vJ_KUVMt7CturBfVvLJ088WpX1f4pUPfsXlKi1LY
**Lucide CDN version**: 0.460.0 (pinned — don't use @latest)
**Test user email**: *paste when created*

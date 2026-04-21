# SESSION.md — ProgressOS Current State

> Read this at the start of every session. Update it at the end of every session.

---

## Last Updated
2026-04-22

---

## Project Status

**Phase**: Polish / Done

**Current focus**: All phases complete. App is fully built and functional.

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

### Phase 6 — Projects page ✅
- [x] Projects list view
- [x] Project detail view (slides in from right)
- [x] Milestones CRUD
- [x] Session timer (start/stop, localStorage persistence across refresh)
- [x] Session XP calculation on stop
- [x] Recent sessions list
- [x] Notes auto-save on blur
- [x] Manual "Complete Project" button + 200 XP bonus

### Phase 7 — Dashboard ✅
- [x] Player card + XP bar (spring animation)
- [x] Settings gear → Settings bottom sheet (mute, haptic, stats, logout)
- [x] Mini stats row (tasks done today, active streaks, active projects)
- [x] 30-day heatmap + tap-to-popup with category breakdown
- [x] Today's Focus (top 3 incomplete tasks, completable from dashboard)
- [x] XP Feed (last 5 events)
- [x] FAB for quick task add

### Phase 9 — Bugs, Data Integrity & Features ✅
- [x] **functions.sql** criado — correr no Supabase antes de usar as novas features
- [x] `consume_freeze` RPC atómica: lock profiles, decrementa, actualiza habit + habit_logs + xp_events
- [x] `purchase_freeze` RPC atómica: lock profiles, valida XP (≥150) + cap (≤3), deduz + incrementa
- [x] `freezes.js` refactorizado para usar ambas as RPCs (sem race conditions)
- [x] `xp_events.category` — adicionado `'spend'` para freeze purchase (ALTER TABLE em functions.sql)
- [x] `sessionXP` bug fixado: `Math.floor(d/15)*5` (era `/30`, 16min dava 0 XP)
- [x] Projects — Archive View: tabs "Active" e "Completed", filter client-side
- [x] Auth flows — Sign Up + Forgot Password no `login.html` (3 views com fade animation)
- [x] Password show/hide toggle em todos os campos de password
- [x] Recurring tasks: `recurrence` column em tasks (none/daily/weekly), selector no add sheet, badge na card, next instance criada automaticamente no complete
- [x] Habit sparkline: 7 dots dos últimos 7 dias (verde = feito), atualiza in-place no complete
- [x] Habit "best streak": mostra `longest_streak` abaixo do sparkline

### Phase 8 — Polish ✅
- [x] Onboarding modal on first login (3 pillars, "Let's go." button)
- [x] Task long-press → reschedule / delete
- [x] Habit complete animations (card border pulse + streak bounce)
- [x] Habit streak display now shows 🔥 emoji, flickers 3× on milestone (7/30/100d)
- [x] Freeze "below 3 days" constraint — streaks < 3 days break without consuming a freeze
- [x] Level-up overlay redesigned: fade-in, number bounce (spring), XP bar fills 0→100%, button slides up
- [x] Day-of-week filter on habits page (Seg–Dom)
- [x] Logout race condition fixed (scope: global + manual localStorage cleanup + replace())

---

## In Progress 🛠

Nothing in progress. App is complete.

---

## Open Questions ❓

Nenhuma.

---

## Known Bugs 🐛

Nenhum conhecido.

---

## Decisions Made 📝

- Freeze auto-consume só se `current_streak >= 3` — streaks curtas quebram sem custo
- Logout faz replace() (não href) para bloquear back button
- Heatmap popup mostra breakdown por categoria (tasks/habits/projects/bonus)
- Freeze purchase deduz de `total_xp`, não afeta category XP pools
- Timer persiste via `localStorage` key `progress_os_timer` — sobrevive refresh e navegação
- `consumeFreeze` e `purchaseFreeze` agora são RPCs atómicas (FOR UPDATE lock) — race condition eliminada
- `sessionXP` linear: `Math.round(min/3)` com mínimo 5min — 15min=5, 30min=10, 1h=20
- **Bonus Day**: ~14% chance por dia (`abs(hashtext(user_id||date)) % 7 = 0`) — cap duplica para 500, discovery overlay dispara quando cruzas 250, ribbon "MAX 500 XP" quando atinges o novo cap

---

## Tech Debt / Future

- Sem loading skeletons nos fetches (aceite para MVP)
- Recurring tasks não têm edit — se quiser mudar o tipo de recorrência tem de apagar e recriar
- Sem suporte offline
- Sem multi-user (single-user only)
- Completed projects ficam na lista com badge "completed" — sem arquivo separado

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

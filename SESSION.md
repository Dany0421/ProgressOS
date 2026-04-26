# SESSION.md — ProgressOS Current State

> Read this at the start of every session. Update it at the end of every session.

---

## Last Updated
2026-04-26 (V2 Big Three — Level Rewards + Daily Challenge + Dormancy)

---

## Project Status

**Phase**: V2 Big Three **IMPLEMENTED — needs phone test**

**Branch**: `v2-big-three` (not yet merged to main)

**Current focus**: Phone test the 3 new features, then merge.

**Plan/spec location** (both gitignored per Dany's preference):
- Spec: `docs/specs/2026-04-22-match-day-vibe-design.md`
- Impl plan: `docs/superpowers/plans/2026-04-22-match-day-vibe.md`

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

### Phase 10 — Achievements ✅
- [x] **sql/achievements.sql** — `achievements` + `user_achievements` tables, RLS, 36 seed rows, ALTER on `xp_events.category` check to allow `'achievement'`, `profiles.active_title` + `profiles.pending_achievement_celebration` columns
- [x] **RPCs** — `check_achievements(user_id, trigger jsonb)` central dispatcher, `backfill_achievements(user_id)` one-shot (silent inserts + single aggregated xp_event + pending_achievement_celebration = rarest), `set_active_title(user_id, title_id text)` (handles NULL for "None"), `mark_achievements_seen(user_id, ids text[])`
- [x] **js/achievements.js** — `checkAchievements`, `processUnlocks` serialized, 3-tier overlay dispatcher (`showAchievementToast` common / `showAchievementModal` rare / `showAchievementLegendary` legendary), `checkPendingCelebration` called from auth restore, `fetchAchievementsState`, `setActiveTitle`, `markAchievementsSeen`
- [x] **js/profile.js** — fullscreen slide-in Profile view. Hero (avatar + name + active title label + level/XP bar), 2×3 stats grid (Total XP, days active, tasks done, habits done, projects done, best streak), horizontal titles row (None pill + unlocked archetype pills), "X/Y UNLOCKED" progress bar + "Achievements →" button
- [x] **js/achievements-gallery.js** — 3-col grid, filter row (ALL/XP/STREAK/VOLUME/RARE/TRINITY/ARCHETYPE/TITLE), rarity-colored borders, `???` for hidden-locked, detail bottom sheet with XP reward + TITLE tag, auto-mark NEW as seen on open
- [x] **Integration hooks** — `check_achievements` calls wired into `xp.js` (xp_award, bonus_discovery, bonus_cap_hit), `tasks.js` (task_complete), `habits.js` (habit_complete + new_streak + longest_streak), `projects.js` (session_stop, milestone_complete, project_complete), `freezes.js` (freeze_consumed). All fire-and-forget (`.then()`, not awaited) so UI isn't blocked. Recursion guard in xp.js: skip check when category === 'achievement'
- [x] **dashboard.js** — player card tappable → `openProfile()`, title name rendered under player name (active_title fetched from achievements table), listener idempotency via `dataset.clickBound` flag so re-renders don't stack handlers
- [x] **CSS** — rarity tokens (`--rarity-common` acid lime, `--rarity-rare` fire orange, `--rarity-legendary` purple #B57BFF + gold #FFD166), Profile view styles, titles scroll row, achievements progress bar, gallery grid + card variants, detail sheet, locked-state guards so rarity rings aren't overridden
- [x] **Real backfill** — ran for Dany: 4 unlocks, +625 XP (630→1255, level 2→3), `cap-breaker` legendary flagged for first-load celebration
- [x] **Phone-tested** — Profile renders, titles switch, gallery filters, detail sheet, legendary celebration fires once on reload then clears

**Total: 36 achievements** — 7 XP/Level, 5 Streak, 7 Volume, 4 Rare, 4 Trinity, 8 Archetype (hidden, all titles), 1 baseline Title (Initiate).

### Change Username feature ✅
- [x] Profile view: `<h2 class="profile-name">` tappable + pencil Lucide icon → bottom sheet "Change username"
- [x] Validation: 3–30 chars, trim, rejects empty/whitespace; same-username submit closes silently
- [x] DB: unique case-insensitive partial index `profiles_username_unique_ci on profiles (lower(username)) where username is not null` — handles "Dany" vs "dany" collisions
- [x] Error mapping: Postgres error code `23505` → toast "Username already taken"; network/other → generic "Could not update username"
- [x] Post-update: `_profileState.profile.username` updated in memory, `_renderProfileView()` re-renders, `_refreshPlayerCardAfterProfile` extended to refetch `username` alongside `active_title` — player-card updates on profile close

### Phase 11 — Match Day Vibe 🛠 (MID-BUILD)

**Spec**: `docs/specs/2026-04-22-match-day-vibe-design.md` (gitignored)
**Plan**: `docs/superpowers/plans/2026-04-22-match-day-vibe.md` (gitignored, 11 phases: 0–10)

**Phase 0 — Backend ✅ (applied to DB via MCP)**
- [x] `sql/match-day.sql` created + applied via `apply_migration`
- [x] 3 tables: `events` / `event_predictions` / `event_results` + RLS (`user_own_data`)
- [x] RPCs: `_maputo_today()`, `set_f1_team(p_user_id, p_team)`, `settle_event(p_event_id, p_result jsonb)` — atomic settlement, cap-exempt XP via `award_xp('prediction', ...)`
- [x] 4 new achievement rows: `pred-first` (common +25), `pred-clasico` (rare +100), `pred-perfect-podium` (rare +100), `pred-oracle` (legendary +500) — total achievements now **40**
- [x] `profiles.f1_team` column added (nullable text, enum-validated in RPC)
- [x] `xp_events.category` check constraint now allows `'prediction'` + `'system'` restored (see Known Bugs below — restored because the match-day migration accidentally dropped it)
- [x] Mirror in `sql/schema.sql` for fresh installs

**Phase 1 — Event CRUD + Events list view ✅ (phone-tested)**
- [x] `js/events.js` — `fetchUpcomingEvents`, `fetchPastEvents`, `fetchTodayEvents`, `fetchEventWithPrediction`, `createEvent`, `savePrediction` (upsert on `event_id`), `deleteEvent`, `settleEvent` (RPC wrapper), `isPredictionLocked(event)`, `canSettle(event)` (kickoff+90min), `minutesSinceKickoff(event)`
- [x] `js/events-view.js` — slide-in pane (`.events-view`, z-index 965), Upcoming + Past sections, long-press (600ms) → `_openEventOptionsSheet` (delete via bottom sheet, NOT native confirm), FAB for new event
- [x] Event create flow: sport picker sheet (FOOTBALL / F1) → sport-specific form. Football fields: home_status pill (HOME/AWAY/NEUTRAL), opponent, competition, optional custom_label, date, kickoff_time. F1 fields: gp_name, date, kickoff_time
- [x] `css/match-day.css` — events list, FAB, event rows, sport picker, settings-nav-row style
- [x] Settings bottom sheet on dashboard has new "Events" row (between stats and Logout) → opens events view
- [x] Body scroll lock while events view open (`document.body.style.overflow = 'hidden'` + restore on close) + `overscroll-behavior: contain`
- [x] Phone-tested: create football event, create F1 event, list renders with right icons, long-press → options sheet → delete works, navigation closes clean

**Committed** — Phase 0 + 1 already on main (commits: `Phase 1 - Events`, `Fix Events page`, `Fix`, `Last fix phase 1`, `Update SESSION.md`).

**Phase 2 — Match detail page ✅ (phone-tested 2026-04-23)**
- [x] `js/match-detail.js` — `openMatchDetail(eventId)` / `closeMatchDetail()`, 4-state dispatcher (pre-game / live / ready-to-settle / settled)
- [x] `_renderHero` — competition badge, team crests (Barça gradient + gold / opponent muted), VS/score mid, meta line, chequered separator
- [x] `_renderFootballSection` — editable (score inputs + winner/first-scorer pills + name input), locked pair rows, settled verdict rows (✓/✗ + XP tags)
- [x] `_renderF1Section` — P1/P2/P3/fastest-lap text inputs + optional rain%, locked pair rows, settled verdict rows + perfect-podium bonus row
- [x] `_renderFooter` — SAVE PREDICTIONS / IN PROGRESS (disabled) / ENTER RESULT → (guarded `openSettleSheet`) / +XP EARNED
- [x] `_savePredictionsFromDOM` — validates, disables save btn during write, null-guards session + kickoff_time
- [x] Body scroll lock on open (`overflow: hidden`) + restore on close and `_destroyMatchDetail`
- [x] CSS block in `css/match-day.css` (170 lines), `<script>` added to `index.html`

**Phase 3 — Dashboard widget ✅ (phone-tested 2026-04-25)**
- [x] `js/match-widget.js` — `initMatchWidget(userId)`, fetches today's events, picks first unsettled (fallback: last settled), renders card above heatmap
- [x] Card: sport icon (goal/flag) + competition label + kickoff time + teams row (BARÇA VS OPP) or GP name (F1) + status badge (UPCOMING / LIVE X' / ENTER RESULT ▸ / SETTLED)
- [x] Tappable → `openMatchDetail(event.id)`
- [x] No events today → slot stays empty, no extra space
- [x] Fix: `padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom) + 24px)` on `.match-view` — nav (z-index 1000) was hiding the Save button (view was z-index 970, only 24px bottom padding)

**Phase 4 — Settlement + XP ✅ (phone-tested 2026-04-25)**
- [x] `openSettleSheet(event, prediction)` appended to `js/match-detail.js` — opens bottom sheet "Enter result" with sport-specific form
- [x] Football: score inputs + winner pills + first-scorer team pills + scorer name input; each field shows "You predicted: X" in gold above the input
- [x] F1: P1/P2/P3/fastest-lap text inputs + optional rain YES/NO pills; same "You predicted" labels
- [x] `_collectSettleFormResult` — validates all required fields, maps form → result object for RPC
- [x] `settleEvent` RPC called → toast `+XP · PERFECT` or "Result saved, no XP"; match detail re-opens in settled state
- [x] `checkAchievements` called if perfect prediction
- [x] `window._reloadMatchWidget` wired in `match-widget.js` — widget refreshes badge to SETTLED after settlement
- [x] Fix: `overscroll-behavior: contain` + `-webkit-overflow-scrolling: touch` on `.match-view` — scroll was propagating to background page

**Phase 5 — Theme skin activation ✅ (phone-tested 2026-04-25)**
- [x] `js/match-day.js` — `applyMatchDayTheme(userId)`, `removeMatchDayTheme()`, `getActiveMatchDayEvent(userId)`, `F1_PALETTES` map (10 teams), `FOOTBALL_PALETTE` (blaugrana)
- [x] Theme fires on all 4 pages (index/tasks/habits/projects) — `match-day.js` + `match-day.css` added to tasks.html/habits.html/projects.html; call wired after auth resolves `_userId` in dashboard.js/tasks.js/habits.js/projects.js
- [x] `body.match-day` CSS overrides: radial gradient bg, player card border+glow, XP bar gradient, heatmap cell colour, avatar gradient — all driven by `--match-primary/secondary/accent` CSS vars
- [x] All-day activation: theme on while unsettled event exists today; off if all settled or no events

**Phase 6 — F1 team picker in Profile ✅ (phone-tested 2026-04-25)**
- [x] `js/profile.js` select extended to include `f1_team`
- [x] `_renderF1TeamRow()` — "MY F1 TEAM" section below titles row; button shows current team or "None — tap to pick"
- [x] `_openF1TeamPicker()` — bottom sheet with None + 10 team options; active team highlighted
- [x] `_makeF1Option()` — calls `set_f1_team` RPC, updates `_profileState.profile.f1_team`, re-renders profile, re-applies theme immediately
- [x] CSS: `.profile-f1-row`, `.profile-f1-pick`, `.f1-team-list`, `.f1-team-option`, `.f1-team-option--active`

**Bug fixes this session:**
- [x] Widget settled state: `fetchTodayEvents` now selects `event_results(...)` via join; widget shows score ("2 - 1") instead of "VS" when settled, F1 shows "P1 [name]"
- [x] `settle_event` RPC: no longer throws if no predictions exist — settles with 0 XP instead (handles case where event created after kickoff)

**Phase 7 — Carousel ✅ (phone-tested 2026-04-25)**
- [x] `initMatchWidget` — if >1 today events, renders scroll-snap carousel with `IntersectionObserver` dots
- [x] CSS: `.match-widget-carousel`, `.match-widget--in-carousel`, `.match-widget-dots`, `.match-widget-dot--active`
- [x] Fix: theme re-applies after settle — `applyMatchDayTheme` called in settle handler; picks next unsettled event's palette automatically

**Phase 8 — Nudges ✅ (phone-tested 2026-04-25)**
- [x] `renderPastUnsettledNudges(userId)` — fetches unsettled events from last 7 days, renders orange-border nudge cards above widget
- [x] `match-nudge-slot` div added to `index.html` above `match-widget-section`
- [x] Nudge tappable → opens `openMatchDetail`; disappears immediately after settle (called in settle handler)
- [x] Called on dashboard init + after every settle

**Phase 9 — Achievements ✅ (applied to DB via MCP 2026-04-25)**
- [x] `check_achievements` RPC extended with 2 new trigger types:
  - `event_created` → awards `pred-first` (common +25 XP) on first event ever
  - `prediction_perfect` → awards `pred-clasico` (football + custom_label ilike '%cl%sico%'), `pred-perfect-podium` (F1 perfect), `pred-oracle` (10 perfects total)
- [x] JS hooks already wired in `events-view.js` (event_created) and `match-detail.js` (prediction_perfect)
- [x] `sql/achievements.sql` updated to mirror DB for fresh installs

**Phase 10 — Next-up + Docs ✅ (2026-04-25)**
- [x] `initMatchWidget` — empty-today path now: fetch upcoming, filter next 7 days, render `_renderNextUpCard` (TOMORROW / IN X DAYS) or "+ ADD EVENT" dashed button if nothing in 7 days
- [x] CSS: `.match-nextup`, `.match-nextup-label`, `.match-nextup-title`, `.widget-empty-add`
- [x] SESSION.md updated
- Phase 10: next-up widget variant + README/SESSION docs update

---

### Phase 11 — Multi-Team Football Support ✅ (2026-04-25)

**Spec**: `docs/specs/2026-04-25-multi-team-design.md` (gitignored)

- [x] **DB**: `ALTER events ADD COLUMN self_team text` (nullable, fallback to BARÇA display)
- [x] **settle_event RPC**: +15 XP win bonus when `self_team IS NOT NULL AND winner = 'self'`; `win_bonus` flag in return value
- [x] **events-view.js**: Football form — Team input + Venue label (was "Barça plays") + self_team pill picker (conditional, appears when both team + opponent filled, updates live as user types, optional)
- [x] **selfTeamLabel(event)**: `(event.self_team || 'BARÇA').toUpperCase()` helper added to match-detail, match-widget, events-view
- [x] **match-detail.js**: 9 BARÇA hardcodes replaced (hero chip, prediction pills, settle sheet, _labelFor, toast shows "· WIN BONUS")
- [x] **match-widget.js**: 3 refs replaced (widget card, next-up title, nudge message); nudge select now includes self_team
- [x] **match-day.js**: `_footballPalette(selfTeam)` — null → no theme, barça/barca/fc barcelona → blaugrana, anything else → green/gold international (#00A651/#1A1A2E/#FFD700)
- [x] **Code review fixes**: `_updateSelfPicker` now re-syncs `selectedSelfTeam` when pill active + user edits; `_daysAgo` now uses Maputo local time

**Pending**: phone test — create Spain vs France, pick Spain, check widget/detail/theme; settle Spain wins, check +15 XP toast

---

## In Progress 🛠

**V2 Big Three — branch `v2-big-three`, implemented, needs phone test before merge.**

### Level Rewards ✅ (implemented, not phone-tested)
- `sql/level-rewards.sql` applied — 13 level title achievement rows, `check_level_rewards` RPC
- `js/xp.js` — `checkLevelRewards()`, `levelAvatarColour()`, `levelBadge()` added; `awardXP` calls them on level-up
- `js/ui.js` — `showLevelUp(newLevel, rewards=[])` shows rewards panel after XP bar
- `js/dashboard.js` + `js/profile.js` — avatar colour class + badge wrap applied by level
- `css/base.css` — avatar palette vars; `css/components.css` — badge ring CSS

**To test:** Set `current_level = 50` in DB → reload → player card should have gold badge ring. Set to 100 → diamond. Level-up overlay should show rewards panel.

### Daily Challenge ✅ (implemented, not phone-tested)
- `sql/daily-challenges.sql` applied — table, RLS, profile columns, 3 RPCs
- `js/daily-challenge.js` — `initDailyChallenges`, `checkDailyChallenges`, `_dcConditionMet`, `_dcComplete`, `_dcRender`
- `css/daily-challenge.css` — Easy (green) / Hard (lime) / Legendary (purple) cards
- `index.html` — challenge-section between match widget and heatmap
- `js/tasks.js`, `js/habits.js`, `js/projects.js` — fire-and-forget `checkDailyChallenges` after completions
- **Bug fixed in review:** `habit_logs` column is `completed_date`, not `log_date`
- **Bug fixed in review:** legendary combo `target_value` now stores `v_habits_today` (not hardcoded 3)

**To test:** Open dashboard → 3 challenge cards appear. Complete a task → Easy auto-completes with toast + XP float.

### Dormancy/Comeback ✅ (implemented, not phone-tested)
- `js/auth.js` — `_updateLastSeen` fire-and-forget on every `checkSession`
- `js/dashboard.js` — `_checkDormancy()`, `_showWelcomeBack()`, dormant player card visual
- `css/components.css` — dormant grayscale avatar; `css/animations.css` — amber welcome-back overlay

**To test:** Set `last_seen_date = today - 6 days` in DB → reload → player card greyscale + DORMANT label → after 1s: amber welcome-back overlay. Complete any challenge → "+XP · COMEBACK ×2" toast.

---

## Open Questions ❓

- Phone test results for V2 Big Three (Dany needs to test)
- Merge `v2-big-three` → `main` once phone-tested

---

## Known Bugs 🐛

**Resolved this session (keep as memory for pattern):**
- **CSS token name mismatch** — `css/match-day.css` initially used `--bg-primary`, which doesn't exist in `base.css`. Correct token is `--bg-base`. Symptom: events-view had no background, dashboard scrolled through. Fix applied. Lesson: check `base.css` tokens before writing new CSS files.
- **Accidentally dropped `'system'` from `xp_events.category` check constraint** — my first draft of `match-day.sql` rewrote the check without `'system'`, which is used by `sql/functions.sql:60` (freeze consume logging). Applied migration broke freeze logs silently. Fix: restored `'system'` via emergency `apply_migration`, corrected both `sql/match-day.sql` and `sql/schema.sql`. Lesson: before any `alter constraint` that rewrites an allowlist, grep the codebase for each existing value.
- **`.priority-btn--active` without a `--low/--medium/--high` modifier has no visual change** — tasks.js styles active state via compound selectors like `.priority-btn--medium.priority-btn--active`. Reusing just `.priority-btn` + `.priority-btn--active` makes buttons appear unresponsive (they are receiving clicks, but look identical). Fix in `css/match-day.css`: added override `.sheet-form .priority-btn.priority-btn--active:not(.priority-btn--low):not(.priority-btn--medium):not(.priority-btn--high) { ... acid lime highlight ... }`.
- **`confirm()` native prompt is ugly** — Dany doesn't want Windows-style alerts. Replaced long-press delete with a custom bottom-sheet options pattern (same as `_openTaskOptions` in tasks.js — shows the event title + red "Delete event" button).

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
- **UI consistency audit**: tokens `--text-on-accent` (#0A0A0D) e `--freeze-color` (#88CCFF) + `--freeze-glow` adicionados em `base.css`. Todos os hardcoded hexes em components.css/animations.css substituídos por tokens. `.sheet-option-label` duplicado removido (o primeiro bloco era dead code — só o segundo renderizava). Inline `btn.style.textTransform = 'capitalize'` em `tasks.js` removido — recurrence buttons agora herdam uppercase do `.priority-btn` (consistente com LOW/MED/HIGH)
- **Achievements — rewards are cap-exempt**: nova category `'achievement'` no check constraint de `xp_events`. Achievement XP awards skip o daily task cap — rare events sempre recompensam.
- **Achievements — single celebration on backfill**: backfill insere todos os unlocks `seen = true`, UM só xp_event agregado, e o achievement mais raro fica guardado em `profiles.pending_achievement_celebration`. No próximo load, `checkPendingCelebration()` dispara UMA animação e limpa o campo. Evita spammar novos utilizadores com 15 toasts.
- **Achievements — recursion guard**: `xp.js._triggerAchievementChecks` não roda quando `category === 'achievement'`. Sem isso, o XP award de um achievement dispararia outro check → loop infinito se cascateasse com level-up.
- **Achievements — fire-and-forget hooks**: todas as chamadas a `checkAchievements` nos action handlers (tasks/habits/projects/freezes) usam `.then()`, não `await`. UI nunca bloqueia à espera da RPC.
- **Player-card listener idempotency**: `dashboard._renderPlayerCard` re-renderiza quando voltas do Profile. `textContent = ''` não remove listeners do próprio `el` — sem guard, cada re-render empilhava outro handler. Fix: `dataset.clickBound` flag.
- **Change Username — case-insensitive uniqueness via DB**: no `SELECT` de outros usernames via RLS → decidimos usar `create unique index ... on profiles (lower(username)) where username is not null` e apanhar o erro `23505` no cliente como "Username already taken". Atómico, zero race window, zero RPC extra.
- **Match Day Vibe V1 — manual entry only**: validar o vibe antes de investir em APIs externas (football-data, ergast, openweathermap). V2 adiciona auto-detection por cima.
- **Match Day Vibe — cap-exempt `'prediction'` category**: prediction XP awards não contam para o daily task cap, mesma pattern que `'achievement'`.
- **Match Day Vibe — theme skin all-day ligado à existência de today-event**: não há lógica de timers / janelas. Se há evento hoje e ainda não está 100% settled, tema ligado. Simplificação V1 — decay 3h pós-settlement deferred para V2.
- **Beta Player title** — legendary title (`beta-player`), +250 XP, `is_title true`. Auto-awarded via trigger `trg_beta_player_on_signup` on `profiles` INSERT when total profile count ≤ 11 (first 10 real users). Not in `check_achievements` — manually seeded for existing users, trigger handles new ones.
- **Match Day Vibe — "self" vs "opponent" semantics**: schema usa `pred_self_score` / `pred_opponent_score` (e.g. Barça vs adversário), decoupled do `home_status` do evento. Evita confusão entre "home=Barça joga em casa" vs "home=equipa da casa do jogo".
- **Match Day Vibe — spec/plan in `docs/`**: Dany adicionou `docs/` ao gitignore. Specs + plans ficam locais, não vão para o repo. Diferente do default da skill de brainstorming (que comita tudo).

---

## Tech Debt / Future

- Sem loading skeletons nos fetches (aceite para MVP)
- Recurring tasks não têm edit — se quiser mudar o tipo de recorrência tem de apagar e recriar
- Sem suporte offline
- Sem multi-user (single-user only)
- Completed projects ficam na lista com badge "completed" — sem arquivo separado
- Achievements — sem progress bars nos locked cards ("42/100 tasks done"), V2
- Achievements — sem seasonal / sharing / nested unlocks (V2+)

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
    ui.js, sound.js, tasks.js, habits.js, projects.js, dashboard.js,
    achievements.js, profile.js, achievements-gallery.js
  /sql/
    schema.sql, functions.sql, achievements.sql
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

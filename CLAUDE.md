# CLAUDE.md — ProgressOS Working Rules

> Read this file at the start of every session. Then read `SESSION.md` for current state. Then read `VISION.md` only if you need to look up a spec.
>
> **First session only**: if `SETUP.md` exists, read it after this file — it guides initial project setup. Delete it after setup is done.

---

## 1. Role & Relationship

You are building ProgressOS with Dany. Dany is a self-taught vibe coder in Maputo who directs at a high level and expects you to execute with precision. He reads every commit. He will catch sloppy work. Assume he's smart but not a senior dev — explain trade-offs when they matter, skip theory when they don't.

He speaks a mix of Portuguese and English — respond in whatever language he uses.

---

## 2. The Golden Rule — Ask Before Deciding

**When anything in VISION.md is ambiguous, unclear, or missing: STOP and ask Dany before writing code.**

This is not optional. Examples of things to ask about:
- Schema decisions not explicitly specified
- UI layout when the spec says "card" but not what's on it
- Error handling approach when multiple are valid
- Whether to add a feature that "seems useful" but isn't in VISION.md
- Naming of new files/functions/tables when convention isn't clear
- Any change to existing code that wasn't in the current task scope

**What to do instead of guessing:** Summarize the ambiguity in 1-2 sentences, list 2-3 options with trade-offs, and ask which one. Example:

> "VISION.md says tasks have a 'priority badge' but doesn't specify if tapping the badge does anything. Options: (a) tap toggles priority inline, (b) tap does nothing, (c) tap opens edit sheet. Which?"

**Exception**: trivial micro-decisions (variable names inside a function, CSS margin values within spec ranges) — just decide and move on. If in doubt whether it's trivial, ask.

---

## 3. Testing Protocol — Phone Validation

After building any UI-facing feature, **ask Dany to test it on his phone before moving on**. Do not batch multiple features and ask him to test them all at once — validation per feature catches bugs faster.

**Format of the test ask:**
```
Ready for you to test [feature name]:
1. Open [page] on your phone
2. Do [specific action]
3. Expect [specific result]

What breaks / looks off / feels wrong?
```

Don't move to the next task until Dany confirms it works. If he reports a bug, fix it and ask him to re-test the same feature before continuing.

---

## 4. File Discipline

### Reading before writing
- Read `SESSION.md` first thing every session — it tells you where we left off
- Read the relevant file **before** editing it — don't work from memory of what's in a file
- Use the actual filesystem, never assume

### Writing
- Vanilla JS only. No npm. No frameworks. Supabase via CDN.
- File naming: `lowercase-hyphen.js`. No camelCase filenames.
- No inline styles. No inline `<script>` tags with logic (CDN imports only).
- Every file starts with a `DEBUG` constant: `const DEBUG = false;`
- Console logs wrapped: `if (DEBUG) console.log(...)`

### Editing
- Make the smallest change that solves the problem
- Don't refactor unrelated code while fixing a bug — create a separate task if refactor is needed
- Don't delete code you don't understand — ask first

---

## 5. The Timezone Rule (Read It Twice)

**Maputo is UTC+2. All user-facing "days" are Maputo local dates.**

- JS: always use `todayLocal()` from `time.js`. Never `new Date().toISOString().split('T')[0]`.
- SQL: never rely on `current_date` or `now()::date` defaults for user-facing date columns. Pass them from JS.
- If you're writing any date logic, re-read Section 4.1 of VISION.md. Every time.

This is the #1 source of bugs in streak/date apps. Do not get lazy with it.

---

## 6. Supabase Patterns

### Every query wrapped in try/catch
```js
try {
  const { data, error } = await supabase.from('tasks').select('*');
  if (error) throw error;
  // use data
} catch (err) {
  if (DEBUG) console.error('tasks fetch failed', err);
  toast('Could not load tasks', 'error');
}
```

No silent failures. Ever. Every user-facing error shown via `toast()`.

### XP awards are atomic
`awardXP()` in `xp.js` must:
1. Check daily cap (if category === 'tasks')
2. Update `profiles` totals
3. Insert into `xp_events` with explicit `event_date = todayLocal()`
4. Check for level-up → trigger `showLevelUp()` if needed

All in the same async function, all awaited. If any step fails, the whole thing fails cleanly — don't leave half-written state.

### RLS is on everything
Every table has RLS enabled with `user_own_data` policy. Never write a query that assumes RLS is off.

---

## 6.5 Security — XSS & DOM Practices

**Never use `innerHTML` with dynamic content.** This is non-negotiable. Any user-provided string rendered via `innerHTML` is an XSS vulnerability waiting to happen — task titles, project names, notes, habit names, all of it comes from user input and gets stored in Supabase, then rendered back.

### Banned patterns
```js
// ❌ NEVER
element.innerHTML = `<div>${task.title}</div>`;
element.insertAdjacentHTML('beforeend', userContent);
document.write(anything);

// ❌ NEVER (even with "trusted" data — today's trust is tomorrow's breach)
card.innerHTML = `<h3>${project.name}</h3><p>${project.notes}</p>`;
```

### Required patterns
```js
// ✅ Use createElement + textContent
const card = document.createElement('div');
card.className = 'task-card';

const title = document.createElement('h3');
title.textContent = task.title;  // textContent auto-escapes
card.appendChild(title);

// ✅ For repetitive structures, build a helper
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.taskId = task.id;

  const title = document.createElement('h3');
  title.textContent = task.title;
  card.appendChild(title);

  // ... etc
  return card;
}

// ✅ Clearing a container is the one safe innerHTML use
container.innerHTML = '';  // fine — no dynamic content
```

### The ONE exception
Static HTML templates with **zero interpolation** are fine:
```js
// ✅ OK — no user data anywhere
element.innerHTML = '<svg viewBox="0 0 24 24"><path d="M..." /></svg>';
```
If there's a `${}` in the string, it's not this exception.

### Input hygiene
- Trim user input on submit (`.trim()`) — don't let empty-whitespace tasks through
- Enforce max lengths in JS before inserting to Supabase:
  - Task/habit/milestone title: 200 chars
  - Project name: 100 chars
  - Project description / notes: 2000 chars
- Supabase parameterizes queries automatically via the JS client — you're safe from SQL injection **as long as you use the `.from().select()` / `.insert()` API**. Never build raw SQL strings with user input.

### Storage of secrets
- Supabase anon key goes in client code — that's fine, it's designed for that (RLS is what protects data)
- Never put service role key in client code — if Claude Code ever suggests this, refuse
- `localStorage` is for UI preferences only (mute, haptic) — never auth tokens (Supabase handles that itself)

### Content Security Policy
Add a basic CSP meta tag in every HTML file's `<head>` — last line of defense if something slips through:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co; img-src 'self' data:;">
```
Adjust CDN domains to match what's actually used. `'unsafe-inline'` on styles is necessary for dynamic inline CSS from JS animations — accepted trade-off.

---

## 6.7 Race Conditions & Atomicity

Before writing any code that reads-then-writes state (XP awards, streak updates, freeze consumption, timer stop), **stop and think about concurrent calls**. Dany did CS50 Week 7 — he will catch race conditions you miss.

### The classic ProgressOS race condition

```js
// ❌ WRONG — read-modify-write with two sources
const { data } = await supabase.from('profiles').select('total_xp').single();
const newTotal = data.total_xp + amount;
await supabase.from('profiles').update({ total_xp: newTotal });
```

If the user completes a task and marks a habit within ~200ms (double tap on fast UI), both calls read `total_xp = 1000`, both calculate `1020` and `1015`, the second write overwrites the first — **XP silently lost.**

### The fix — use Postgres RPC with atomic logic

Create a Supabase function that handles cap check + award + level calc in a single transaction:

```sql
create or replace function award_xp(
  p_user_id uuid,
  p_amount int,
  p_category text,
  p_description text,
  p_event_date date
) returns jsonb language plpgsql security definer as $$
declare
  v_today_tasks_xp int;
  v_new_total int;
  v_old_level int;
  v_new_level int;
  v_level_threshold int;
  v_cumulative int := 0;
  v_i int := 2;
begin
  -- 1. Daily cap check (tasks only, exempts milestone/project bonuses)
  if p_category = 'tasks' then
    select coalesce(sum(xp_amount), 0) into v_today_tasks_xp
      from xp_events
      where user_id = p_user_id
        and category = 'tasks'
        and event_date = p_event_date;

    if v_today_tasks_xp >= 250 then
      return jsonb_build_object(
        'awarded', 0,
        'capped', true,
        'leveled_up', false
      );
    end if;

    -- Partial award if this would cross the cap
    if v_today_tasks_xp + p_amount > 250 then
      p_amount := 250 - v_today_tasks_xp;
    end if;
  end if;

  -- 2. Atomic increment of profile totals
  update profiles
    set total_xp = total_xp + p_amount,
        tasks_xp    = case when p_category = 'tasks'    then tasks_xp    + p_amount else tasks_xp    end,
        habits_xp   = case when p_category = 'habits'   then habits_xp   + p_amount else habits_xp   end,
        projects_xp = case when p_category = 'projects' then projects_xp + p_amount else projects_xp end
    where id = p_user_id
    returning total_xp, current_level into v_new_total, v_old_level;

  -- 3. Log event with explicit local date (never current_date — that's UTC)
  insert into xp_events (user_id, description, xp_amount, category, event_date)
    values (p_user_id, p_description, p_amount, p_category, p_event_date);

  -- 4. Calculate new level
  -- Formula (matches js/xp.js xpForLevel): cumulative = sum of (i * 150) for i = 2..n
  -- Level 1: 0, Level 2: 300, Level 3: 750, Level 4: 1350, Level 5: 2100...
  v_new_level := 1;
  loop
    v_cumulative := v_cumulative + (v_i * 150);
    exit when v_cumulative > v_new_total;
    v_new_level := v_i;
    v_i := v_i + 1;
  end loop;

  -- 5. Update profile level if changed
  if v_new_level > v_old_level then
    update profiles set current_level = v_new_level where id = p_user_id;
  end if;

  return jsonb_build_object(
    'awarded',    p_amount,
    'capped',     false,
    'new_total',  v_new_total,
    'leveled_up', v_new_level > v_old_level,
    'new_level',  v_new_level,
    'old_level',  v_old_level
  );
end; $$;
```

Then in JS:
```js
const { data, error } = await supabase.rpc('award_xp', {
  p_user_id: userId,
  p_amount: amount,
  p_category: category,
  p_description: description,
  p_event_date: todayLocal()
});
if (error) throw error;

if (data.capped) {
  toast("Daily task cap reached. You're crushing it.");
  return;
}
if (data.leveled_up) {
  showLevelUp(data.new_level);
}
floatXP(element, data.awarded);
```

### Rules this RPC enforces
- Cap check and award happen in **one transaction** — no race window
- Level formula lives in **one place** (SQL) and matches `xpForLevel()` in JS exactly — if you change one, change both
- `event_date` passed from JS via `todayLocal()` — never trust Postgres `current_date`
- Partial awards: if user is at 240/250 and completes a +20 task, they get +10 and hit cap (not +20 over cap, not +0)

### Other places to think about races

- **Streak check on habits page load**: two tabs open = two streak resets. Mitigation: check `last_completed_date` inside the update's WHERE clause, not just before the update.
- **Freeze auto-consume**: same habit could auto-consume two freezes if two tabs load simultaneously. Make freeze decrement atomic via RPC too.
- **Timer stop**: if user stops a session and quickly starts a new one, make sure the second start happens AFTER the first stop's update lands. Await all writes before changing UI state.
- **Daily cap check**: the "am I over 250 XP today?" query and the award must be atomic — otherwise two rapid task completes can both slip under the cap. Do this inside the `award_xp` RPC.

### The rule
If you're writing code that does `SELECT ... compute ... UPDATE`, you're writing a race condition. Use RPC with atomic SQL, or use `.update({ col: supabase.raw('col + 1') })` where possible.

---

## 7. UI Patterns

### Don't invent new components
If VISION.md specifies a card style, bottom sheet style, or button style — use it. Don't create a "new kind of card for this specific case" unless Dany asks.

### Reuse helpers
- Bottom sheet for any modal-like input → `showBottomSheet()`
- Notifications → `toast(message, type)`
- Level-up → `showLevelUp(level)` (handled inside `xp.js`, don't call manually)
- Floating XP → `floatXP(element, amount)`
- Haptic → `haptic(pattern)` (respects mute)

### Mobile-first, always
Build at 390px. Test at 390px. Don't worry about desktop — it can look weird.

---

## 8. Token Efficiency

You are being used for a long project. Save tokens where you can:
- Don't re-read files you've already read in this session unless they changed
- Don't re-state what's in VISION.md — just reference the section ("per VISION §4.4")
- Don't write exhaustive summaries at the end of each response — only when Dany asks
- Don't over-explain trivial changes
- If a task is straightforward, just do it — skip the "I'm going to..." preamble

Save explanation for trade-offs, bugs, and decisions that affect architecture.

---

## 9. End-of-Session Protocol

Before ending a session (when Dany says "stop", "done for today", or similar):

1. **Update `SESSION.md`** with:
   - What got completed this session
   - What's half-done (and what exact step is next)
   - Any open questions waiting on Dany
   - Any bugs discovered but not fixed
2. **Confirm** with Dany that SESSION.md reflects reality before he leaves

If the session ends abruptly (context limit, crash), next session's first job is to reconstruct SESSION.md from the last commit + chat history.

---

## 10. What NOT to Do

- Don't add features not in VISION.md without asking
- Don't refactor "while you're in there"
- Don't install npm packages (project is vanilla JS, CDN only)
- **Don't use `innerHTML` with dynamic content — EVER. See §6.5.**
- Don't generate placeholder data or lorem ipsum — use real test data or empty states
- Don't write TODO comments — either do it, or put it in SESSION.md as an open item
- Don't apologize when Dany points out a mistake. Acknowledge, fix, move on.
- Don't be chatty. He's building an app, not having a chat.

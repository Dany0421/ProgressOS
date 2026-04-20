# SETUP.md — Session Zero

> Read this ONCE, on the very first session. After setup, ignore this file and work from CLAUDE.md + SESSION.md + VISION.md.

---

## Goal of Session Zero

Get the project from "empty folder" to "I can log in and see the empty dashboard shell" in one sitting. No features yet — just the skeleton.

**Estimated time**: 45–90 min with Dany.

---

## Pre-flight Checklist (Dany does these, manually, NOT Claude Code)

Before Claude Code writes any code, Dany must have:

1. **Supabase project created**
   - Go to supabase.com → New Project
   - Name: `progressos` (or whatever)
   - Region: closest to Maputo (likely `eu-west-1` / Ireland or `eu-central-1` / Frankfurt)
   - Save the database password somewhere safe
   - Once created, grab from Settings → API:
     - `Project URL` (looks like `https://xxx.supabase.co`)
     - `anon` public key (safe to put in client code)

2. **GitHub repo created**
   - New public/private repo (your call), empty
   - Clone to local folder
   - If the folder Dany already has is not a git repo yet: `git init`, add remote, first commit with just a README

3. **GitHub Pages enabled**
   - Repo Settings → Pages → Source: `main` branch, `/` root
   - Note the Pages URL (e.g. `https://dany0421.github.io/progressos/`)
   - Add the Pages URL to Supabase: Auth → URL Configuration → Site URL + Redirect URLs

---

## Setup Sequence (Claude Code handles from here)

### Step 1 — Folder scaffolding

Create the structure exactly per VISION.md §8 and §9:
```
/
  index.html
  tasks.html
  habits.html
  projects.html
  login.html
  /js/
    supabase.js  auth.js  time.js  xp.js  freezes.js
    ui.js  sound.js  tasks.js  habits.js  projects.js  dashboard.js
  /css/
    base.css  components.css  animations.css
  VISION.md   (already exists)
  CLAUDE.md   (already exists)
  SESSION.md  (already exists)
  SETUP.md    (this file — delete after first session)
  README.md   (short project description)
  .gitignore  (node_modules is irrelevant, but add .DS_Store, .env)
```

Every HTML file should have the same `<head>`: CSP meta tag, Google Fonts link, Lucide CDN, Supabase JS pinned version (see VISION §3), favicon placeholder, viewport meta.

Every JS file starts with `const DEBUG = false;`.

Every CSS file starts with a header comment stating its purpose.

### Step 2 — Supabase config file

Ask Dany for his Supabase URL and anon key. Create `js/supabase.js`:
```js
const DEBUG = false;
const SUPABASE_URL = 'https://xxx.supabase.co';   // from Dany
const SUPABASE_ANON_KEY = 'eyJ...';                // from Dany
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Note**: these keys go in client code — that's fine for anon key (RLS protects data). Confirm with Dany that the anon key he gave is the `anon` key, NOT the `service_role` key. If it starts with `eyJ...` and is labelled "anon public" in Supabase dashboard, it's correct.

### Step 3 — Database schema

Generate the full schema SQL (all tables from VISION §7, the `award_xp` RPC from CLAUDE §6.7, all indexes). Give it to Dany as a single file `schema.sql` or as a pasteable block.

Dany runs it in Supabase → SQL Editor → New Query → paste → Run.

Verify together:
- All tables appear in Table Editor
- RLS is enabled on each (Table Editor → table → "RLS enabled" badge)
- `award_xp` function appears in Database → Functions

### Step 4 — RLS policies

After schema runs, apply the RLS policy to every table (also from VISION §7). Dany runs it.

Verify: try to query any table while logged out — should return empty. Logged in as test user — should only see own rows.

### Step 5 — Test user

Dany goes to Supabase → Authentication → Users → Add User → email + password. Note credentials (don't commit them).

Then Supabase → Table Editor → `profiles` → Insert row with:
- `id` = UUID from auth.users (copy from Authentication tab)
- `username` = "Dany"
- rest default

### Step 6 — Login page + auth flow

Build `login.html` + `js/auth.js` per VISION §10. Nothing fancy — just:
- Email + password inputs
- Submit button
- On success → redirect to `index.html`
- On error → toast with message

`auth.js` also exports `checkSession()` and `logout()`.

Every other HTML file (index, tasks, habits, projects) includes `auth.js` and calls `checkSession()` on load — no session → redirect to `login.html`.

### Step 7 — Base CSS + bottom nav shell

Build `base.css` with all tokens from VISION §2. Build the bottom nav HTML + CSS as a reusable snippet (copied into each of the 4 main pages, since no framework means no components).

Each main page at this point is: `<header>placeholder</header>` + `<main>coming soon</main>` + bottom nav.

### Step 8 — Test on phone

Push to GitHub, Pages auto-deploys, open on phone:
- Login works
- Bottom nav visible and navigable
- Redirects work (logged out → login; logged in → dashboard)
- Dark theme renders, fonts load, no CSP violations in console (ask Dany to check via remote debugging or trust it for now)

**Celebrate. Phase 0 done.**

### Step 9 — Update SESSION.md

Mark Phase 0 complete in SESSION.md. Set `Current focus` to "Phase 1 — Foundation" or start Phase 1 immediately if time allows.

---

## After Session Zero

Delete this file (`SETUP.md`) — it's served its purpose. From here on, every session starts by reading `CLAUDE.md` → `SESSION.md` → (VISION.md as reference).

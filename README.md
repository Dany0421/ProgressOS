# ProgressOS 🎮⚡

> **Gamified productivity that actually sticks.**

[🎮 Live Demo](https://dany0421.github.io/ProgressOS/) • [👁️ Vision](./VISION.md) • [📓 Session Notes](./SESSION.md)

*Track tasks, build habits, and level up your life — all in a clean, mobile-first interface built with vanilla JS + Supabase.*

---

## ✨ Why ProgressOS?

Most productivity apps fail because they rely on willpower alone. ProgressOS adds **meaningful gamification** to make consistency feel rewarding:

✅ **XP & Levels** — Visual progress that motivates without overwhelming  
✅ **Streaks with Freezes** — Accountability that respects real life  
✅ **Projects with Deep Work Tracking** — Measure focus, not just completion  
✅ **Heatmap Dashboard** — See your momentum at a glance  
✅ **100% Private** — Your data stays in your Supabase project (RLS enforced)  

> 🎯 Built for: developers, creators, students — anyone who wants to *feel* progress while getting things done.

---

## 🎮 How the Gamification Works

ProgressOS uses game mechanics as **motivation tools**, not distractions:

### 📊 XP System
| Action | XP | Why it matters |
|--------|----|---------------|
| Complete low-priority task | +10 | Small wins count |
| Complete high-priority task | +35 | Hard things = bigger reward |
| Finish a habit (scheduled day) | +15 | Consistency > intensity |
| Complete project milestone | +40 | Progress, not just perfection |
| Finish entire project | +200 | Celebrate the big wins |
| All tasks done today | +50 | Daily completion bonus |

**Daily XP Cap**: 250 XP — prevents burnout, encourages sustainable habits.

### 🔥 Streaks & Freezes
- **Streaks** track consecutive days you complete a habit
- **Milestones** at 7 / 30 / 100 days give bonus XP (+50 / +150 / +500)
- **Freeze Tokens** (buy for 150 XP, max 3):
  - Auto-consumed if you miss a day (only if streak ≥ 3)
  - Protects your progress when life happens
  - Strategic resource — use wisely!

### 📈 Leveling Up
```js
// Formula: xpForLevel(n) = sum(i * 150) for i = 2 → n
// Example: Level 2 = 300 XP, Level 3 = 750 XP total
```
- Level-ups trigger a celebratory animation + chime
- Purely cosmetic — no paywalls, no locked features
- Visual reminder: *you're growing*

---

## 📱 Core Features

### ✅ Tasks
- CRUD with priorities (low/med/high) and due dates
- "Carried over" logic for overdue tasks
- Long-press → reschedule or delete
- Filter: All / Pending / Done / Carried
- Visual XP pill showing daily progress

### 🔥 Habits
- Schedule by day of week (Mon–Sun)
- Streak tracking with milestone detection
- Visual flame animation + pulse feedback
- Freeze system integrated seamlessly

### 📁 Projects
- Organize work with categories, descriptions, status
- Milestones with completion tracking (+40 XP each)
- **Deep Work Timer**:
  - Start/stop with localStorage persistence (survives refresh!)
  - Auto-XP calculation when stopping
  - "RUNNING" indicator on active projects
- Notes with auto-save on blur
- "Complete Project" button: +200 XP bonus

### 🏠 Dashboard
- **Player Card**: Avatar, level, animated XP bar
- **30-Day Heatmap**: Color-coded by XP earned (tap for breakdown)
- **Today's Focus**: Top 3 incomplete tasks, completable inline
- **XP Feed**: Last 5 events with timestamps
- **Mini Stats**: Tasks done, active streaks, active projects
- **Settings Sheet**: Mute sounds, toggle haptics, view stats, logout

### 🎨 Polish & UX
- Bottom navigation + modal sheets (mobile-optimized)
- Toast notifications for feedback
- Haptic patterns: `[10]` (light), `[10,30,10]` (medium), `[30,50,30]` (strong)
- Sound effects: tick, level-up chime, milestone fanfare
- Float XP animations (numbers that "pop" on gain)
- Onboarding modal for first login
- Dark/light theme via CSS variables

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Vanilla JS (ES6+) + HTML5/CSS3 | Zero build step, fast, transparent |
| **Backend** | Supabase (Auth + Postgres + RPC) | Real-time capable, RLS security, free tier |
| **Icons** | Lucide (CDN, pinned v0.460.0) | Lightweight, consistent, accessible |
| **Hosting** | GitHub Pages | Zero-config, free, CI/CD via push |
| **Persistence** | LocalStorage + Supabase | Timer survives refresh; data synced to cloud |

### 🗂️ Project Structure
```
ProgressOS/
├── index.html              # Single-page app entry
├── style.css               # CSS variables, responsive, themes
├── js/
│   ├── core/
│   │   ├── auth.js         # Supabase auth flow
│   │   ├── rpc.js          # RPC wrappers (award_xp, etc.)
│   │   └── state.js        # Global app state
│   ├── features/
│   │   ├── tasks.js        # CRUD + XP logic
│   │   ├── habits.js       # Streaks + freezes
│   │   ├── projects.js     # Sessions + milestones
│   │   └── dashboard.js    # Heatmap + XP feed
│   ├── ui/
│   │   ├── modals.js       # Bottom sheets, toasts
│   │   ├── animations.js   # Float XP, pulse, bounce
│   │   └── sound.js        # Haptics + audio toggles
│   └── utils/
│       ├── xp.js           # XP formulas, caps, formulas
│       ├── freezes.js      # Freeze purchase/consume logic
│       └── helpers.js      # Date utils, DOM helpers
├── supabase/
│   ├── schema.sql          # Tables, indexes, FKs
│   ├── policies.sql        # RLS policies (user-isolation)
│   └── functions.sql       # award_xp RPC (server-side logic)
├── .env.example            # Supabase URL + anon key
├── VISION.md               # Product philosophy
├── SESSION.md              # Development notes & tradeoffs
└── README.md               # You are here
```

---

## 🚀 Get Started

### Option 1: Try the Live Demo (No Setup)
👉 [https://dany0421.github.io/ProgressOS/](https://dany0421.github.io/ProgressOS/)

*Note: Demo uses a shared Supabase project — data may be reset. For personal use, self-host below.*

### Option 2: Self-Host with Your Supabase Project

#### 1. Create a Supabase Project
- Go to [supabase.com](https://supabase.com) → New Project
- Note your **Project URL** and **anon public key**

#### 2. Clone & Configure
```bash
git clone https://github.com/Dany0421/ProgressOS.git
cd ProgressOS
cp .env.example .env
# Edit .env with your Supabase credentials:
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

#### 3. Run Database Migrations
In Supabase Dashboard → SQL Editor:
```sql
-- Run these in order:
-- 1. supabase/schema.sql (creates tables)
-- 2. supabase/policies.sql (enables RLS)
-- 3. supabase/functions.sql (adds award_xp RPC)
```

#### 4. Open Locally
```bash
# Option A: Simple HTTP server
python3 -m http.server 8000
# Then visit: http://localhost:8000

# Option B: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

#### 5. Sign Up & Go!
- First login triggers onboarding
- Your data is isolated via Row Level Security (RLS)
- Start tracking, earning XP, leveling up 🎉

---

## 🗄️ Database Schema Overview

### Core Tables
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `profiles` | User metadata | id, username, avatar_url, level, total_xp |
| `tasks` | Todo items | id, user_id, title, priority, due_date, status |
| `habits` | Recurring habits | id, user_id, name, active_days[], streak_count |
| `habit_logs` | Daily completions | habit_id, date, completed |
| `projects` | Long-term work | id, user_id, title, category, status, description |
| `milestones` | Project sub-goals | project_id, title, completed, xp_reward |
| `project_sessions` | Deep work tracking | project_id, start_time, end_time, xp_awarded |
| `xp_events` | Audit log of all XP gains | user_id, amount, source, timestamp |
| `freeze_tokens` | Streak protection | user_id, purchased_at, consumed_at |

### 🔐 Security: Row Level Security (RLS)
All tables enforce:
```sql
-- Example: tasks table policy
CREATE POLICY "Users can only access their own tasks"
ON tasks FOR ALL
USING (auth.uid() = user_id);
```
→ Your data is **never** visible to other users.

### ⚙️ Server-Side Logic: `award_xp` RPC
```sql
-- Called from frontend: award_xp(user_id, amount, source)
-- Handles:
-- • Daily XP cap enforcement (250 max)
-- • Level-up detection & notification
-- • XP event logging
-- • Transactional safety (all-or-nothing)
```
→ Keeps game logic secure and consistent.

---

## ⚙️ Configuration & Customization

### 🎮 XP Values (Edit in `js/utils/xp.js`)
```js
export const XP_VALUES = {
  task: { low: 10, medium: 20, high: 35 },
  habit: 15,
  milestone: 40,
  project_complete: 200,
  all_tasks_done: 50,
  streak: { 7: 50, 30: 150, 100: 500 }
};
export const DAILY_XP_CAP = 250;
```

### ❄️ Freeze Logic (Edit in `js/utils/freezes.js`)
```js
export const FREEZE_CONFIG = {
  cost: 150,          // XP to buy one
  max_owned: 3,       // Max freezes a user can hold
  min_streak_to_use: 3 // Only auto-consume if streak ≥ 3
};
```

### 🔊 Sound & Haptics
- Toggle in Settings sheet
- Haptic patterns defined in `js/ui/sound.js`
- Sounds use Web Audio API (no external dependencies)

### 🐛 DEBUG Mode
Add `?debug=true` to URL or set:
```js
// In js/core/state.js
export const DEBUG = true; // Enables verbose console logging
```

---

## 🤝 Contributing

ProgressOS is open source and built to be forked. Here's how to help:

### 🐛 Report Issues
- Use GitHub Issues with: steps to reproduce, expected vs actual, browser/device info
- Bonus: include console logs if `?debug=true`

### 💡 Suggest Features
- Keep scope in mind: MVP first, polish later
- Ask: "Does this help someone *feel* progress?"
- Use Discussions for early ideas before coding

### 🛠️ Code Contributions
1. Fork + create feature branch
2. Follow existing patterns: modular JS, CSS variables, mobile-first
3. Test RLS policies if touching backend logic
4. Add comments for non-obvious XP/streak math
5. PR with clear description + screenshots if UI changed

### 🎨 Design Feedback
- Accessibility: color contrast, tap targets, screen reader labels
- Motion: reduce animations if `prefers-reduced-motion`
- Theming: CSS variables make dark/light easy — test both!

---

## 🐛 Known Limitations (MVP Tradeoffs)

| Limitation | Why | Workaround / Future |
|-----------|-----|---------------------|
| ❌ No offline support | Supabase client requires network | Service worker planned for v2 |
| ❌ Single-user only | RLS isolates data, but no multi-account UI | Could add org/team support later |
| ❌ Completed projects stay visible | No archive view yet | Add "Archive" filter + bulk actions |
| ⚠️ `consumeFreeze` not atomic | Race condition if 2 tabs open | Move to RPC in next iteration |
| ⚠️ No loading skeletons | Fetches are fast; added complexity later | Add skeleton screens for slower networks |

*See [SESSION.md](./SESSION.md) for full development notes.*

---

## 📄 License

**MIT License** — Do whatever you want with this code.

> Fork it. Tweak the XP values. Add your own features. Make it yours.  
> Just don't blame me if you get *too* addicted to leveling up. 😉

---

## 🌟 Support the Project

If ProgressOS helps you ship more, build better, or just feel good about checking boxes:

⭐ **Star this repo** — helps others find it  
🐛 **Report bugs** — makes it better for everyone  
💬 **Share your setup** — how do *you* use ProgressOS?  
🔄 **Fork and customize** — make the productivity OS *you* need  

---

## 📧 Contact

- **Repo**: https://github.com/Dany0421/ProgressOS  
- **Demo**: https://dany0421.github.io/ProgressOS/  
- **Issues**: https://github.com/Dany0421/ProgressOS/issues  
- **Discussions**: https://github.com/Dany0421/ProgressOS/discussions  

---

> **VibeCoded using vanilla JavaScript + Supabase**  
> *No frameworks. No build step. No nonsense.*  
> *— Dany*  

*Version: 1.0.0 • Last updated: 21.04.2026*

-- ProgressOS — Full Database Schema
-- Run this ONCE in Supabase → SQL Editor → New Query → Run
-- Run BEFORE creating the test user (trigger creates profile on signup)

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists profiles (
  id uuid references auth.users primary key,
  username text,
  total_xp integer default 0,
  current_level integer default 1,
  tasks_xp integer default 0,
  habits_xp integer default 0,
  projects_xp integer default 0,
  freezes_available integer default 0,
  last_freeze_grant_date date,
  onboarding_completed boolean default false,
  created_at timestamptz default now()
);

create unique index if not exists profiles_username_unique_ci
  on profiles (lower(username))
  where username is not null;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  completed boolean default false,
  completed_at timestamptz,
  due_date date,
  xp_awarded integer default 0,
  recurrence text check (recurrence in ('none', 'daily', 'weekly')) default 'none',
  created_at timestamptz default now()
);
create index if not exists tasks_user_due on tasks(user_id, due_date);

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_completed_date date,
  total_completions integer default 0,
  active_days integer[] default '{0,1,2,3,4,5,6}',  -- 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  created_at timestamptz default now()
);

create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references habits(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  completed_date date not null,
  xp_awarded integer default 0,
  streak_at_completion integer default 0,
  was_freeze_save boolean default false,
  unique (habit_id, completed_date)
);

create table if not exists projects (
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
);

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  completed boolean default false,
  completed_at timestamptz,
  xp_awarded integer default 40,
  created_at timestamptz default now()
);

create table if not exists project_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer,
  xp_awarded integer default 0,
  created_at timestamptz default now()
);
create index if not exists sessions_project on project_sessions(project_id, started_at desc);

create table if not exists xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  description text not null,
  xp_amount integer not null,
  category text check (category in ('tasks', 'habits', 'projects', 'bonus', 'system', 'spend')),
  event_date date not null,
  created_at timestamptz default now()
);
create index if not exists xp_events_user_date on xp_events(user_id, event_date desc);

-- ============================================================
-- TRIGGER — auto-create profile on signup
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- RLS — enable on all tables
-- ============================================================

alter table profiles enable row level security;
alter table tasks enable row level security;
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table projects enable row level security;
alter table milestones enable row level security;
alter table project_sessions enable row level security;
alter table xp_events enable row level security;

create policy "user_own_data" on profiles for all using (auth.uid() = id);
create policy "user_own_data" on tasks for all using (auth.uid() = user_id);
create policy "user_own_data" on habits for all using (auth.uid() = user_id);
create policy "user_own_data" on habit_logs for all using (auth.uid() = user_id);
create policy "user_own_data" on projects for all using (auth.uid() = user_id);
create policy "user_own_data" on milestones for all using (auth.uid() = user_id);
create policy "user_own_data" on project_sessions for all using (auth.uid() = user_id);
create policy "user_own_data" on xp_events for all using (auth.uid() = user_id);

-- ============================================================
-- award_xp RPC — atomic XP award with cap + level check
-- ============================================================

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
  v_cumulative int := 0;
  v_i int := 2;
  v_is_bonus boolean := false;
  v_cap int := 250;
  v_bonus_crossed_250 boolean := false;
  v_bonus_cap_hit boolean := false;
begin
  if p_category = 'tasks' then
    v_is_bonus := (abs(hashtext(p_user_id::text || p_event_date::text)) % 7) = 0;
    v_cap := case when v_is_bonus then 500 else 250 end;

    select coalesce(sum(xp_amount), 0) into v_today_tasks_xp
      from xp_events
      where user_id = p_user_id
        and category = 'tasks'
        and event_date = p_event_date;

    if v_today_tasks_xp >= v_cap then
      return jsonb_build_object(
        'awarded', 0, 'capped', true, 'leveled_up', false,
        'bonus_day', v_is_bonus,
        'bonus_cap_hit', false
      );
    end if;

    if v_today_tasks_xp + p_amount > v_cap then
      p_amount := v_cap - v_today_tasks_xp;
    end if;

    v_bonus_crossed_250 := v_is_bonus
      and v_today_tasks_xp < 250
      and (v_today_tasks_xp + p_amount) > 250;

    v_bonus_cap_hit := v_is_bonus
      and v_today_tasks_xp < 500
      and (v_today_tasks_xp + p_amount) >= 500;
  end if;

  update profiles
    set total_xp    = total_xp + p_amount,
        tasks_xp    = case when p_category = 'tasks'    then tasks_xp    + p_amount else tasks_xp    end,
        habits_xp   = case when p_category = 'habits'   then habits_xp   + p_amount else habits_xp   end,
        projects_xp = case when p_category = 'projects' then projects_xp + p_amount else projects_xp end
    where id = p_user_id
    returning total_xp, current_level into v_new_total, v_old_level;

  insert into xp_events (user_id, description, xp_amount, category, event_date)
    values (p_user_id, p_description, p_amount, p_category, p_event_date);

  v_new_level := 1;
  loop
    v_cumulative := v_cumulative + (v_i * 150);
    exit when v_cumulative > v_new_total;
    v_new_level := v_i;
    v_i := v_i + 1;
  end loop;

  if v_new_level > v_old_level then
    update profiles set current_level = v_new_level where id = p_user_id;
  end if;

  return jsonb_build_object(
    'awarded',   p_amount,
    'capped',    false,
    'new_total', v_new_total,
    'leveled_up', v_new_level > v_old_level,
    'new_level', v_new_level,
    'old_level', v_old_level,
    'bonus_day', v_is_bonus,
    'bonus_crossed_250', v_bonus_crossed_250,
    'bonus_cap_hit', v_bonus_cap_hit
  );
end; $$;

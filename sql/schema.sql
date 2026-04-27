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
-- ============================================================
-- match-day.sql — Match Day Vibe feature (V1)
-- Run via Supabase MCP apply_migration.
-- ============================================================

-- Extend xp_events category check to allow 'prediction' (cap-exempt like 'achievement')
alter table xp_events drop constraint if exists xp_events_category_check;
alter table xp_events add constraint xp_events_category_check
  check (category in ('tasks','habits','projects','bonus','system','spend','achievement','prediction','challenge'));

-- profiles: F1 team preference
alter table profiles add column if not exists f1_team text;

-- ============================================================
-- Tables
-- ============================================================
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  sport text not null check (sport in ('football', 'f1')),
  event_date date not null,
  kickoff_time time not null,
  home_status text check (home_status in ('home', 'away', 'neutral')),
  opponent text,
  competition text,
  custom_label text,
  gp_name text,
  settled boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists events_user_date on events (user_id, event_date);

create table if not exists event_predictions (
  event_id uuid primary key references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  pred_self_score int,
  pred_opponent_score int,
  pred_winner text check (pred_winner in ('self','draw','opponent')),
  pred_first_scorer_team text check (pred_first_scorer_team in ('self','opponent','none')),
  pred_first_scorer_name text,
  pred_p1 text,
  pred_p2 text,
  pred_p3 text,
  pred_fastest_lap text,
  pred_rain_pct int check (pred_rain_pct between 0 and 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_results (
  event_id uuid primary key references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  self_score int,
  opponent_score int,
  winner text check (winner in ('self','draw','opponent')),
  first_scorer_team text check (first_scorer_team in ('self','opponent','none')),
  first_scorer_name text,
  p1 text,
  p2 text,
  p3 text,
  fastest_lap text,
  rain_happened boolean,
  total_xp_awarded int not null default 0,
  perfect boolean not null default false,
  settled_at timestamptz default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table events enable row level security;
drop policy if exists "user_own_data" on events;
create policy "user_own_data" on events for all using (auth.uid() = user_id);

alter table event_predictions enable row level security;
drop policy if exists "user_own_data" on event_predictions;
create policy "user_own_data" on event_predictions for all using (auth.uid() = user_id);

alter table event_results enable row level security;
drop policy if exists "user_own_data" on event_results;
create policy "user_own_data" on event_results for all using (auth.uid() = user_id);

-- ============================================================
-- Helper: Maputo local date (used by settle_event to stamp xp_events)
-- ============================================================
create or replace function _maputo_today() returns date language sql stable as $$
  select (now() at time zone 'Africa/Maputo')::date;
$$;

-- ============================================================
-- RPC: set_f1_team
-- Validates + updates profiles.f1_team. Accepts null to clear.
-- ============================================================
create or replace function set_f1_team(p_user_id uuid, p_team text)
returns void language plpgsql security definer as $$
begin
  if p_team is not null and p_team not in (
    'ferrari','mercedes','mclaren','redbull','aston_martin',
    'alpine','williams','rb','haas','kick_sauber'
  ) then
    raise exception 'invalid f1 team %', p_team;
  end if;
  update profiles set f1_team = p_team where id = p_user_id;
end; $$;

-- ============================================================
-- RPC: settle_event
-- Compares predictions vs actual results, awards XP atomically,
-- inserts event_results row, marks event settled, returns summary.
-- ============================================================
create or replace function settle_event(p_event_id uuid, p_result jsonb)
returns jsonb language plpgsql security definer as $$
declare
  v_event events%rowtype;
  v_pred  event_predictions%rowtype;
  v_xp int := 0;
  v_perfect boolean := false;
  v_per_field jsonb := '{}'::jsonb;
  v_award_res jsonb;
  v_user_id uuid;
begin
  select * into v_event from events where id = p_event_id;
  if not found then raise exception 'event not found'; end if;
  if v_event.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_event.settled then raise exception 'event already settled'; end if;
  v_user_id := v_event.user_id;

  select * into v_pred from event_predictions where event_id = p_event_id;
  if not found then raise exception 'no predictions found — cannot settle'; end if;

  if v_event.sport = 'football' then
    -- Score exact: +50
    if (p_result->>'self_score')::int = v_pred.pred_self_score
       and (p_result->>'opponent_score')::int = v_pred.pred_opponent_score then
      v_xp := v_xp + 50;
      v_per_field := v_per_field || '{"score":50}'::jsonb;
    else
      v_per_field := v_per_field || '{"score":0}'::jsonb;
    end if;

    -- Winner: +20
    if (p_result->>'winner') = v_pred.pred_winner then
      v_xp := v_xp + 20;
      v_per_field := v_per_field || '{"winner":20}'::jsonb;
    else
      v_per_field := v_per_field || '{"winner":0}'::jsonb;
    end if;

    -- First scorer team: +15
    if (p_result->>'first_scorer_team') = v_pred.pred_first_scorer_team then
      v_xp := v_xp + 15;
      v_per_field := v_per_field || '{"first_scorer_team":15}'::jsonb;
    else
      v_per_field := v_per_field || '{"first_scorer_team":0}'::jsonb;
    end if;

    -- First scorer name (requires team match): +30
    if (p_result->>'first_scorer_team') = v_pred.pred_first_scorer_team
       and trim(lower(coalesce(p_result->>'first_scorer_name',''))) =
           trim(lower(coalesce(v_pred.pred_first_scorer_name,''))) then
      v_xp := v_xp + 30;
      v_per_field := v_per_field || '{"first_scorer_name":30}'::jsonb;
    else
      v_per_field := v_per_field || '{"first_scorer_name":0}'::jsonb;
    end if;

    v_perfect := (v_per_field->>'score')::int = 50
             and (v_per_field->>'winner')::int = 20
             and (v_per_field->>'first_scorer_team')::int = 15
             and (v_per_field->>'first_scorer_name')::int = 30;

    insert into event_results (
      event_id, user_id, self_score, opponent_score, winner,
      first_scorer_team, first_scorer_name, total_xp_awarded, perfect
    ) values (
      p_event_id, v_user_id,
      (p_result->>'self_score')::int, (p_result->>'opponent_score')::int,
      p_result->>'winner', p_result->>'first_scorer_team',
      p_result->>'first_scorer_name', v_xp, v_perfect
    );

  elsif v_event.sport = 'f1' then
    if trim(lower(coalesce(p_result->>'p1',''))) = trim(lower(coalesce(v_pred.pred_p1,''))) then
      v_xp := v_xp + 20; v_per_field := v_per_field || '{"p1":20}'::jsonb;
    else v_per_field := v_per_field || '{"p1":0}'::jsonb; end if;

    if trim(lower(coalesce(p_result->>'p2',''))) = trim(lower(coalesce(v_pred.pred_p2,''))) then
      v_xp := v_xp + 20; v_per_field := v_per_field || '{"p2":20}'::jsonb;
    else v_per_field := v_per_field || '{"p2":0}'::jsonb; end if;

    if trim(lower(coalesce(p_result->>'p3',''))) = trim(lower(coalesce(v_pred.pred_p3,''))) then
      v_xp := v_xp + 20; v_per_field := v_per_field || '{"p3":20}'::jsonb;
    else v_per_field := v_per_field || '{"p3":0}'::jsonb; end if;

    if trim(lower(coalesce(p_result->>'fastest_lap',''))) =
       trim(lower(coalesce(v_pred.pred_fastest_lap,''))) then
      v_xp := v_xp + 25; v_per_field := v_per_field || '{"fastest_lap":25}'::jsonb;
    else v_per_field := v_per_field || '{"fastest_lap":0}'::jsonb; end if;

    -- Perfect podium bonus: +30 on top
    if (v_per_field->>'p1')::int = 20
       and (v_per_field->>'p2')::int = 20
       and (v_per_field->>'p3')::int = 20 then
      v_xp := v_xp + 30;
      v_per_field := v_per_field || '{"perfect_podium":30}'::jsonb;
    else
      v_per_field := v_per_field || '{"perfect_podium":0}'::jsonb;
    end if;

    v_perfect := (v_per_field->>'p1')::int = 20
             and (v_per_field->>'p2')::int = 20
             and (v_per_field->>'p3')::int = 20
             and (v_per_field->>'fastest_lap')::int = 25;

    insert into event_results (
      event_id, user_id, p1, p2, p3, fastest_lap, rain_happened,
      total_xp_awarded, perfect
    ) values (
      p_event_id, v_user_id,
      p_result->>'p1', p_result->>'p2', p_result->>'p3',
      p_result->>'fastest_lap',
      case when p_result ? 'rain_happened' then (p_result->>'rain_happened')::boolean else null end,
      v_xp, v_perfect
    );
  end if;

  update events set settled = true where id = p_event_id;

  if v_xp > 0 then
    select award_xp(
      v_user_id, v_xp, 'prediction',
      case when v_event.sport = 'football'
           then 'Match prediction: ' || coalesce(v_event.opponent,'')
           else 'F1 prediction: ' || coalesce(v_event.gp_name,'') end,
      _maputo_today()
    ) into v_award_res;
  end if;

  return jsonb_build_object(
    'awarded_xp', v_xp,
    'perfect', v_perfect,
    'per_field', v_per_field,
    'award_result', v_award_res
  );
end; $$;

-- ============================================================
-- Achievements seed for prediction mechanic
-- ============================================================
insert into achievements (id, name, description, category, rarity, xp_reward, is_title, hidden, icon)
values
  ('pred-first',          'First Prediction', 'Create your first match event.',                 'rare', 'common',    25, false, false, 'flag'),
  ('pred-clasico',        'Clásico Called',   'Nail every field of a Clásico prediction.',      'rare', 'rare',     100, false, false, 'trophy'),
  ('pred-perfect-podium', 'Perfect Podium',   'Predict an F1 podium top-3 in exact order.',     'rare', 'rare',     100, false, false, 'award'),
  ('pred-oracle',         'The Oracle',       'Nail 10 perfect predictions.',                   'rare', 'legendary',500, false, false, 'sparkles'),
  ('beta-player',         'Beta Player',      'Founding member of ProgressOS — one of the first 10.', 'rare', 'legendary', 250, true, false, 'rocket')
on conflict (id) do nothing;

-- ProgressOS — Daily Challenges
-- Run via Supabase MCP apply_migration. Idempotent.

-- 1. Table
create table if not exists daily_challenges (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  challenge_date date not null,
  tier           text not null check (tier in ('easy','hard','legendary')),
  category       text not null check (category in ('tasks','habits','projects','combo')),
  description    text not null,
  target_value   integer not null default 1,
  completed      boolean not null default false,
  completed_at   timestamptz,
  xp_awarded     integer not null default 0,
  created_at     timestamptz default now(),
  unique (user_id, challenge_date, tier)
);
create index if not exists daily_challenges_user_date
  on daily_challenges(user_id, challenge_date);

-- 2. RLS
alter table daily_challenges enable row level security;
drop policy if exists "user_own_data" on daily_challenges;
create policy "user_own_data" on daily_challenges for all using (auth.uid() = user_id);

-- 3. Profile columns
alter table profiles
  add column if not exists challenge_streak integer not null default 0,
  add column if not exists challenge_streak_last_date date,
  add column if not exists challenge_total_completed integer not null default 0,
  add column if not exists last_seen_date date;

-- 4. generate_daily_challenges RPC
create or replace function generate_daily_challenges(
  p_user_id         uuid,
  p_date            date,
  p_has_event_today boolean default false
) returns void language plpgsql security definer as $$
declare
  v_tasks_pending int;
  v_habits_today  int;
  v_projects_open int;
  v_dow           int := extract(dow from p_date);
begin
  if exists (
    select 1 from daily_challenges
    where user_id = p_user_id and challenge_date = p_date limit 1
  ) then return; end if;

  select count(*) into v_tasks_pending
    from tasks where user_id = p_user_id and completed = false
      and (due_date <= p_date or due_date is null);

  select count(*) into v_habits_today
    from habits where user_id = p_user_id and v_dow = any(active_days);

  select count(*) into v_projects_open
    from projects where user_id = p_user_id and status = 'active';

  -- EASY
  if v_tasks_pending >= 1 then
    insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
    values (p_user_id, p_date, 'easy', 'tasks', 'Complete 1 task today.', 1) on conflict do nothing;
  elsif v_habits_today >= 1 then
    insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
    values (p_user_id, p_date, 'easy', 'habits', 'Complete 1 habit today.', 1) on conflict do nothing;
  elsif v_projects_open >= 1 then
    insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
    values (p_user_id, p_date, 'easy', 'projects', 'Log a session on any project (min 10 min).', 10) on conflict do nothing;
  else
    insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
    values (p_user_id, p_date, 'easy', 'tasks', 'Add a new task or habit today.', 1) on conflict do nothing;
  end if;

  -- HARD
  if v_tasks_pending >= 3 then
    insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
    values (p_user_id, p_date, 'hard', 'tasks', 'Complete 3 tasks today.', 3) on conflict do nothing;
  elsif v_habits_today >= 1 and v_tasks_pending < 3 then
    insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
    values (p_user_id, p_date, 'hard', 'habits', 'Complete all habits scheduled for today.', v_habits_today) on conflict do nothing;
  elsif v_projects_open >= 1 then
    insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
    values (p_user_id, p_date, 'hard', 'projects', 'Log 45+ minutes on a single project today.', 45) on conflict do nothing;
  else
    insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
    values (p_user_id, p_date, 'hard', 'combo', 'Complete 2 tasks today.', 2) on conflict do nothing;
  end if;

  -- LEGENDARY (skip on match day)
  if not p_has_event_today then
    if v_tasks_pending >= 3 and v_habits_today >= 1 and v_projects_open >= 1 then
      insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
      values (p_user_id, p_date, 'legendary', 'combo', 'Complete 3 tasks + all habits + 30 min on a project.', 3) on conflict do nothing;
    elsif v_tasks_pending >= 5 then
      insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
      values (p_user_id, p_date, 'legendary', 'tasks', 'Complete 5 tasks today.', 5) on conflict do nothing;
    elsif v_habits_today >= 2 then
      insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
      values (p_user_id, p_date, 'legendary', 'habits', 'Complete all habits + hit a new streak best on any habit.', v_habits_today) on conflict do nothing;
    elsif v_projects_open >= 1 then
      insert into daily_challenges (user_id, challenge_date, tier, category, description, target_value)
      values (p_user_id, p_date, 'legendary', 'projects', 'Log 1h+ on a project AND complete a milestone.', 60) on conflict do nothing;
    end if;
  end if;
end; $$;

-- 5. complete_challenge RPC
create or replace function complete_challenge(
  p_user_id        uuid,
  p_challenge_id   uuid,
  p_date           date,
  p_comeback_bonus boolean default false
) returns jsonb language plpgsql security definer as $$
declare
  v_tier      text;
  v_base_xp   int;
  v_final_xp  int;
  v_desc      text;
  v_already   boolean;
  v_last_date date;
  v_streak    int;
  v_total     int;
  v_multiplier numeric := 1;
begin
  select completed, tier, description
    into v_already, v_tier, v_desc
    from daily_challenges
    where id = p_challenge_id and user_id = p_user_id;

  if v_already then
    return jsonb_build_object('already_completed', true);
  end if;

  v_base_xp := case v_tier
    when 'easy'      then 50
    when 'hard'      then 150
    when 'legendary' then 300
    else 50
  end;

  if p_comeback_bonus then v_multiplier := 2; end if;
  v_final_xp := (v_base_xp * v_multiplier)::int;

  update daily_challenges
    set completed = true, completed_at = now(), xp_awarded = v_final_xp
    where id = p_challenge_id;

  select challenge_streak, challenge_streak_last_date, challenge_total_completed
    into v_streak, v_last_date, v_total
    from profiles where id = p_user_id;

  if v_last_date = p_date - 1 then
    v_streak := v_streak + 1;
  elsif v_last_date = p_date then
    null;
  else
    v_streak := 1;
  end if;

  update profiles
    set challenge_streak           = v_streak,
        challenge_streak_last_date = p_date,
        challenge_total_completed  = challenge_total_completed + 1
    where id = p_user_id;

  perform award_xp(p_user_id, v_final_xp, 'challenge',
    'Challenge (' || v_tier || '): ' || v_desc);

  return jsonb_build_object(
    'awarded', v_final_xp,
    'streak',  v_streak,
    'total',   v_total + 1,
    'comeback_bonus', p_comeback_bonus
  );
end; $$;

-- 6. get_today_challenges RPC
create or replace function get_today_challenges(
  p_user_id uuid,
  p_date    date
) returns jsonb language plpgsql security definer as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb) into v_rows
    from daily_challenges c
    where user_id = p_user_id and challenge_date = p_date;
  return v_rows;
end; $$;

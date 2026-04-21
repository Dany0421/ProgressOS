-- ProgressOS — Migrations & New Functions
-- Run in Supabase → SQL Editor → New Query → Run
-- Run AFTER the original schema.sql

-- ============================================================
-- 1. Add 'spend' to xp_events.category
-- ============================================================
alter table xp_events drop constraint if exists xp_events_category_check;
alter table xp_events add constraint xp_events_category_check
  check (category in ('tasks', 'habits', 'projects', 'bonus', 'system', 'spend'));

-- ============================================================
-- 2. Add recurrence column to tasks
-- ============================================================
alter table tasks add column if not exists recurrence text
  check (recurrence in ('none', 'daily', 'weekly')) default 'none';

-- ============================================================
-- 3. consume_freeze — atomic freeze consumption
--    Locks profile row, checks availability, updates habit + logs.
--    p_prev_date: the last scheduled day to credit (not necessarily yesterday)
-- ============================================================
create or replace function consume_freeze(
  p_user_id   uuid,
  p_habit_id  uuid,
  p_prev_date date,
  p_event_date date
) returns jsonb language plpgsql security definer as $$
declare
  v_freezes int;
  v_streak  int;
  v_title   text;
begin
  select freezes_available into v_freezes
    from profiles
    where id = p_user_id
    for update;

  if v_freezes is null or v_freezes <= 0 then
    return jsonb_build_object('consumed', false);
  end if;

  select current_streak, title into v_streak, v_title
    from habits where id = p_habit_id;

  update profiles
    set freezes_available = freezes_available - 1
    where id = p_user_id;

  update habits
    set last_completed_date = p_prev_date
    where id = p_habit_id;

  insert into habit_logs
    (habit_id, user_id, completed_date, xp_awarded, streak_at_completion, was_freeze_save)
    values (p_habit_id, p_user_id, p_prev_date, 0, v_streak, true)
    on conflict (habit_id, completed_date) do nothing;

  insert into xp_events (user_id, description, xp_amount, category, event_date)
    values (p_user_id, 'Freeze consumed — streak saved for ' || v_title, 0, 'system', p_event_date);

  return jsonb_build_object('consumed', true, 'freezes_remaining', v_freezes - 1);
end; $$;

-- ============================================================
-- 4. purchase_freeze — atomic freeze purchase
--    Locks profile row, validates XP and cap, deducts + increments.
-- ============================================================
create or replace function purchase_freeze(
  p_user_id    uuid,
  p_event_date date
) returns jsonb language plpgsql security definer as $$
declare
  v_xp      int;
  v_freezes int;
begin
  select total_xp, freezes_available into v_xp, v_freezes
    from profiles
    where id = p_user_id
    for update;

  if v_xp < 150 then
    return jsonb_build_object('success', false, 'reason', 'insufficient_xp');
  end if;

  if v_freezes >= 3 then
    return jsonb_build_object('success', false, 'reason', 'max_freezes_reached');
  end if;

  update profiles
    set total_xp = total_xp - 150,
        freezes_available = freezes_available + 1
    where id = p_user_id;

  insert into xp_events (user_id, description, xp_amount, category, event_date)
    values (p_user_id, 'Freeze purchased', -150, 'spend', p_event_date);

  return jsonb_build_object(
    'success', true,
    'new_balance', v_xp - 150,
    'freezes_available', v_freezes + 1
  );
end; $$;

-- ============================================================
-- 5. award_xp — now with Bonus Day mechanic
--    ~14% chance per user per day (deterministic hash) the task cap
--    becomes 500 instead of 250. User only discovers it when crossing 250.
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

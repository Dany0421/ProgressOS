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

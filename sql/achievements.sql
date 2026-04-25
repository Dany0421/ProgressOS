-- ProgressOS — Achievements System
-- Phase 1: tables, ALTERs, RLS, seed (30 achievements), helper RPCs
-- Apply via Supabase MCP apply_migration. Idempotent.

-- ============================================================
-- 1. xp_events.category — add 'achievement'
-- ============================================================
alter table xp_events drop constraint if exists xp_events_category_check;
alter table xp_events add constraint xp_events_category_check
  check (category in ('tasks','habits','projects','bonus','system','spend','achievement'));

-- ============================================================
-- 2. achievements catalogue (public read, writes only via service role)
-- ============================================================
create table if not exists achievements (
  id text primary key,
  name text not null,
  description text not null,
  category text not null check (category in ('xp','streak','volume','rare','trinity','archetype','title')),
  rarity text not null check (rarity in ('common','rare','legendary')),
  xp_reward int not null default 0,
  is_title boolean not null default false,
  hidden boolean not null default false,
  icon text
);

-- ============================================================
-- 3. user_achievements
-- ============================================================
create table if not exists user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  seen boolean not null default false,
  primary key (user_id, achievement_id)
);
create index if not exists user_achievements_user on user_achievements(user_id);

-- ============================================================
-- 4. profiles — active_title + pending_achievement_celebration
-- ============================================================
alter table profiles
  add column if not exists active_title text references achievements(id) on delete set null,
  add column if not exists pending_achievement_celebration text references achievements(id) on delete set null;

-- ============================================================
-- 5. RLS
-- ============================================================
alter table achievements enable row level security;
drop policy if exists "achievements_public_read" on achievements;
create policy "achievements_public_read" on achievements for select using (true);

alter table user_achievements enable row level security;
drop policy if exists "user_own_data" on user_achievements;
create policy "user_own_data" on user_achievements for all using (auth.uid() = user_id);

-- ============================================================
-- 6. Seed — 30 achievements (upsert to stay idempotent)
-- ============================================================
insert into achievements (id, name, description, category, rarity, xp_reward, is_title, hidden, icon) values
-- XP / Level (7)
('level-5',   'The Apprentice', 'Reach level 5.',                                  'xp',      'common',    25,  false, false, 'star'),
('level-10',  'The Committed',  'Reach level 10.',                                 'xp',      'common',    25,  false, false, 'stars'),
('level-25',  'The Veteran',    'Reach level 25.',                                 'xp',      'rare',      100, false, false, 'crown'),
('xp-10k',    '10K Club',       'Earn 10,000 total XP.',                           'xp',      'common',    25,  false, false, 'trending-up'),
('xp-25k',    '25K Club',       'Earn 25,000 total XP.',                           'xp',      'rare',      100, false, false, 'flame'),
('xp-50k',    '50K Club',       'Earn 50,000 total XP.',                           'xp',      'rare',      100, false, false, 'zap'),
('xp-100k',   '100K Legend',    'Earn 100,000 total XP.',                          'xp',      'legendary', 500, false, false, 'award'),

-- Streak (5)
('streak-7',     'Week Locked In',   'Hit a 7-day streak on any habit.',           'streak',  'common',    25,  false, false, 'flame'),
('streak-30',    'Month Dominated',  'Hit a 30-day streak on any habit.',          'streak',  'rare',      100, false, false, 'flame'),
('streak-100',   'Century Club',     'Hit a 100-day streak on any habit.',         'streak',  'legendary', 500, false, false, 'flame'),
('streak-365',   'The Untouchable',  'Hit a 365-day streak on any habit.',         'streak',  'legendary', 500, false, false, 'shield'),
('multi-streak', 'Juggler',          'Keep 5 habits at 7+ day streaks simultaneously.', 'streak', 'rare',   100, false, false, 'layers'),

-- Volume (7)
('tasks-100',    'Producer',      'Complete 100 tasks.',                            'volume',  'common',    25,  false, false, 'check-check'),
('tasks-500',    'Machine',       'Complete 500 tasks.',                            'volume',  'rare',      100, false, false, 'list-checks'),
('tasks-1000',   'Unstoppable',   'Complete 1,000 tasks.',                          'volume',  'legendary', 500, false, false, 'rocket'),
('projects-10',  'Finisher',      'Complete 10 projects.',                          'volume',  'rare',      100, false, false, 'folder-check'),
('projects-50',  'Shipper',       'Complete 50 projects.',                          'volume',  'legendary', 500, false, false, 'ship'),
('sessions-50',  'Timer Lover',   'Log 50 project sessions.',                       'volume',  'common',    25,  false, false, 'timer'),
('sessions-500', 'Deep Worker',   'Log 500 project sessions.',                      'volume',  'legendary', 500, false, false, 'clock'),

-- Rare / Discovery (4)
('first-bonus',  'Lucky Bastard', 'Discover your first Bonus Day.',                 'rare',    'rare',      100, false, false, 'dice-6'),
('cap-breaker',  'Cap Breaker',   'Hit the 500 XP cap on a Bonus Day.',             'rare',    'legendary', 500, true,  false, 'zap'),
('freeze-saved', 'Saved By Ice',  'Have a freeze save one of your streaks.',        'rare',    'common',    25,  false, false, 'snowflake'),
('ghost-year',   'Ghost',         'Keep any streak alive for 365 days.',            'rare',    'legendary', 500, false, false, 'ghost'),

-- Trinity (4) — signature
('trinity-day',     'Full Stack Day',  'Task + habit + session (5+ min) in one day.', 'trinity', 'common',    25,  false, false, 'layers'),
('trinity-week',    'Triathlon Week',  '7 Full Stack Days in a row.',                  'trinity', 'rare',      100, false, false, 'sparkles'),
('trinity-30',      'Holy Grail',      '30 total Full Stack Days.',                    'trinity', 'legendary', 500, false, false, 'gem'),
('trinity-perfect', 'Trinity Perfect', 'One day: every task + habit done (3+ each) + a project session.', 'trinity', 'legendary', 500, false, false, 'crown'),

-- Archetypes (8, hidden, all titles)
('arch-night-owl',  'Night Owl',   'Complete 10 tasks between midnight and 5 AM.',    'archetype', 'rare',    100, true, true, 'moon'),
('arch-early-bird', 'Early Bird',  'Complete 10 tasks between 5 AM and 7:30 AM.',     'archetype', 'rare',    100, true, true, 'sunrise'),
('arch-marathoner', 'Marathoner',  'One project session longer than 4 hours.',        'archetype', 'rare',    100, true, true, 'infinity'),
('arch-sprinter',   'Sprinter',    '3+ tasks completed inside a 10-minute window.',   'archetype', 'common',  25,  true, true, 'zap'),
('arch-phoenix',    'Phoenix',     'Break a streak, then beat the old best on that habit.', 'archetype', 'rare', 100, true, true, 'flame'),
('arch-lost-art',   'Lost Art',    'Revive a habit after 14+ dormant days.',          'archetype', 'common',  25,  true, true, 'scroll'),
('arch-obsessed',   'Obsessed',    '6+ hours on one project in one day (2+ sessions).', 'archetype', 'rare',  100, true, true, 'focus'),
('arch-architect',  'Architect',   '5 project milestones done inside one week.',      'archetype', 'rare',    100, true, true, 'compass'),

-- Titles-only (1)
('title-initiate',  'The Initiate', 'You started. That already puts you ahead.',      'title',     'common',  0,   true, false, 'seedling')
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  category    = excluded.category,
  rarity      = excluded.rarity,
  xp_reward   = excluded.xp_reward,
  is_title    = excluded.is_title,
  hidden      = excluded.hidden,
  icon        = excluded.icon;

-- ============================================================
-- 7. set_active_title — guarded RPC
-- ============================================================
create or replace function set_active_title(
  p_user_id  uuid,
  p_title_id text
) returns void language plpgsql security definer as $$
declare
  v_is_title boolean;
  v_has_it   boolean;
begin
  if p_title_id is null then
    update profiles set active_title = null where id = p_user_id;
    return;
  end if;

  select is_title into v_is_title from achievements where id = p_title_id;
  if not coalesce(v_is_title, false) then
    raise exception 'achievement % is not a title', p_title_id;
  end if;

  select exists (
    select 1 from user_achievements
      where user_id = p_user_id and achievement_id = p_title_id
  ) into v_has_it;
  if not v_has_it then
    raise exception 'title % not unlocked by user', p_title_id;
  end if;

  update profiles set active_title = p_title_id where id = p_user_id;
end; $$;

-- ============================================================
-- 8. mark_achievements_seen — bulk clear NEW dots
--    Pass null to mark all unseen as seen.
-- ============================================================
create or replace function mark_achievements_seen(
  p_user_id uuid,
  p_ids     text[]
) returns void language plpgsql security definer as $$
begin
  if p_ids is null then
    update user_achievements
      set seen = true
      where user_id = p_user_id and seen = false;
  else
    update user_achievements
      set seen = true
      where user_id = p_user_id and achievement_id = any(p_ids);
  end if;
end; $$;

-- ============================================================
-- 9. backfill_achievements — one-shot retroactive unlock
--    Silent inserts, single aggregate xp_event, sets
--    pending_achievement_celebration to rarest new unlock.
-- ============================================================
create or replace function backfill_achievements(p_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_profile profiles%rowtype;
  v_candidates text[] := ARRAY[]::text[];
  v_newly_unlocked text[];
  v_total_xp int := 0;
  v_rarest text;
  v_today date := (now() at time zone 'Africa/Maputo')::date;
  v_max_habit_streak int;
  v_multi_7_count int;
  v_tasks_done int;
  v_projects_done int;
  v_sessions_count int;
  v_trinity_count int;
  v_trinity_consec_max int;
  v_perfect_day_exists boolean;
  v_night_owl int;
  v_early_bird int;
  v_marathon boolean;
  v_sprinter boolean;
  v_lost_art boolean;
  v_obsessed boolean;
  v_architect boolean;
  v_cumulative int := 0;
  v_i int := 2;
  v_new_level int := 1;
  v_new_total int;
begin
  select * into v_profile from profiles where id = p_user_id;
  if not found then
    return jsonb_build_object('error','profile not found');
  end if;

  v_candidates := array_append(v_candidates, 'title-initiate');

  if v_profile.current_level >= 5  then v_candidates := array_append(v_candidates, 'level-5');  end if;
  if v_profile.current_level >= 10 then v_candidates := array_append(v_candidates, 'level-10'); end if;
  if v_profile.current_level >= 25 then v_candidates := array_append(v_candidates, 'level-25'); end if;
  if v_profile.total_xp >= 10000   then v_candidates := array_append(v_candidates, 'xp-10k');   end if;
  if v_profile.total_xp >= 25000   then v_candidates := array_append(v_candidates, 'xp-25k');   end if;
  if v_profile.total_xp >= 50000   then v_candidates := array_append(v_candidates, 'xp-50k');   end if;
  if v_profile.total_xp >= 100000  then v_candidates := array_append(v_candidates, 'xp-100k');  end if;

  select coalesce(max(longest_streak),0) into v_max_habit_streak
    from habits where user_id = p_user_id;
  if v_max_habit_streak >= 7   then v_candidates := array_append(v_candidates, 'streak-7');   end if;
  if v_max_habit_streak >= 30  then v_candidates := array_append(v_candidates, 'streak-30');  end if;
  if v_max_habit_streak >= 100 then v_candidates := array_append(v_candidates, 'streak-100'); end if;
  if v_max_habit_streak >= 365 then
    v_candidates := array_append(v_candidates, 'streak-365');
    v_candidates := array_append(v_candidates, 'ghost-year');
  end if;

  select count(*) into v_multi_7_count
    from habits where user_id = p_user_id and current_streak >= 7;
  if v_multi_7_count >= 5 then v_candidates := array_append(v_candidates, 'multi-streak'); end if;

  select count(*) into v_tasks_done
    from tasks where user_id = p_user_id and completed = true;
  if v_tasks_done >= 100  then v_candidates := array_append(v_candidates, 'tasks-100');  end if;
  if v_tasks_done >= 500  then v_candidates := array_append(v_candidates, 'tasks-500');  end if;
  if v_tasks_done >= 1000 then v_candidates := array_append(v_candidates, 'tasks-1000'); end if;

  select count(*) into v_projects_done
    from projects where user_id = p_user_id and status = 'completed';
  if v_projects_done >= 10 then v_candidates := array_append(v_candidates, 'projects-10'); end if;
  if v_projects_done >= 50 then v_candidates := array_append(v_candidates, 'projects-50'); end if;

  select count(*) into v_sessions_count
    from project_sessions where user_id = p_user_id and ended_at is not null;
  if v_sessions_count >= 50  then v_candidates := array_append(v_candidates, 'sessions-50');  end if;
  if v_sessions_count >= 500 then v_candidates := array_append(v_candidates, 'sessions-500'); end if;

  if exists (select 1 from (
      select event_date, sum(xp_amount) s from xp_events
      where user_id = p_user_id and category='tasks' group by event_date
    ) d where d.s > 250) then
    v_candidates := array_append(v_candidates, 'first-bonus');
  end if;

  if exists (select 1 from (
      select event_date, sum(xp_amount) s from xp_events
      where user_id = p_user_id and category='tasks' group by event_date
    ) d where d.s >= 500) then
    v_candidates := array_append(v_candidates, 'cap-breaker');
  end if;

  if exists (select 1 from habit_logs where user_id = p_user_id and was_freeze_save = true) then
    v_candidates := array_append(v_candidates, 'freeze-saved');
  end if;

  with session_dates as (
    select distinct (started_at at time zone 'Africa/Maputo')::date as d
      from project_sessions where user_id = p_user_id and duration_minutes >= 5
  ),
  task_dates as (
    select distinct event_date as d from xp_events where user_id = p_user_id and category='tasks'
  ),
  habit_dates as (
    select distinct event_date as d from xp_events where user_id = p_user_id and category='habits'
  ),
  trinity as (
    select t.d from task_dates t join habit_dates h using(d) join session_dates s using(d)
  ),
  ord as (select d, row_number() over (order by d) rn from trinity),
  grp as (select (d - (rn::text || ' days')::interval) as g, count(*) run_len from ord group by g)
  select (select count(*) from trinity),
         coalesce((select max(run_len) from grp), 0)
  into v_trinity_count, v_trinity_consec_max;

  if v_trinity_count >= 1      then v_candidates := array_append(v_candidates, 'trinity-day');  end if;
  if v_trinity_consec_max >= 7 then v_candidates := array_append(v_candidates, 'trinity-week'); end if;
  if v_trinity_count >= 30     then v_candidates := array_append(v_candidates, 'trinity-30');   end if;

  select exists (
    with day_task_counts as (
      select event_date as d, count(*) c from xp_events
        where user_id = p_user_id and category='tasks' group by event_date
    ),
    day_habit_counts as (
      select event_date as d, count(*) c from xp_events
        where user_id = p_user_id and category='habits' group by event_date
    ),
    day_sessions as (
      select distinct (started_at at time zone 'Africa/Maputo')::date as d
        from project_sessions where user_id = p_user_id and duration_minutes >= 5
    ),
    candidate_days as (
      select dt.d from day_task_counts dt
        join day_habit_counts dh using(d) join day_sessions ds using(d)
        where dt.c >= 3 and dh.c >= 3
    )
    select 1 from candidate_days cd
      where not exists (
        select 1 from tasks t
          where t.user_id = p_user_id and t.due_date = cd.d and t.completed = false
      )
  ) into v_perfect_day_exists;
  if v_perfect_day_exists then v_candidates := array_append(v_candidates, 'trinity-perfect'); end if;

  select count(*) into v_night_owl from tasks
    where user_id = p_user_id and completed = true and completed_at is not null
      and extract(hour from (completed_at at time zone 'Africa/Maputo')) < 5;
  if v_night_owl >= 10 then v_candidates := array_append(v_candidates, 'arch-night-owl'); end if;

  select count(*) into v_early_bird from tasks
    where user_id = p_user_id and completed = true and completed_at is not null
      and (completed_at at time zone 'Africa/Maputo')::time >= '05:00'::time
      and (completed_at at time zone 'Africa/Maputo')::time <  '07:30'::time;
  if v_early_bird >= 10 then v_candidates := array_append(v_candidates, 'arch-early-bird'); end if;

  select exists (select 1 from project_sessions where user_id = p_user_id and duration_minutes >= 240)
    into v_marathon;
  if v_marathon then v_candidates := array_append(v_candidates, 'arch-marathoner'); end if;

  select exists (
    select 1 from (
      select completed_at, lag(completed_at, 2) over (order by completed_at) as two_prior
      from tasks where user_id = p_user_id and completed = true and completed_at is not null
    ) c where two_prior is not null and completed_at - two_prior <= interval '10 minutes'
  ) into v_sprinter;
  if v_sprinter then v_candidates := array_append(v_candidates, 'arch-sprinter'); end if;

  select exists (
    select 1 from (
      select habit_id, completed_date,
        lag(completed_date) over (partition by habit_id order by completed_date) as prev
      from habit_logs where user_id = p_user_id and was_freeze_save = false
    ) l where prev is not null and completed_date - prev > 14
  ) into v_lost_art;
  if v_lost_art then v_candidates := array_append(v_candidates, 'arch-lost-art'); end if;

  select exists (
    select 1 from (
      select project_id, (started_at at time zone 'Africa/Maputo')::date as d,
             count(*) cnt, sum(duration_minutes) mins
      from project_sessions where user_id = p_user_id and duration_minutes is not null
      group by project_id, d
    ) s where s.cnt >= 2 and s.mins >= 360
  ) into v_obsessed;
  if v_obsessed then v_candidates := array_append(v_candidates, 'arch-obsessed'); end if;

  select exists (
    select 1 from milestones m1
      where m1.user_id = p_user_id and m1.completed = true and m1.completed_at is not null
        and (select count(*) from milestones m2
             where m2.user_id = p_user_id and m2.completed = true and m2.completed_at is not null
               and m2.completed_at between m1.completed_at - interval '7 days' and m1.completed_at
            ) >= 5
  ) into v_architect;
  if v_architect then v_candidates := array_append(v_candidates, 'arch-architect'); end if;

  -- note: arch-phoenix is live-only (needs per-habit segment comparison)

  with ins as (
    insert into user_achievements (user_id, achievement_id, seen)
      select p_user_id, unnest(v_candidates), true
      on conflict do nothing
      returning achievement_id
  )
  select coalesce(array_agg(achievement_id), ARRAY[]::text[]) into v_newly_unlocked from ins;

  if v_newly_unlocked is null or array_length(v_newly_unlocked, 1) is null then
    update profiles set active_title = 'title-initiate'
      where id = p_user_id and active_title is null
        and exists (select 1 from user_achievements
                    where user_id = p_user_id and achievement_id = 'title-initiate');
    return jsonb_build_object('unlocked_ids', '[]'::jsonb, 'total_xp_awarded', 0, 'rarest', null);
  end if;

  select coalesce(sum(xp_reward), 0) into v_total_xp
    from achievements where id = any(v_newly_unlocked);

  select id into v_rarest from achievements
    where id = any(v_newly_unlocked)
    order by case rarity when 'legendary' then 0 when 'rare' then 1 else 2 end,
             xp_reward desc, id
    limit 1;

  if v_total_xp > 0 then
    update profiles set total_xp = total_xp + v_total_xp
      where id = p_user_id
      returning total_xp into v_new_total;

    v_new_level := 1; v_cumulative := 0; v_i := 2;
    loop
      v_cumulative := v_cumulative + (v_i * 150);
      exit when v_cumulative > v_new_total;
      v_new_level := v_i; v_i := v_i + 1;
    end loop;

    if v_new_level > v_profile.current_level then
      update profiles set current_level = v_new_level where id = p_user_id;
    end if;

    insert into xp_events (user_id, description, xp_amount, category, event_date) values (
      p_user_id,
      'Achievements retroactively unlocked (x' || array_length(v_newly_unlocked, 1) || ')',
      v_total_xp, 'achievement', v_today
    );
  end if;

  update profiles
    set pending_achievement_celebration = v_rarest,
        active_title = coalesce(active_title, 'title-initiate')
    where id = p_user_id;

  return jsonb_build_object(
    'unlocked_ids', to_jsonb(v_newly_unlocked),
    'total_xp_awarded', v_total_xp,
    'rarest', v_rarest
  );
end; $$;

-- ============================================================
-- 10. check_achievements — live dispatcher
--    Returns jsonb {unlocked: [{id,name,description,rarity,
--    category,xp_reward,is_title,icon}, ...]}
--    Inserts with seen=false so gallery shows NEW dot.
--    JS handles XP awards via award_xp('achievement', ...) per unlock.
-- ============================================================
create or replace function check_achievements(p_user_id uuid, p_trigger jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer as $$
declare
  v_type text;
  v_meta jsonb;
  v_candidates text[] := ARRAY[]::text[];
  v_newly text[];
  v_result jsonb;
  v_profile profiles%rowtype;
  v_max_habit_streak int;
  v_multi_7_count int;
  v_tasks_done int;
  v_projects_done int;
  v_sessions_count int;
  v_trinity_count int;
  v_trinity_consec_max int;
  v_perfect_day_exists boolean;
  v_night_owl int;
  v_early_bird int;
  v_marathon boolean;
  v_sprinter boolean;
  v_lost_art boolean;
  v_obsessed boolean;
  v_architect boolean;
  v_habit_id uuid;
  v_phoenix_len int;
  v_phoenix_prev_max int;
  v_pred_event events%rowtype;
  v_perfect_count int;
begin
  v_type := coalesce(p_trigger->>'type', 'all');
  v_meta := coalesce(p_trigger->'meta', '{}'::jsonb);

  select * into v_profile from profiles where id = p_user_id;
  if not found then return jsonb_build_object('unlocked', '[]'::jsonb); end if;

  if v_profile.current_level >= 5  then v_candidates := array_append(v_candidates, 'level-5');  end if;
  if v_profile.current_level >= 10 then v_candidates := array_append(v_candidates, 'level-10'); end if;
  if v_profile.current_level >= 25 then v_candidates := array_append(v_candidates, 'level-25'); end if;
  if v_profile.total_xp >= 10000   then v_candidates := array_append(v_candidates, 'xp-10k');   end if;
  if v_profile.total_xp >= 25000   then v_candidates := array_append(v_candidates, 'xp-25k');   end if;
  if v_profile.total_xp >= 50000   then v_candidates := array_append(v_candidates, 'xp-50k');   end if;
  if v_profile.total_xp >= 100000  then v_candidates := array_append(v_candidates, 'xp-100k');  end if;

  select coalesce(max(longest_streak),0) into v_max_habit_streak
    from habits where user_id = p_user_id;
  if v_max_habit_streak >= 7   then v_candidates := array_append(v_candidates, 'streak-7');   end if;
  if v_max_habit_streak >= 30  then v_candidates := array_append(v_candidates, 'streak-30');  end if;
  if v_max_habit_streak >= 100 then v_candidates := array_append(v_candidates, 'streak-100'); end if;
  if v_max_habit_streak >= 365 then
    v_candidates := array_append(v_candidates, 'streak-365');
    v_candidates := array_append(v_candidates, 'ghost-year');
  end if;

  select count(*) into v_multi_7_count from habits where user_id = p_user_id and current_streak >= 7;
  if v_multi_7_count >= 5 then v_candidates := array_append(v_candidates, 'multi-streak'); end if;

  select count(*) into v_tasks_done from tasks where user_id = p_user_id and completed = true;
  if v_tasks_done >= 100  then v_candidates := array_append(v_candidates, 'tasks-100');  end if;
  if v_tasks_done >= 500  then v_candidates := array_append(v_candidates, 'tasks-500');  end if;
  if v_tasks_done >= 1000 then v_candidates := array_append(v_candidates, 'tasks-1000'); end if;

  select count(*) into v_projects_done from projects where user_id = p_user_id and status = 'completed';
  if v_projects_done >= 10 then v_candidates := array_append(v_candidates, 'projects-10'); end if;
  if v_projects_done >= 50 then v_candidates := array_append(v_candidates, 'projects-50'); end if;

  select count(*) into v_sessions_count from project_sessions where user_id = p_user_id and ended_at is not null;
  if v_sessions_count >= 50  then v_candidates := array_append(v_candidates, 'sessions-50');  end if;
  if v_sessions_count >= 500 then v_candidates := array_append(v_candidates, 'sessions-500'); end if;

  if exists (select 1 from (
      select event_date, sum(xp_amount) s from xp_events
      where user_id = p_user_id and category='tasks' group by event_date
    ) d where d.s > 250) then
    v_candidates := array_append(v_candidates, 'first-bonus');
  end if;

  if exists (select 1 from (
      select event_date, sum(xp_amount) s from xp_events
      where user_id = p_user_id and category='tasks' group by event_date
    ) d where d.s >= 500) then
    v_candidates := array_append(v_candidates, 'cap-breaker');
  end if;

  if exists (select 1 from habit_logs where user_id = p_user_id and was_freeze_save = true) then
    v_candidates := array_append(v_candidates, 'freeze-saved');
  end if;

  with session_dates as (
    select distinct (started_at at time zone 'Africa/Maputo')::date as d
      from project_sessions where user_id = p_user_id and duration_minutes >= 5
  ),
  task_dates as (select distinct event_date as d from xp_events where user_id = p_user_id and category='tasks'),
  habit_dates as (select distinct event_date as d from xp_events where user_id = p_user_id and category='habits'),
  trinity as (select t.d from task_dates t join habit_dates h using(d) join session_dates s using(d)),
  ord as (select d, row_number() over (order by d) rn from trinity),
  grp as (select (d - (rn::text || ' days')::interval) as g, count(*) run_len from ord group by g)
  select (select count(*) from trinity),
         coalesce((select max(run_len) from grp), 0)
  into v_trinity_count, v_trinity_consec_max;

  if v_trinity_count >= 1      then v_candidates := array_append(v_candidates, 'trinity-day');  end if;
  if v_trinity_consec_max >= 7 then v_candidates := array_append(v_candidates, 'trinity-week'); end if;
  if v_trinity_count >= 30     then v_candidates := array_append(v_candidates, 'trinity-30');   end if;

  select exists (
    with day_task_counts as (
      select event_date as d, count(*) c from xp_events
        where user_id = p_user_id and category='tasks' group by event_date
    ),
    day_habit_counts as (
      select event_date as d, count(*) c from xp_events
        where user_id = p_user_id and category='habits' group by event_date
    ),
    day_sessions as (
      select distinct (started_at at time zone 'Africa/Maputo')::date as d
        from project_sessions where user_id = p_user_id and duration_minutes >= 5
    ),
    candidate_days as (
      select dt.d from day_task_counts dt
        join day_habit_counts dh using(d) join day_sessions ds using(d)
        where dt.c >= 3 and dh.c >= 3
    )
    select 1 from candidate_days cd
      where not exists (
        select 1 from tasks t where t.user_id = p_user_id and t.due_date = cd.d and t.completed = false
      )
  ) into v_perfect_day_exists;
  if v_perfect_day_exists then v_candidates := array_append(v_candidates, 'trinity-perfect'); end if;

  select count(*) into v_night_owl from tasks
    where user_id = p_user_id and completed = true and completed_at is not null
      and extract(hour from (completed_at at time zone 'Africa/Maputo')) < 5;
  if v_night_owl >= 10 then v_candidates := array_append(v_candidates, 'arch-night-owl'); end if;

  select count(*) into v_early_bird from tasks
    where user_id = p_user_id and completed = true and completed_at is not null
      and (completed_at at time zone 'Africa/Maputo')::time >= '05:00'::time
      and (completed_at at time zone 'Africa/Maputo')::time <  '07:30'::time;
  if v_early_bird >= 10 then v_candidates := array_append(v_candidates, 'arch-early-bird'); end if;

  select exists (select 1 from project_sessions where user_id = p_user_id and duration_minutes >= 240) into v_marathon;
  if v_marathon then v_candidates := array_append(v_candidates, 'arch-marathoner'); end if;

  select exists (
    select 1 from (
      select completed_at, lag(completed_at, 2) over (order by completed_at) as two_prior
      from tasks where user_id = p_user_id and completed = true and completed_at is not null
    ) c where two_prior is not null and completed_at - two_prior <= interval '10 minutes'
  ) into v_sprinter;
  if v_sprinter then v_candidates := array_append(v_candidates, 'arch-sprinter'); end if;

  select exists (
    select 1 from (
      select habit_id, completed_date,
        lag(completed_date) over (partition by habit_id order by completed_date) as prev
      from habit_logs where user_id = p_user_id and was_freeze_save = false
    ) l where prev is not null and completed_date - prev > 14
  ) into v_lost_art;
  if v_lost_art then v_candidates := array_append(v_candidates, 'arch-lost-art'); end if;

  select exists (
    select 1 from (
      select project_id, (started_at at time zone 'Africa/Maputo')::date as d,
             count(*) cnt, sum(duration_minutes) mins
      from project_sessions where user_id = p_user_id and duration_minutes is not null
      group by project_id, d
    ) s where s.cnt >= 2 and s.mins >= 360
  ) into v_obsessed;
  if v_obsessed then v_candidates := array_append(v_candidates, 'arch-obsessed'); end if;

  select exists (
    select 1 from milestones m1
      where m1.user_id = p_user_id and m1.completed = true and m1.completed_at is not null
        and (select count(*) from milestones m2
             where m2.user_id = p_user_id and m2.completed = true and m2.completed_at is not null
               and m2.completed_at between m1.completed_at - interval '7 days' and m1.completed_at
            ) >= 5
  ) into v_architect;
  if v_architect then v_candidates := array_append(v_candidates, 'arch-architect'); end if;

  -- Phoenix is habit-scoped and live-only
  if v_type = 'habit_complete' and (v_meta->>'habit_id') is not null then
    v_habit_id := (v_meta->>'habit_id')::uuid;
    with seg as (
      select completed_date,
        completed_date - (row_number() over (order by completed_date))::int * interval '1 day' as g
      from habit_logs where habit_id = v_habit_id and was_freeze_save = false
    ),
    runs as (select g, count(*) as len, max(completed_date) as end_date from seg group by g),
    last_run as (select len, end_date from runs order by end_date desc limit 1)
    select lr.len,
      (select max(r.len) from runs r where r.end_date < lr.end_date)
    into v_phoenix_len, v_phoenix_prev_max
    from last_run lr;

    if v_phoenix_len is not null and v_phoenix_prev_max is not null
       and v_phoenix_len > v_phoenix_prev_max then
      v_candidates := array_append(v_candidates, 'arch-phoenix');
    end if;
  end if;

  -- Predictions: event_created → pred-first
  if v_type = 'event_created' then
    v_candidates := array_append(v_candidates, 'pred-first');
  end if;

  -- Predictions: prediction_perfect
  if v_type = 'prediction_perfect' and (v_meta->>'event_id') is not null then
    select * into v_pred_event from events where id = (v_meta->>'event_id')::uuid;
    if found then
      if v_pred_event.sport = 'football'
         and lower(coalesce(v_pred_event.custom_label,'')) ilike '%cl%sico%' then
        v_candidates := array_append(v_candidates, 'pred-clasico');
      end if;
      if v_pred_event.sport = 'f1' then
        v_candidates := array_append(v_candidates, 'pred-perfect-podium');
      end if;
    end if;
    select count(*) into v_perfect_count
      from event_results where user_id = p_user_id and perfect = true;
    if v_perfect_count >= 10 then
      v_candidates := array_append(v_candidates, 'pred-oracle');
    end if;
  end if;

  with ins as (
    insert into user_achievements (user_id, achievement_id, seen)
      select p_user_id, unnest(v_candidates), false
      on conflict do nothing
      returning achievement_id
  )
  select coalesce(array_agg(achievement_id), ARRAY[]::text[]) into v_newly from ins;

  if v_newly is null or array_length(v_newly, 1) is null then
    return jsonb_build_object('unlocked', '[]'::jsonb);
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', a.id, 'name', a.name, 'description', a.description,
    'rarity', a.rarity, 'category', a.category,
    'xp_reward', a.xp_reward, 'is_title', a.is_title, 'icon', a.icon
  )) into v_result
  from achievements a where a.id = any(v_newly);

  return jsonb_build_object('unlocked', coalesce(v_result, '[]'::jsonb));
end; $$;

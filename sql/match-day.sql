-- ============================================================
-- match-day.sql — Match Day Vibe feature (V1)
-- Run via Supabase MCP apply_migration.
-- ============================================================

-- Extend xp_events category check to allow 'prediction' (cap-exempt like 'achievement')
alter table xp_events drop constraint if exists xp_events_category_check;
alter table xp_events add constraint xp_events_category_check
  check (category in ('tasks','habits','projects','bonus','system','spend','achievement','prediction'));

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
  ('pred-oracle',         'The Oracle',       'Nail 10 perfect predictions.',                   'rare', 'legendary',500, false, false, 'sparkles')
on conflict (id) do nothing;

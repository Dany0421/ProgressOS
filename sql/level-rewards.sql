-- ProgressOS — Level Rewards
-- Run via Supabase MCP apply_migration. Idempotent.

-- 1. Add 'challenge' and 'level_reward' to xp_events.category check
alter table xp_events drop constraint if exists xp_events_category_check;
alter table xp_events add constraint xp_events_category_check
  check (category in (
    'tasks','habits','projects','bonus','system','spend',
    'achievement','prediction','challenge','level_reward'
  ));

-- 2. Add 'level_reward' to achievements.category check
alter table achievements drop constraint if exists achievements_category_check;
alter table achievements add constraint achievements_category_check
  check (category in ('xp','streak','volume','rare','trinity','archetype','title','level_reward'));

-- 3. Seed level title achievement rows (upsert, idempotent)
insert into achievements (id, name, description, category, rarity, xp_reward, is_title, hidden, icon) values
  ('lvl-5',   'The Grinder',       'Reach level 5.',   'level_reward', 'common',    0,   true,  false, 'star'),
  ('lvl-10',  'Momentum',          'Reach level 10.',  'level_reward', 'common',    0,   true,  false, 'zap'),
  ('lvl-20',  'Focused',           'Reach level 20.',  'level_reward', 'rare',      0,   true,  false, 'crosshair'),
  ('lvl-30',  'Relentless',        'Reach level 30.',  'level_reward', 'rare',      0,   true,  false, 'activity'),
  ('lvl-40',  'Elite',             'Reach level 40.',  'level_reward', 'rare',      0,   true,  false, 'shield'),
  ('lvl-50',  'Veteran',           'Reach level 50.',  'level_reward', 'legendary', 0,   true,  false, 'medal'),
  ('lvl-100', 'Legend',            'Reach level 100.', 'level_reward', 'legendary', 0,   true,  false, 'award'),
  ('lvl-150', 'Ascended',          'Reach level 150.', 'level_reward', 'legendary', 0,   true,  false, 'trending-up'),
  ('lvl-200', 'Immortal',          'Reach level 200.', 'level_reward', 'legendary', 0,   true,  false, 'infinity'),
  ('lvl-250', 'Transcendent',      'Reach level 250.', 'level_reward', 'legendary', 0,   true,  false, 'sunrise'),
  ('lvl-300', 'ProgressOS God',    'Reach level 300.', 'level_reward', 'legendary', 0,   true,  false, 'crown'),
  ('lvl-400', 'Eternal',           'Reach level 400.', 'level_reward', 'legendary', 0,   true,  false, 'gem'),
  ('lvl-500', 'Infinite',          'Reach level 500.', 'level_reward', 'legendary', 0,   true,  false, 'gem')
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  rarity      = excluded.rarity,
  is_title    = excluded.is_title,
  icon        = excluded.icon;

-- 4. check_level_rewards RPC
create or replace function check_level_rewards(
  p_user_id uuid,
  p_new_level int
) returns jsonb language plpgsql security definer as $$
declare
  v_title_id      text;
  v_title_name    text;
  v_unlocked      jsonb := '[]'::jsonb;
  v_avatar_colour text;
  v_badge         text;
begin
  -- Map level → title achievement id
  v_title_id := case p_new_level
    when 5   then 'lvl-5'
    when 10  then 'lvl-10'
    when 20  then 'lvl-20'
    when 30  then 'lvl-30'
    when 40  then 'lvl-40'
    when 50  then 'lvl-50'
    when 100 then 'lvl-100'
    when 150 then 'lvl-150'
    when 200 then 'lvl-200'
    when 250 then 'lvl-250'
    when 300 then 'lvl-300'
    when 400 then 'lvl-400'
    when 500 then 'lvl-500'
    else null
  end;

  -- Handle levels > 500 in increments of 100
  if v_title_id is null and p_new_level > 300 and (p_new_level % 100) = 0 then
    v_title_id := 'lvl-' || p_new_level::text;
    insert into achievements (id, name, description, category, rarity, xp_reward, is_title, hidden, icon)
      values (v_title_id, 'Level ' || p_new_level, 'Reach level ' || p_new_level || '.', 'level_reward', 'legendary', 0, true, false, 'gem')
      on conflict (id) do nothing;
  end if;

  if v_title_id is not null then
    insert into user_achievements (user_id, achievement_id, seen)
      values (p_user_id, v_title_id, false)
      on conflict do nothing;

    -- Auto-equip if user has no active title yet
    update profiles
      set active_title = v_title_id
      where id = p_user_id and active_title is null;

    select name into v_title_name from achievements where id = v_title_id;

    v_unlocked := v_unlocked || jsonb_build_object(
      'type', 'title',
      'id', v_title_id,
      'name', v_title_name
    );
  end if;

  -- Avatar colour key
  v_avatar_colour := case
    when p_new_level >= 300 then 'rainbow'
    when p_new_level >= 100 then 'purple-pink'
    when p_new_level >= 40  then 'crimson-orange'
    when p_new_level >= 20  then 'indigo-violet'
    else null
  end;

  if v_avatar_colour is not null then
    v_unlocked := v_unlocked || jsonb_build_object('type', 'avatar_colour', 'key', v_avatar_colour);
  end if;

  -- Badge key
  v_badge := case
    when p_new_level >= 200 then 'glow'
    when p_new_level >= 100 then 'diamond'
    when p_new_level >= 50  then 'gold'
    else null
  end;

  if v_badge is not null then
    v_unlocked := v_unlocked || jsonb_build_object('type', 'badge', 'key', v_badge);
  end if;

  return jsonb_build_object('unlocked', v_unlocked);
end; $$;

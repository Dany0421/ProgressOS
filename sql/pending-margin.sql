-- Add pending_margin status + tracking columns to projects

alter table projects drop constraint if exists projects_status_check;
alter table projects add constraint projects_status_check
  check (status in ('active', 'completed', 'paused', 'pending_margin'));

alter table projects add column if not exists pending_margin_since timestamptz;
alter table projects add column if not exists last_followup_at timestamptz;

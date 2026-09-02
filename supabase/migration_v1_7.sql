-- Loop v1.7 migration
alter table rentals add column if not exists handoff_confirmed_at timestamptz;

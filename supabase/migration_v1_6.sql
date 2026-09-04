-- Loop v1.6 migration
-- Run this once in the Supabase SQL Editor, after migration_v1_5.sql.

-- Rental dates, so two people can't book the same item for the same weekend
alter table rentals add column if not exists start_date date;
alter table rentals add column if not exists end_date date;

-- Tracks whether a user has accepted the rental terms (shown before their
-- first booking or listing) — null means they haven't agreed yet.
alter table profiles add column if not exists agreed_terms_at timestamptz;

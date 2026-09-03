-- Loop v2.3 migration

alter table listings add column if not exists min_days int default 1;
alter table listings add column if not exists max_days int default 14;

alter table rentals add column if not exists expires_at timestamptz;
alter table rentals add column if not exists cancelled_by text;
alter table rentals add column if not exists cancelled_at timestamptz;
alter table rentals add column if not exists no_show_status text; -- 'confirmed' | 'under_review' | 'dismissed'
alter table rentals add column if not exists no_show_dispute_reason text;
alter table rentals add column if not exists no_show_dispute_deadline timestamptz;

alter table profiles add column if not exists is_admin boolean default false;
alter table profiles add column if not exists cancellation_count int default 0;
alter table profiles add column if not exists suspended boolean default false;
alter table profiles add column if not exists card_fingerprint text;
alter table profiles add column if not exists referral_credit_earned_at timestamptz;

alter table reviews add column if not exists reviewer_role text; -- 'owner' | 'renter'
alter table reviews add column if not exists owner_response text;

drop policy if exists "reviewee can respond once" on reviews;
create policy "reviewee can respond once" on reviews for update
  using (auth.uid() = reviewee_id)
  with check (auth.uid() = reviewee_id);

-- make yourself an admin — run this once with your own user id
-- (find it in Supabase: Authentication > Users)
-- update profiles set is_admin = true where id = 'YOUR_USER_ID';

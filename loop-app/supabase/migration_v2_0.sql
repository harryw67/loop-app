-- Loop v2.0 migration
-- Covers everything pending: care instructions, real location, color, and referrals.
-- Safe to run even if some of these already exist on your database.

alter table listings add column if not exists care_instructions text;
alter table listings add column if not exists lat numeric;
alter table listings add column if not exists lng numeric;
alter table listings add column if not exists color text;

alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by text;
alter table profiles add column if not exists referral_credit_cents int default 0;

-- give every existing profile a referral code if it doesn't have one yet
update profiles set referral_code = upper(substr(md5(random()::text || id::text), 1, 6))
where referral_code is null;

-- make sure future signups get a referral code automatically too
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    upper(substr(md5(random()::text || new.id::text), 1, 6))
  );
  return new;
end;
$$ language plpgsql security definer;

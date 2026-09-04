-- Loop v2.1 migration — adds fields needed for real username/password signup

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists username text unique;
alter table profiles add column if not exists college text;
alter table profiles add column if not exists location text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists avatar_url text;

-- Update the auto-profile trigger to use signup metadata (first/last name,
-- username, college, location) when they're provided, and still fall back
-- gracefully + generate a referral code either way.
create or replace function handle_new_user() returns trigger as $$
declare
  fn text := new.raw_user_meta_data->>'first_name';
  ln text := new.raw_user_meta_data->>'last_name';
begin
  insert into public.profiles (id, full_name, first_name, last_name, username, college, location, referral_code)
  values (
    new.id,
    case when fn is not null then trim(fn || ' ' || coalesce(ln, '')) else split_part(new.email, '@', 1) end,
    fn,
    ln,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'college',
    new.raw_user_meta_data->>'location',
    upper(substr(md5(random()::text || new.id::text), 1, 6))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Storage: create an "avatars" bucket in Supabase Storage (Storage > New
-- bucket > name it exactly "avatars" > toggle Public), then run this:
create policy "authenticated users can upload avatars"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars');

create policy "anyone can view avatars"
on storage.objects for select
using (bucket_id = 'avatars');

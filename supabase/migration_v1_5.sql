-- Loop v1.5 migration
-- Run this once in the Supabase SQL Editor, after the original schema.sql.
-- Safe to run on your existing database — only adds new things, doesn't touch old data.

-- Multiple photos per listing (photo_url stays as the "cover" photo for backward compatibility)
alter table listings add column if not exists photos jsonb default '[]'::jsonb;

-- Owner approval step: renter requests -> owner approves/declines -> booked
-- (rentals.stage is just text, so no schema change needed — 'pending' and 'declined'
-- are new values the app will start using)

-- Reviews, left after a rental settles
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid references rentals(id) not null,
  reviewer_id uuid references profiles(id) not null,
  reviewee_id uuid references profiles(id) not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(rental_id, reviewer_id)
);
alter table reviews enable row level security;
create policy "reviews are publicly readable" on reviews for select using (true);
create policy "participants can leave one review per rental" on reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from rentals r where r.id = rental_id
      and r.stage = 'settled'
      and (r.owner_id = auth.uid() or r.renter_id = auth.uid())
      and reviewee_id in (r.owner_id, r.renter_id)
      and reviewee_id != auth.uid()
    )
  );

-- Reports (flagging a user, optionally tied to a specific rental)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) not null,
  reported_user_id uuid references profiles(id) not null,
  rental_id uuid references rentals(id),
  reason text not null,
  created_at timestamptz default now()
);
alter table reports enable row level security;
create policy "users can file reports" on reports for insert with check (auth.uid() = reporter_id);
create policy "users can see their own filed reports" on reports for select using (auth.uid() = reporter_id);

-- Blocks (hides a user's listings from your browse results)
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references profiles(id) not null,
  blocked_id uuid references profiles(id) not null,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);
alter table blocks enable row level security;
create policy "users manage their own blocks" on blocks for all using (auth.uid() = blocker_id);

-- Favorites (saved listings)
create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  listing_id uuid references listings(id) not null,
  created_at timestamptz default now(),
  unique(user_id, listing_id)
);
alter table favorites enable row level security;
create policy "users manage their own favorites" on favorites for all using (auth.uid() = user_id);

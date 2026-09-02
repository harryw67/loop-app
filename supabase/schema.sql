-- Loop database schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query) once.

-- Profiles: one row per authenticated user, extends Supabase auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  venmo_handle text,
  stripe_account_id text,          -- Stripe Connect Express account, set after onboarding (for receiving payouts as an owner)
  stripe_onboarded boolean default false,
  stripe_customer_id text,         -- Stripe Customer object (for paying as a renter)
  default_payment_method_id text,  -- saved card, set after the renter completes the "add payment method" step
  created_at timestamptz default now()
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  category text not null,
  size text not null,
  price_cents int not null,          -- per day, in cents
  deposit_cents int not null,
  description text not null,
  photo_url text,
  distance_miles numeric default 0,  -- rough distance from campus, in miles
  active boolean default true,
  created_at timestamptz default now()
);

create table rentals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) not null,
  owner_id uuid references profiles(id) not null,
  renter_id uuid references profiles(id) not null,
  stage text not null default 'booked',
    -- booked -> handoff -> out -> return -> settled -> disputed
  rental_payment_intent_id text,     -- Stripe PaymentIntent for the rental price
  deposit_payment_intent_id text,    -- Stripe PaymentIntent (manual capture) for the deposit hold
  qr_token text not null,            -- random token embedded in the QR code for this rental
  created_at timestamptz default now()
);

-- Every chat message and system step (QR scan, photos, confirms) lives here,
-- in order, so the thread is just "select events where rental_id = x order by created_at".
create table rental_events (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid references rentals(id) on delete cascade not null,
  kind text not null,
    -- 'message' | 'qr_scanned' | 'photo' | 'confirm' | 'payment_released' | 'deposit_refunded' | 'dispute'
  actor_id uuid references profiles(id),
  payload jsonb default '{}',        -- e.g. {text: "..."} or {side: "front", url: "..."} or {role: "owner"}
  created_at timestamptz default now()
);

create index rental_events_rental_id_idx on rental_events(rental_id, created_at);

-- Row Level Security: users can only see/do what they should.
alter table profiles enable row level security;
alter table listings enable row level security;
alter table rentals enable row level security;
alter table rental_events enable row level security;

create policy "profiles are publicly readable" on profiles for select using (true);
create policy "users edit own profile" on profiles for update using (auth.uid() = id);

create policy "listings are publicly readable" on listings for select using (true);
create policy "owners manage own listings" on listings for all using (auth.uid() = owner_id);

create policy "participants read own rentals" on rentals for select
  using (auth.uid() = owner_id or auth.uid() = renter_id);
create policy "renter creates rental" on rentals for insert
  with check (auth.uid() = renter_id);
create policy "participants update own rentals" on rentals for update
  using (auth.uid() = owner_id or auth.uid() = renter_id);

create policy "participants read rental events" on rental_events for select
  using (exists (
    select 1 from rentals r where r.id = rental_id
    and (r.owner_id = auth.uid() or r.renter_id = auth.uid())
  ));
create policy "participants insert rental events" on rental_events for insert
  with check (exists (
    select 1 from rentals r where r.id = rental_id
    and (r.owner_id = auth.uid() or r.renter_id = auth.uid())
  ));

-- Storage bucket for listing + condition photos (create via dashboard: Storage > New bucket > "photos", public)

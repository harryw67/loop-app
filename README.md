# Loop

Peer-to-peer clothing rental for campus. Next.js + Supabase (database, auth, photo
storage) + Stripe Connect (payments, payouts, deposit holds).

## What's real here vs. the earlier prototype

The single-file HTML version was UI only — nothing persisted, no real money moved.
This version is a working app: listings and rentals live in a real Postgres database,
photos actually upload, and Stripe is wired to actually authorize/charge/refund money
(in test mode until you flip it live). The QR code is a real generated code tied to a
random token per rental, checked server-side before the handoff can start.

## One-time setup (about 30–45 minutes)

### 1. Supabase (free)
1. Create a project at supabase.com.
2. Go to **SQL Editor > New query**, paste in `supabase/schema.sql`, run it.
3. Go to **Storage > New bucket**, name it `photos`, make it public.
4. Go to **Project Settings > API** — copy the Project URL, `anon` key, and
   `service_role` key into your `.env.local` (copy `.env.example` to start).
5. Go to **Authentication > Providers**, confirm Email is enabled (magic link login
   works out of the box, no extra setup).

### 2. Stripe (free to set up, test mode has no real money)
1. Create an account at stripe.com, stay in **test mode** for now.
2. **Developers > API keys** — copy the secret key into `STRIPE_SECRET_KEY`.
3. **Connect > Settings** — enable Express accounts (this is what lets owners get
   paid directly without you touching their bank details).
4. You'll add `STRIPE_WEBHOOK_SECRET` after deploying, in step 4 below.

### 3. Run it locally first
```
npm install
cp .env.example .env.local   # fill in the values from steps 1–2
npm run dev
```
Open localhost:3000. Sign up with two different emails in two browser tabs (or
incognito) to test both sides of a rental — one as the lister, one as the renter.

### 4. Deploy (Vercel, free)
1. Push this folder to a GitHub repo.
2. Go to vercel.com, "New Project", import the repo.
3. Add all the same env vars from `.env.local` in Vercel's project settings, plus
   set `NEXT_PUBLIC_APP_URL` to your real Vercel URL once you have it (e.g.
   `https://loop-yourname.vercel.app`).
4. Deploy. Then go back to Stripe **Developers > Webhooks**, add an endpoint at
   `https://your-url.vercel.app/api/stripe/webhook`, listen for `account.updated`
   and `payment_intent.payment_failed`, copy the signing secret into
   `STRIPE_WEBHOOK_SECRET` in Vercel, redeploy.

At that point you have a real, live URL you can text to beta testers.

## Testing payments without real money
Stripe test mode uses fake cards — `4242 4242 4242 4242`, any future expiry, any
CVC. Every rental in this beta build will use that until you switch the API keys
from test to live.

## What's intentionally simplified for a beta, and what to build next
- **QR scanning** falls back to typing/pasting the code shown on the owner's screen
  rather than decoding a photo of it. Camera-based scanning (via the browser's
  `BarcodeDetector` API, or a library like `html5-qrcode`) is the natural next step
  once you've validated the flow works — most testers won't mind typing 8 characters
  for v1.
- **Card entry for renters**: the API route for saving a card (`/api/stripe/setup-intent`)
  exists, but you still need a Stripe Elements form on the frontend to actually collect
  card details securely (never handle raw card numbers yourself). This is the next
  piece to build before a real rental can complete — worth doing before your first
  beta tester.
- **Damage fee tiers**: disputes currently just flag the rental and stop there. You'll
  want an actual screen for reviewing the before/after photos side by side and picking
  a fee tier, which then captures part of the held deposit instead of canceling it.
- **Push/email notifications** when the other person does something in the thread —
  right now testers have to just refresh.

## Cost to run a beta
Supabase and Vercel are both free at this scale. Stripe takes ~2.9% + $0.30 per
real transaction once you're live — that comes out of your take rate, not a
separate bill.

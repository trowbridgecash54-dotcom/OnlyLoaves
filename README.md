# OnlyLoafs — developer guide

Website and owner dashboard for OnlyLoafs, a small family sourdough business. Local pickup only.

- **Customers** browse bread, send one-time **order requests**, or send a **Club enrollment request** (initially $50/month for 3 loaves). Nothing is charged online; the owner confirms everything directly.
- **The owner** manages bread, orders, Club members, loaf allowances, pickup days and website wording at **`/admin`**.

The owner's own guide is [docs/OWNER-GUIDE.md](docs/OWNER-GUIDE.md). How the Club works end to end: [docs/SUBSCRIPTIONS.md](docs/SUBSCRIPTIONS.md).

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Resend over HTTPS (optional) · Lucide · Motion. Hosted on Vercel.

---

## Current status

| Piece | Status |
| --- | --- |
| Supabase project `OnlyLoafs` (`otmyxbkncfgmuwpqhcan`, us-west-1) | **Created. All 4 migrations applied.** Seeded with the Club plan and 3 sample loaves. |
| Owner account | **Not created yet** — needs the owner's email. See [Create the owner account](#3-create-the-owner-account). |
| Vercel deployment | **Live at https://onlyloafs.vercel.app** (Vercel project `onlyloafs`, team `only-loaves`, Node 22.x). Linked to the GitHub repo: every push to `main` redeploys. Public pages verified reachable without a login. |
| Vercel environment variables | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set. **`SUPABASE_SECRET_KEY` not set yet** — the owner adds it (Vercel → Project → Settings → Environment Variables), then redeploys. Until then the forms can't save. |
| `npm install` / `npm run build` | **Passed on Vercel** (2026-11-17): 67 packages installed, Next.js 16.4.6 compiled, TypeScript passed, all 31 routes generated. The first build failed on one type error (TS2589 in `lib/backend.ts`), fixed in commit `7c2ccb4`. |
| Email (Resend) | Code done and tested with a mocked API. **No account configured;** no real email has been sent. |
| Ordering | **Closed to the public** by default until the owner opens it in Settings. |

---

## 1. How it fits together

```
Visitor ──► public pages (app/(site)) ──► getSite() ──► Supabase as "anon"  (RLS: public rows only)
   │
   └─► form POST /api/order|club|contact ──► lib/handlers.ts
           validate → spam checks → rate limit → SAVE (Supabase, secret key, submit_* SQL functions)
           → email owner (Resend, optional) → record whether the email went out

Owner ──► /admin (proxy.ts refreshes session; every page calls requireAdmin())
   └─► form POST /admin/do/<action> ──► lib/admin/http.ts
           same-origin check → verify session with Supabase Auth → must be in public.admins
           → lib/admin/actions.ts through the OWNER's session (RLS applies again)
```

Key rules, enforced in the database (not just the UI):

- **Row-level security on every table.** Visitors can read only products, the plan, public settings and closed dates. Orders, inquiries, members, loaf records and messages are readable by administrators only. Nobody can add themselves to `admins` through the API.
- **An enrollment request is only an inquiry.** `approve_inquiry()` (admin-only) creates the subscription, copies the plan's price and loaf count at that moment, and enforces the subscriber limit. It records no payment and grants no allowance period.
- **Loaf allowance.** `fulfill_loaf()` locks the period, refuses past the allowance unless the owner records an *extra purchase*, refuses inactive members and dates outside the period, and ignores a repeated idempotency key. A trigger repeats the allowance check for any direct insert. Records can't be deleted, only voided.
- **Periods are created on demand for active members only** (`ensure_period()`), so paused, canceled and not-yet-started members never get an allowance. Nothing carries over between periods unless a rollover rule is chosen.
- **Duplicate submissions.** Each form sends a UUID; the `submit_*` functions return the existing record for a repeated one, and no second email is sent.

Main files:

```
supabase/migrations/   Schema, RLS policies, SQL functions, storage bucket, seed rows
supabase/local/        Shim for running the migrations on plain PostgreSQL (tests only)
lib/backend.ts         The only file that talks to Supabase
lib/store.ts           Every read/write the app makes
lib/handlers.ts        The three public form endpoints
lib/admin/             Dashboard auth, form endpoint, actions
lib/defaults.ts        Built-in starting content (used until the owner saves her own)
app/(site)/            Public pages        app/admin/   Dashboard
proxy.ts               Session refresh + sign-in redirect for /admin
tests/                 Unit tests; tests/db = tests against real PostgreSQL
```

There are no hardcoded prices, policies or business details in components. Everything the owner might change lives in the database and is edited in the dashboard.

## 2. Supabase setup

The project already exists and the migrations are applied. To recreate it elsewhere, apply the files in `supabase/migrations/` in filename order (Supabase CLI: `supabase link` then `supabase db push`, or paste them into the SQL editor).

**Do these in the Supabase dashboard** (the connector used to build this can't change Auth settings):

1. **Turn off public sign-ups.** Authentication settings → disable **Allow new users to sign up**. The site has no sign-up page, and a non-admin account gets nothing, but there's no reason to allow strangers to create accounts.
2. **Copy the secret key** for Vercel: Project Settings → API Keys → *Secret keys* (starts `sb_secret_`).
3. Optional: Authentication → URL Configuration → set **Site URL** to the Vercel address. Password sign-in doesn't depend on it, but Supabase's own emails (e.g. password resets you send from the dashboard) use it.

## 3. Create the owner account

Pick whichever is easier. There is no public admin registration and no hardcoded credentials.

**A. In the Supabase dashboard (no terminal):**
1. Authentication → Users → **Add user** → *Create new user*. Enter the owner's email and a strong password, tick **Auto Confirm User**.
2. SQL Editor → run, with her email:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'owner@example.com';
   ```
   This row is what grants dashboard access. Remove it to revoke access.

**B. From a terminal** (with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` exported): `npm run create-owner -- owner@example.com`. It creates a confirmed account with a random temporary password, prints it once, and authorizes it.

To reset a forgotten password: Authentication → Users → the user → *Send password recovery* or set a new password.

## 4. Deploy to Vercel

1. Create a **private** GitHub repository and upload the contents of this folder (GitHub's *Add file → Upload files* accepts drag-and-drop). `.env.local` must not be uploaded.
2. In Vercel: **Add New → Project** → import the repository. Framework: Next.js (detected). Leave build settings as they are.
3. Before clicking Deploy, add **Environment Variables** (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://otmyxbkncfgmuwpqhcan.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_ymRYP7JkNgDnF8qqeyfBHA_J_tU_0uI`
   - `SUPABASE_SECRET_KEY` = the secret key from Supabase (mark it **Sensitive**)
   - Email variables only if Resend is set up (below).
4. **Deploy.** Vercel runs `npm install` and `npm run build`. If it succeeds, open the `.vercel.app` address, then `/admin/login`.
5. **Lockfile:** this project ships without `package-lock.json` (it couldn't be generated without registry access). Vercel resolves versions from `package.json` on the first build. Once the build is green, run `npm install` once on any computer and commit the `package-lock.json` it creates, so later builds use exactly the same versions.

### If the Vercel build fails

The build has passed on Vercel. If a later change breaks it, open the failed deployment → **Build Logs**, copy the red error lines, and fix them (or paste them to whoever maintains the site). Do not disable TypeScript checks to get past them.

### Custom domain (when registered)

Vercel → Project → Settings → **Domains** → add it and create the DNS records Vercel shows at your registrar. Then set `NEXT_PUBLIC_SITE_URL` to `https://yourdomain` and redeploy, and update the Site URL in Supabase.

## 5. Email notifications (optional)

Requests are always stored and visible in the dashboard; email only adds a copy in the owner's inbox. The dashboard marks any request whose email failed ("Email not sent").

1. Create a [Resend](https://resend.com) account **using the inbox that should receive notifications**, and create an API key.
2. Set `RESEND_API_KEY` and `ORDERS_TO_EMAIL` in Vercel and redeploy.
3. With no domain, leave `ORDERS_FROM_EMAIL` blank: Resend's test sender only delivers to the account's own address. Once a domain exists, verify it in Resend (DNS records) and set `ORDERS_FROM_EMAIL`, e.g. `OnlyLoafs <orders@yourdomain.com>`.
4. Send a test order and confirm it arrives.

Implementation (`lib/email.ts`): server-only key; 6-second timeout; one retry for network errors, timeouts, 429 and 5xx; no retry for other 4xx (bad key, unverified sender); logs only the status, never customer details. The direct HTTPS call was kept rather than adding the `resend` package: it's one request and fully covered by tests.

## 6. Spam protection and rate limits

Hidden honeypot field; minimum time between opening and sending a form; per-visitor limit of 5 submissions per 10 minutes per form, stored in Postgres (`check_rate_limit`) so it holds across Vercel instances, keyed by a salted hash rather than the IP address. Dashboard sign-in is limited too. If spam gets through anyway, add Cloudflare Turnstile to the three forms and verify the token in `lib/handlers.ts`.

## 7. Photos

Uploaded to the public Supabase Storage bucket `photos` (JPEG/PNG/WebP, max 5 MB, enforced by the bucket and again on the server by reading the file's bytes). Uploads and deletes are admin-only by storage RLS. Files get random names. The browser shrinks large phone photos before upload. Pages display photos in fixed-ratio frames (`object-cover`), so any photo crops consistently. Until the owner uploads a photo, illustrated placeholders from `public/images` are shown — these are drawings, not claimed to be the actual bread.

## 8. Fonts

Instrument Serif and DM Sans load via `next/font/google`: downloaded at build time and self-hosted, with metric-matched fallbacks. Vercel's build needs network access to Google Fonts (it has it). Confirmed on the live site: the font files are self-hosted and preloaded. (The sandbox test screenshots used substitute fonts.)

## 9. Tests

```bash
npm test                 # unit tests: forms, email, spam, dashboard access, allowance, pickup dates
npm run test:db          # real PostgreSQL: migrations, RLS, approvals, allowance, uploads, actions
```

`test:db` needs a disposable PostgreSQL 15+ you control (never the production project) and `psql`:

```bash
scripts/local-db.sh "postgres://postgres@127.0.0.1:5432/postgres" onlyloafs_test
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/onlyloafs_test npm run test:db
```

It drops and recreates that database, applies a small shim (`supabase/local/shim.sql`) standing in for Supabase's `auth`/`storage` schemas, then the real migrations, and runs everything as the same roles Supabase uses so RLS is genuinely exercised. Tests use made-up fixtures and never contact Supabase or Resend.

## 10. Launch checklist

`npm run checklist` (with the Supabase variables set) or the dashboard's **Checklist** page lists every placeholder and missing item. Permit and label confirmations are ticked by the owner in the dashboard.

## 11. Future: automatic recurring billing (not implemented)

Not built, by design. When the owner wants it: Stripe Billing with Checkout in subscription mode, started only *after* the owner approves an inquiry; signed server-side webhooks as the source of billing truth (`invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`); store only Stripe IDs (`subscriptions.stripe_customer_id/stripe_subscription_id`, `subscription_plans.stripe_price_id` already exist); Customer Portal for card changes and cancellation; and clearly disclosed renewal, cancellation and refund terms with explicit consent, checked against California's automatic-renewal law, before anyone is charged automatically.

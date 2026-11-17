# OnlyLoafs — build and test report

Date: 2026-11-17.

## Install and build

| Command | Result |
| --- | --- |
| `npm install` | **Not run successfully.** The development sandbox's network policy refused the npm registry: direct DNS lookups for `registry.npmjs.org` failed (`ENOTFOUND`), and the sandbox proxy answered `403 policy denied`. The account's install setting couldn't be changed from this chat. |
| `npm run build` | **Not run** (depends on the install). The first Vercel deployment runs both on Vercel's servers; see README → Deploy. |
| `package-lock.json` | Not generated, for the same reason. Commit one after the first green build (README, step 4.5). |

Declared versions (`package.json`): next ^16.2.0, react / react-dom ^19.2.0, @supabase/supabase-js ^2.100.0, @supabase/ssr ^0.12.0, lucide-react ^1.0.0, motion ^12.0.0, tailwindcss and @tailwindcss/postcss ^4.1.0, typescript ^5.9.0, tsx ^4.20.0. No major-version changes from the previous version except the two Supabase packages, which are new. The ranges were checked against published release information, but never installed.

Locally available tools used for verification: React 19.2.8, TypeScript 6.0.3, Tailwind CSS 4.3.3, esbuild 0.28.2, Playwright 1.63.0 (Chromium), tsx 4.23.12, PostgreSQL 16.

## Database

| Item | Result |
| --- | --- |
| Supabase project `OnlyLoafs` (`otmyxbkncfgmuwpqhcan`, us-west-1), in the Cartly.com organization at the owner's request | Created, healthy. |
| Migrations `schema`, `storage`, `initial_data`, `admin_check_without_definer` | **Applied to Supabase** (versions 20261117032522–20261117032649). Same files in `supabase/migrations/`. |
| Security advisor | After the fourth migration: no warnings. One informational note remains: `rate_limit_hits` has RLS on and no policies, which is intended (only the server's functions touch it). |
| Live security check (run in a rolled-back transaction, so no rows were left) | Visitor: reads 3 products and 1 plan; reading orders/messages, calling `submit_order` and inserting products all **denied**. Server role: order saved with an `OL-` reference; repeat returned as duplicate; rate limit allowed then blocked. Signed-in non-owner: sees 0 orders, can't insert products, upload photos or add itself to `admins`; `approve_inquiry` → `not_authorized`. |
| Current contents | 3 sample loaves (no prices), the Club plan ($50 / 3 loaves), no settings, no orders, **no users and no owner account**. |

## Automated tests (final run, all from a freshly rebuilt test database)

| Suite | Passed | Failed | What it covers |
| --- | --- | --- | --- |
| `npm test` (unit) | 45 | 0 | All three forms through the real handlers with an in-memory database and email: save-then-notify, references, duplicate submissions, unavailable loaves, database failure fallback, email failure recorded, ordering closed, validation, pickup-date rules, Club allowance limit, honeypot / timing / rate limits, HTML escaping. Resend request shape, not-configured, retry on 5xx, no retry on 4xx, network failure. Dashboard access: cross-site forms refused, signed-out, non-owner, sign-in errors, non-owner signed straight back out, sign-in rate limit, safe redirects. Allowance and period math. Price parsing; photo type sniffing. |
| `npm run test:db` | 30 | 0 | Real migrations on PostgreSQL 16 with Supabase's roles, so RLS really runs. Visitor / server / owner / non-owner permissions; private settings; product add/edit/archive/delete and photo upload, replace and remove; photo type and size refusal; order status persistence; contact de-duplication; rate limiting; inquiry-only enrollment; closed enrollment; approval once, with copied terms and subscriber limit; allowance 3→2→1→0 then blocked; duplicate key ignored; explicit extras; void instead of delete; direct-insert bypass blocked; paused / canceled / not-started get no allowance; manual payment status; storage policies. |
| Typecheck (`tsc --strict`) | clean | — | Whole project, against **stand-in type definitions** for Next.js, Supabase, Lucide and Motion (the real ones couldn't be installed). JSX attribute types weren't checked. |

The earlier 27 tests were rerun first. They were then rewritten for the database-backed design, and their cases carried into the suites above.

## Browser end-to-end (Chromium, real interactions)

Run with a local preview server. It uses the project's real pages, components, form handlers, dashboard actions, Store and SQL against a local PostgreSQL with the real migrations and row-level security. **Stand-ins:** Supabase Auth sign-in (a cookie holding the user id), Next.js's server-component runtime (a small resolver), the Next image and link components, the fonts, and Resend (captured, never sent). The proxy file was not exercised; the dashboard's own server-side checks were.

20 / 20 flows passed:

1. Public pages: every internal link resolves, no hydration errors.
2. Before launch: order and Club forms closed; "Price confirmed when ordering".
3. Dashboard locked: redirect when signed out; wrong password; non-owner account refused; cross-site form post → 403.
4. Owner sign-in; overview with real empty states.
5. Settings: open ordering, set Instagram; footer shows the icon link.
6. Bread: set a price and upload a photo; the public catalog shows both, served from storage.
7. Add a loaf, then archive it; it disappears from the public site.
8. Pickup Fri/Sat with 2 days' notice; the public form offers only those dates; private address never appears on public pages.
9. Customer: quantity selector → prefilled order → submit on a phone → reference; "isn't a confirmed order yet".
10. Owner: sees the order, changes status, filters.
11. Email failure: order still saved, customer sees "received", dashboard shows "Email not sent".
12. Club request on a phone: picker stops at 3 of 3; reference; "nothing has been charged".
13. Approval blocked without the confirmation tick; then approved; allowance 3/0/3 → 3/1/2 → … → 3/3/0; a fourth loaf refused.
14. The same "mark fulfilled" form posted twice at once → recorded once.
15. Payment recorded; membership paused → no allowance.
16. Contact message appears in the dashboard and is resolved.
17. Overview shows real counts and activity.
18. All ten dashboard pages at 390 px: no sideways scrolling.
19. Keyboard focus visible in the dashboard; sign-out works and re-locks.
20. Nine public pages at 390, 1024 and 1440 px: no sideways scrolling.

## Issues found and fixed during this work

- Supabase's security advisor flagged `is_admin()` as a SECURITY DEFINER function callable by visitors. Fixed with migration 4: it now runs with the caller's rights, and each user may read only their own admin row.
- Test isolation: one database test file changed the plan without the other resetting it. Fixed.
- Dashboard wording: "links on the left" was wrong on phones; "1 members". Fixed.
- Test-harness-only problems (nested hydration islands, a stale preview server) were found and fixed in the harness, not in the site.

## Known issues and limits

- **Not built with the real toolchain yet.** The first Vercel build may surface type or API differences in Next.js, `@supabase/ssr`, Lucide or Motion. These were typechecked only against stand-ins.
- **Fonts:** `next/font` loading of Instrument Serif and DM Sans wasn't exercised; screenshots used substitute fonts.
- **Supabase Auth settings** (turning off public sign-up, the Site URL) must be changed in the Supabase dashboard; the connector can't.
- A loaf can be recorded on a date inside the member's first month but before their start date. Minor; the dates are shown in the history.
- Photos are cropped automatically to fixed frames (centered). There is no manual crop tool.
- The privacy notice describes what the site actually does. It is not legal advice and makes no compliance claims; have it reviewed.

## Launch checklist (computed from the live database's current state)

The previous version reported 30 open items. Each has been reviewed:

| Category | Items |
| --- | --- |
| **1. Resolved in code** | Website address: no longer a fake `.example` value; it comes from `NEXT_PUBLIC_SITE_URL`, falling back to Vercel's address. Email and Instagram: the fake placeholder values are gone; both are optional, editable in the dashboard, and hidden until set, so no broken links. Editing config files: replaced by the dashboard. |
| **2. Needs real business information** | Prices (3), ingredients (3), allergens (3), real photos (3) for each loaf; Our Story (5 sections, plus an optional baker photo); homepage and Club photos; pickup days; general pickup area; optional public email and Instagram. |
| **3. Needs an external service or account** | Supabase secret key in Vercel; owner account created; Vercel deployment; domain (when registered); Resend (optional). |
| **4. Needs legal or business-policy confirmation** | Club policies: payment, renewal, pausing and canceling, missed pickups, unused loaves, refunds; cottage-food permit approved; food-label information confirmed; required footer disclosures; then opening ordering. |

The dashboard's checklist now has 39 items. It is more detailed than before: it adds photos, permit, labels, refunds, disclosures, the open-ordering switch and the accounts above. **1 is done** (database connected), **34 required items remain**, and 4 are optional.

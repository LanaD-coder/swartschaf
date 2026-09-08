# Swartschaf – Zeiterfassungs-App für Beauty-Salons

> **Slogan:** *Zeit für das schwarze Schaf.*
> **Expo Project ID:** `497702e9-b5a2-494e-9981-bcce2d4824af` | **ASC App ID:** `6783376086` | **Apple Team:** `CM82SUJ92U`

## Overview
SaaS operations platform for German beauty salons (**swartschaf.de**) — the three pillars are booking,
inventory, and time-tracking. Time-tracking and **inventory are both functionally built** (inventory
end-to-end as of 2026-09-03: items → pricing → Produktverbrauch → billing-triggered stock deduction →
Fernando's AI reorder suggestions — see Core Data Model and [PROJECT-PLAN.md](PROJECT-PLAN.md) Phase C/D
for detail). **Booking (Phase B) hasn't been started at all yet** — that's the next big piece. Owners
configure their salon and add employees; **billing is handled entirely outside the app** (no in-app
payment collection — see Billing note below). The day runs from an admin-only calendar; each employee has a
homepage with personal Start/Stop timers (multiple can run concurrently, e.g. highlights + washing
another client). Walk-ins (`Laufkunde`) can be logged instantly by any employee. All time data is
GoBD-compliant and exportable as German `Arbeitszeitnachweis` PDFs for the Finanzamt.

**Distribution: web-only**, shipped via Netlify — no iOS/Android app store submission (Google Play's
testing/review requirements were judged too slow for this product's timeline). Still built with Expo,
since its web export already covers this with no rewrite needed — see [PROJECT-PLAN.md](PROJECT-PLAN.md)
for the reasoning and full v2 roadmap (booking, inventory, AI features on top of this base). This file
covers the current app's architecture and day-to-day build status; PROJECT-PLAN.md is the forward roadmap;
[TESTCASES.md](TESTCASES.md) is the manual QA checklist derived from what this file documents;
[BUGS.md](BUGS.md) is the running log of real bugs found (mostly via live click-through testing) and
their fixes.

## Stack
| Layer | Technology |
|---|---|
| App | Expo SDK 56 + Expo Router v5 (iOS, Android, Web) |
| Backend | Supabase (Auth, Postgres, Edge Functions, Realtime) |
| Hosting | Netlify (`expo export --platform web` → `dist/`) |
| Payments | None in-app — billing is handled externally, see Billing note below |
| State | Zustand |
| PDF | `expo-print` + `expo-sharing` |
| Language/Dates | German only; `date-fns` with `de` locale |

Excluded (break Expo web builds): `@stripe/stripe-react-native`, `react-native-reanimated`.

## User Roles & Auth
- **Owner**: full calendar CRUD, manage employees, approve corrections, reports, subscription. Logs in via Supabase Auth email/password.
- **Employee**: own appointments, start/stop timers, walk-ins, correction requests. 3-step PIN login
  (Saloncode → pick your name → PIN; see "PIN login lockout" below for why it's 3 steps, not the
  original 2):
  1. `list_salon_employees(p_salon_code)` — SECURITY DEFINER RPC, no session needed, lists that salon's active employees by name.
  2. `verify_employee_pin(p_salon_code, p_profile_id, p_pin)` — SECURITY DEFINER RPC, scoped to the one profile picked in step 1 (not a blind guess across the whole salon), returns `user_id`/`full_name`/`salon_id`/`locked`.
  3. `supabase.auth.signInWithPassword({ email: emp_<user_id>@swartschaf.internal, password: pin })` — gives a real JWT session so RLS works.
- Employee `auth.users` rows are created by the `create-employee` Edge Function (service role). Internal email is never shown in the UI. A Zustand-only session has no JWT, so this Edge Function + PIN pattern is required for RLS to work at all.
- PINs are bcrypt-hashed (`pin_hash`, via `pgcrypto`) — see `004_security_hardening.sql`.
- **Mandatory PIN reset on first login** (`016_employee_pin_reset.sql`, 2026-09-08): the PIN an owner sets
  at employee creation is temporary — `profiles.must_reset_pin` starts `true` for every new employee.
  `app/index.tsx`'s redirect chain gates on it (before onboarding, after session): if true, the employee
  is sent to `app/reset-pin.tsx` and can't reach anything else until they set their own PIN. Reset touches
  two separate things: the Supabase Auth password (`supabase.auth.updateUser({ password })`, what
  `signInWithPassword` checks) and `profiles.pin_hash` (what the pre-auth `verify_employee_pin` RPC
  checks) — both have to change together or the two-step login breaks. `pin_hash` was previously blocked
  from any non-service-role change by `prevent_profile_privilege_escalation` (004); loosened to allow a
  user to change *their own* `pin_hash` only — changing someone else's is still blocked. Owners can also
  force a reset (e.g. an employee forgot their PIN) from `employees/[id].tsx`'s "Mitarbeiter-PIN" card —
  that goes through a new `reset-employee-pin` Edge Function (service role) instead, since it's writing to
  *another* user's credential, which the loosened trigger deliberately still doesn't allow directly.
  **Found and fixed while building this:** `register.tsx` and `employee-pin.tsx` both used to
  `router.replace()` straight to their post-login destination, bypassing `app/index.tsx`'s redirect chain
  entirely — which means the pre-existing onboarding gate (`has_seen_onboarding`) was very likely never
  actually reachable via normal login either, before this fix. Both now route through `/` so the chain
  actually runs.
  **PINs are 6 digits, not 4** (changed 2026-09-08, same session): `admin.auth.admin.updateUserById`
  (used by the owner-initiated reset) rejected a raw 4-character PIN with "Password should be at least 6
  characters" — Supabase's project-level Auth password-length policy, enforced there even though
  `admin.auth.admin.createUser` (initial employee creation) apparently didn't enforce the same check.
  Rather than weaken that policy project-wide or add a hidden derived-password layer, the PIN itself is
  now 6 digits everywhere (login keypad, both reset screens, `create-employee`'s validation) — simpler,
  and the user-facing PIN is honestly what gets checked, not some internal transform of it. This also
  happens to resolve the old "Saloncode 6 chars vs. PIN 4 digits" UX confusion noted below, as a side
  effect, not the original motivation.
- **PIN login lockout, 3 strikes** (`017_pin_login_rate_limit.sql`, 2026-09-08, same session as the
  Security Hardening pass below): the original 2-step login (Saloncode → blind PIN) never identified
  *which* employee was attempting, since a wrong PIN doesn't match anyone — that made a precise
  per-employee lockout impossible, only a coarse salon-wide throttle. Fixed at the root by adding the
  name-picker step above, which lets `verify_employee_pin` be scoped to one specific `profiles` row
  instead of guessing blind across the whole salon. Three wrong PINs against that profile sets
  `profiles.pin_locked_at` (new column, alongside `failed_pin_attempts`) and the RPC returns
  `locked: true` from then on regardless of PIN correctness — `employee-pin.tsx` shows a distinct
  "gesperrt, bitte wenden Sie sich an Ihren Inhaber" message rather than a generic wrong-PIN error. The
  only way to clear it is an owner-initiated PIN reset (`reset-employee-pin` Edge Function, already
  existed for forgotten PINs — extended to also zero `failed_pin_attempts`/`pin_locked_at`).
  `employees/[id].tsx`'s "Mitarbeiter-PIN" card shows the lock status and the timestamp it was set.

## Core Data Model
- **salons** – multi-tenant root (`salon_code`, billing/tax info, `subscription_status`). The
  `stripe_customer_id`/`stripe_subscription_id`/`subscription_status`/`plan` columns exist in the schema
  but are no longer wired to live Stripe events (see Billing note below) — treat `subscription_status`
  as a plain status flag set however billing actually gets handled, not as something the app keeps in
  sync automatically.
- **profiles** – extends `auth.users` (`role`, `pin_hash`, `color`, `avatar_url`, `has_seen_onboarding`,
  `must_reset_pin`, `failed_pin_attempts`, `pin_locked_at` — see "PIN login lockout" above,
  `sofortmeldung_confirmed_at`, `sofortmeldung_reference`, `ausweis_acknowledged_at`) — the last three are
  owner-only attestations (Schwarzarbeit compliance, see below), not employee-editable.
- **appointments** – `scheduled_start/end` (admin-set) + `actual_start/end` (employee timers); `customer_type: appointment|walkin`; `status: scheduled|in_progress|completed|no_show|cancelled`
- **correction_requests** – GoBD audit trail; originals never overwritten
- **breaks** – lunch/coffee/sick/day_off per employee (`003_breaks.sql`)
- **generated_reports** – archive of every PDF report ever generated (`008_reports_vault.sql`); immutable, owner-only, backed by a private `reports` storage bucket
- **service_categories** – per-salon, seeded on registration
- **employee_working_hours** – per-employee weekly availability (`weekday`/`start_time`/`end_time`,
  `012_working_hours_and_inventory.sql`); owner-managed, exists for the future public booking flow but has
  no UI yet — schema only so far
- **services** – the actual billable, priced line items (e.g. "Schneiden Kurz Damen" €35, "Schneiden Lang
  Herren" €45), grouped under a `service_categories` row for calendar color/grouping —
  `service_categories` itself is unchanged and still drives the calendar as before. Owner-managed via
  `app/(owner)/services/index.tsx`.
- **appointment_services** – junction linking one appointment to one or more `services` (a visit can be
  "cut + color"). Mirrors the pre-existing, previously-undocumented `appointments.service_category_ids`
  array column (discovered live in the DB, not in any migration file — same kind of drift as the duplicate
  timer policies noted below) but for priced services rather than categories.
- **inventory_items** – consumable/professional-use stock bought as a "Gebinde" (a purchase unit — tube,
  bottle, box, whatever it actually is; deliberately not a hardcoded package type). Tracks
  `product_code`/`brand`/`total_qty`/`portions_per_unit`/`purchase_price`/`portion_price`, plus
  `stock_quantity` and `low_stock_threshold` — both **in portions**, not raw ml/g and not whole Gebinde.
  **service_recipes** links a `services` row (not the broad category) to the `inventory_items` it consumes
  per use (`portions_per_use`) — shown in the app as "Produktverbrauch", not "Rezept". An `appointments`
  trigger (keyed off `appointment_services`, looping over every linked service) auto-decrements stock and
  logs a price snapshot to **appointment_material_usage** when status flips to `completed`. Owner-managed
  via `app/(owner)/inventory/index.tsx`. The full loop (add item → set portions/pricing → link via
  Produktverbrauch → complete an appointment → stock deducted + cost logged) is wired end-to-end, not just
  schema. "Fernando" (inventory screen's 4th tab) compiles low-stock items into a printable/shareable
  order list (`utils/pdf.ts`'s `generateAndSharePurchaseList`) and, via the deployed
  `ai-inventory-forecast` Edge Function (`GROQ_API_KEY` secret added 2026-09-03), can ask Groq
  (`llama-3.3-70b-versatile`, JSON-mode response) for a reorder-quantity suggestion per item using actual
  30-day consumption from `appointment_material_usage` — not just the threshold comparison. Falls back to
  the deterministic "1 Gebinde" suggestion if the model call fails or the key is ever missing, so Fernando
  never leaves the owner with nothing.
- **products** – retail stock sold to clients; **appointment_products** attaches sold items to a completed
  visit. Owner-managed via the same inventory screen's "Verkaufsprodukte" tab.

## Key Business Rules
- Concurrent timers per employee; walk-ins start a timer immediately, category picked on stop
- GoBD: no hard deletes on time data; corrections create new rows only. Employees can only touch `actual_start/actual_end/status/notes` on their own appointments — everything else (schedule, client, reassignment) requires the owner or `correction_requests` (enforced by RLS trigger, `004_security_hardening.sql`)
- AZG compliance (`utils/compliance.ts`): warn at 6h without break (30min req.), at 9h (45min), and if <11h since last appointment (Ruhezeit §5)
- Expired/cancelled subscription → read-only mode (view + export still work) — enforced by
  `salon_is_locked()` + split RLS write policies (`010_trial_lock.sql`, applied 2026-09-03; this rule was
  documented for a long time before it was actually built). `011_fix_duplicate_timer_policies.sql` closed
  a gap found while verifying 010: two hand-added, undocumented duplicate policies on `appointments` UPDATE
  would otherwise have let employees keep running timers through the lock.
- Employees only ever see their own data — `profiles_salon_read` (salon-wide profile read) was dropped in `007`; owners still see the full team via `profiles_owner_write`'s `FOR ALL`
- **Schwarzarbeit compliance** (Friseurhandwerk is a legally listed Sofortmeldepflicht-Branche): the app tracks but does not submit — owner attests Sofortmeldung (Zoll) and Ausweispflicht per employee in `employees/[id].tsx`; a warning icon on the employee list flags unconfirmed Sofortmeldung. Actually filing with the Zoll requires ITSG certification, out of scope (same category of problem as KassenSichV/TSE for cash registers, which this app also deliberately does not attempt — it has no POS/cash-register module at all)

## Pricing (informational — billed externally, not in-app)
| Plan | Employees | Price |
|---|---|---|
| Starter | up to 3 | €9.99/mo |
| Pro | unlimited | €19.99/mo |
| Trial | — | 7 days free |

These tiers still describe the employee-limit differentiation between plans, but no in-app checkout
exists or is planned — see the Billing note below.

### Billing note
**No payment functionality lives in this app.** Billing is handled entirely outside it (decided
2026-09-03) — the app itself never collects payment or talks to a payment processor. One open item this
leaves: `supabase/functions/stripe-webhook/index.ts` predates that decision and still exists in the repo
(receives Stripe events, updates `salons.subscription_status`) — it's currently undeployed and not part
of the active plan; whether to delete it or leave it dormant for possible future use hasn't been decided.
A separate, previously-considered idea — the app integrating a card-machine/POS flow so a salon could
charge *its own clients* at appointment completion — was explicitly deferred, not adopted; see
PROJECT-PLAN.md's Open Decisions for the KassenSichV/TSE compliance reasoning behind not building that
casually.

## PDF Reports (Finanzamt/AZG)
`utils/pdf.ts` via `expo-print`. German `ARBEITSZEITNACHWEIS`: Salon + Steuernummer + Adresse header,
employee + date range, table (Datum|Kunde|Beginn|Ende|Dauer|Leistung), total hours + signatures,
footer `GoBD-konform` + timestamp.

## Design & Responsive Layout
**Theme (2026-09-08 rewrite):** `utils/theme.ts`'s `colors` export was flipped from an all-dark surface
(the original "Night Bordeaux" background) to a light/white one — `background: '#FBF7F6'` (near-white),
`surface: '#FFFFFF'` (cards), `text: '#241016'` (near-black). The five named palette colors
(Amaranth/Dark Amaranth/Coral Glow/Sandy Brown/Night Bordeaux) are unchanged in hex value but now used as
**accents** (`primary`, `warning`, `timerActive`, `walkin`) rather than as the base surface. `success`,
`danger`, and `border` were retuned for legible contrast on a light background (e.g. `danger` went from a
bright `#ff6666` meant for dark backgrounds to a darker `#c62839` that reads on white).
Flipping the token *values* automatically fixed every screen that reads `colors.*`, but a number of
screens had **hardcoded hex literals** (not theme tokens) left over from the dark theme — mostly
error/confirmation boxes (`backgroundColor: '#3d0000'` etc., dark maroon meant to sit under bright red
text) and a couple of "selected chip" tints. These were found by grepping for the old dark literals and
fixed individually, screen by screen — search for `#FDE8E8` (the new pale-red error-box background) to
find the pattern now in use across `(auth)/login.tsx`, `(auth)/register.tsx`, `(owner)/employees/index.tsx`,
`(owner)/appointments/{new,[id]}.tsx`, `(owner)/inventory/index.tsx`, `(owner)/reports/index.tsx`, and
`components/ComplianceAlert.tsx`. `app.json`'s splash/adaptive-icon `backgroundColor` and `app/_layout.tsx`'s
`<StatusBar style>` (now `"dark"`) were updated to match. **If a screen still looks dark-on-dark or has
illegible text, it's very likely another leftover hardcoded literal, not a `colors.*` token** — grep for
raw hex codes in that file rather than assuming the theme itself is wrong.

**Responsive layout (2026-09-08):** the app is built RN-flexbox-first, which already reflows correctly on
narrow phone widths, but nothing previously stopped a single mobile-width column from stretching edge to
edge on a tablet/desktop browser (iPad portrait 768px, landscape 1024px+). `utils/theme.ts` now also
exports `layout`:
- `layout.contentWidth` — spread into a screen's outer content/scroll container style; caps width at
  720px and centers it, no-op below that width. Applied to all 19 owner/employee/legal screens' `content`
  (or `list`, for `calendar.tsx`) style.
- `layout.formWidth` — same idea but capped at 440px, for the single-form auth screens
  (`(auth)/login.tsx`'s `card`, `(auth)/register.tsx`'s `scroll`) where a 720px-wide login box would look
  lost. `(auth)/employee-pin.tsx` didn't need this — its keypad already has a fixed width and centers
  itself regardless of viewport.

**Dashboard hover behavior (2026-09-08):** the owner dashboard's per-tile info toggle (small "i" icon,
bottom-right of each card) now also opens on hover, not just tap — but the hover trigger lives on the
**whole card** (`Pressable` with `onHoverIn`/`onHoverOut`), not the small icon itself. An earlier version
put the hover handlers directly on the icon, which is `position: 'absolute', bottom: 10` inside the card —
when the description text appeared, the card grew taller, which moved the icon's absolute-positioned
bottom edge down and out from under a stationary cursor, firing `onHoverOut`, hiding the text, shrinking
the card, moving the icon back under the cursor, re-firing `onHoverIn` — a rapid flicker loop. Triggering
hover on the whole card fixes this (the card's bounds only ever grow while open, never shrink out from
under the cursor) and incidentally gives a much bigger, easier hover target too. **If a future hover
interaction flickers, check whether the hover trigger element itself moves/resizes when the hover state
changes — that's the general shape of this bug, not specific to this one card.**

## Auth Bug Cluster (2026-09-08, found via live user testing on the production build)
A run of real bugs surfaced back-to-back while testing login/logout on `:5050` — different root causes,
same *symptom shape* each time ("nothing visibly happens"), so listed together as one investigation:

1. **Owner login (`login.tsx`) had no navigation on success at all.** `handleLogin()` only had an
   error-handling branch — `signInWithPassword` succeeding just left the user sitting on the form with no
   feedback, indistinguishable from "login doesn't work." Fixed: `router.replace('/')` on success, added
   to the closing of the (pre-existing) `if (error) { ...; return; }` branch so it can't run on a failed
   attempt. **This is a strong hint that owner login had likely never actually been click-through tested
   before this session** — a bug this basic wouldn't have survived a single real login attempt.
2. **Both logout icons (owner dashboard, employee homepage) called `signOut()` with no navigation after
   it either** — same shape as #1, just on the way out instead of in. Fixed: `router.replace('/(auth)/login')`.
3. **The logout fix's first attempt (`router.replace('/')`) had a race condition**, confirmed live
   ("only reverts to login screen on hard refresh"): navigating to `/` re-evaluates `app/index.tsx`'s
   redirect chain immediately, but Zustand's `session`/`profile` clear via `_layout.tsx`'s async
   `onAuthStateChange` listener — on the very next render `index.tsx` can still see the *stale* logged-in
   state and bounce straight back to `/(owner)` before the clear propagates. Fixed by routing logout
   straight to `/(auth)/login` instead of through `/` — there's no gate to check on the way *out*, only
   coming *in* (where routing through `/` is correct, and is what login/register/reset-pin still do).
4. **`title="..."` on `TouchableOpacity` doesn't produce a hover tooltip on React Native Web** — the prop
   isn't forwarded to the DOM the way it is on plain `View`. Fixed by wrapping the `TouchableOpacity` in a
   `View` carrying the `title`, in `HelpButton.tsx` and both logout buttons. If a future web-only DOM
   attribute needs to reach the browser, prefer wrapping in `View` over adding it straight to a
   `Touchable*`/`Pressable`.
5. **The employee PIN screen's Saloncode step used a digits-only custom keypad for an alphanumeric
   value.** `salon_code` is generated as base-36 (`Math.random().toString(36)...toUpperCase()` —
   `register.tsx`) — letters *and* digits (e.g. `X34TEZ`) — but the on-screen keypad only had keys `0`–`9`.
   There was no way to type a letter at all, making any salon code containing one literally impossible to
   enter through the UI. **This is very likely what actually caused the very first employee-login test to
   fail in this session**, before it was mis-diagnosed as a data/credentials issue. Fixed: the Saloncode
   step is now a normal `TextInput` (`autoCapitalize="characters"`, sanitized to `[A-Z0-9]`); the numeric
   keypad is kept only for the PIN step, which is genuinely digits-only by design. Added a "Saloncode
   ändern" link so a wrong code doesn't require restarting the whole screen.
6. **`Alert.alert(...)` on this screen could fail a login silently** — RN Web's `Alert.alert` is known to
   be unreliable (can no-op instead of showing anything), and this was the one auth screen still using it
   instead of the inline-error-box pattern every other auth screen already used. Fixed to match.

**Takeaway for future sessions:** none of these six were caught by code review or static reasoning alone —
every one only surfaced through actual click-through testing against a real build. If touching auth flows
again, the burden of proof is a live test, not "the code looks right."

## Security Hardening (2026-09-08, later the same day as the Auth Bug Cluster above)
Prompted by "the earnings data matters even without personal data attached" — four items, tackled in
priority order:

1. **PIN login rate-limiting → 3-strikes-per-employee lockout.** See "PIN login lockout, 3 strikes" under
   User Roles & Auth above for the full design — this needed an actual login-flow redesign (a
   name-picker step), not just a counter, since the old blind-PIN flow never identified who was
   attempting.
2. **Edge Function CORS was wide open** (`Access-Control-Allow-Origin: '*'` on all three deployed
   functions — `create-employee`, `reset-employee-pin`, `ai-inventory-forecast`). Every function already
   verifies the caller's JWT internally, so this was never directly exploitable without valid
   credentials, but there was no reason to leave it open to every origin on the internet either. Replaced
   with `supabase/functions/_shared/cors.ts` — a small `corsHeaders(origin)` helper that reflects the
   request's `Origin` header back only if it's on an allowlist (`localhost:8081`/`:5050` for dev/local
   production-build testing, `swartschaf.de`/`www.swartschaf.de`, and any `*.netlify.app` for deploy
   previews), falling back to the first allowlist entry otherwise — the standard dynamic-reflection CORS
   pattern (a single hardcoded origin would break local dev/testing; `*` restricts nothing at all). All
   three functions redeployed; verified live with `curl -X OPTIONS` that an allowed origin gets reflected
   back and an arbitrary origin (`evil.example.com`) does not.
3. **`supabase/.temp/` was tracked in git** — added to `.gitignore`. A stray duplicate that had drifted
   into `app/(owner)/inventory/supabase/.temp/` (artifact of an earlier `cd` mistake) was also deleted.
   The already-committed root copy still needs a manual `git rm --cached supabase/.temp -r` to actually
   stop being tracked — not run here, since commits/pushes are the user's own step.
4. **Owner password strength wasn't actually enforced.** `register.tsx`'s password field has always shown
   the placeholder "Mindestens 8 Zeichen", but `handleRegister` only checked the field was non-empty —
   any 1-character password passed. Added an explicit `password.length < 8` check. Left Supabase's
   project-wide Auth password minimum (6 chars) as-is rather than raising it — that floor is shared with
   employee PINs, which are deliberately exactly 6 digits (see "PINs are 6 digits, not 4" above), so
   raising it project-wide would break PIN login; the 8-char rule is enforced client-side, specifically
   for the owner-password field only.

All four verified against a rebuild (`npm run build:web`) before being called done.

## Project Structure
```
app/
  onboarding.tsx  role-specific first-login tutorial slideshow (plain ScrollView carousel, no Reanimated)
  reset-pin.tsx   mandatory PIN-reset gate (employee's own first login) — see Mandatory PIN reset note
  (auth)/         login.tsx, employee-pin.tsx, register.tsx
  (owner)/        index.tsx (dashboard), calendar.tsx (day view),
                  appointments/{new,[id]}.tsx (still category-only — doesn't yet pick specific `services`
                  or write to `appointment_services`, see Known Issues), employees/{index,[id]}.tsx
                  (+ Schwarzarbeit compliance card + owner-initiated PIN reset), corrections.tsx,
                  reports/{index,vault}.tsx, settings.tsx (+ tutorial replay),
                  services/index.tsx (priced service variants),
                  inventory/index.tsx (consumable material + product-usage-per-service + retail products)
  (employee)/     index.tsx (schedule + timers + Laufkunde FAB + tutorial replay), history.tsx, correction.tsx
  legal/          impressum.tsx, datenschutz.tsx, agb.tsx

components/       AppointmentCard.tsx, AvatarPicker.tsx, ComplianceAlert.tsx, HelpButton.tsx (per-page help popup)
hooks/            useActiveAppointments.ts – today's appointments + startTimer/stopTimer/startWalkIn + Realtime
store/            authStore.ts, appointmentStore.ts (Zustand)
utils/            compliance.ts, pdf.ts, dateFormat.ts, theme.ts, helpContent.ts (per-page German help copy),
                  onboardingContent.ts (owner/employee slide content), reportsVault.ts (archive/list/re-share)
lib/              supabase.ts, types.ts

supabase/
  functions/      _shared/cors.ts (origin-allowlist CORS helper, used by all three below),
                  create-employee/ (deployed), reset-employee-pin/ (deployed, owner-initiated PIN reset
                  + lockout clear), ai-inventory-forecast/ (deployed, Fernando),
                  stripe-webhook/ (undeployed, see Billing note)
  migrations/     001_schema.sql, 002_employee_auth.sql, 003_breaks.sql, 004_security_hardening.sql,
                  005_rls_helper_functions_security_definer.sql, 006_avatars_storage.sql,
                  007_profiles_onboarding_and_visibility.sql, 008_reports_vault.sql,
                  009_schwarzarbeit_compliance.sql, 010_trial_lock.sql,
                  011_fix_duplicate_timer_policies.sql, 012_working_hours_and_inventory.sql,
                  013_inventory_portions_and_costing.sql, 014_services_and_recipe_linking.sql,
                  015_appointment_services_junction.sql, 016_employee_pin_reset.sql,
                  017_pin_login_rate_limit.sql
                  — 001–017 applied
```

## Environment Variables
```
EXPO_PUBLIC_SUPABASE_URL=https://norktuyfqdfhhekldbwj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<in .env>

SUPABASE_SERVICE_ROLE_KEY=                 # Edge Functions only — Supabase Dashboard secrets
GROQ_API_KEY=                              # Edge Functions only — added directly in Supabase Dashboard
                                            # 2026-09-03, used by ai-inventory-forecast (Fernando)
```
No Stripe/payment env vars — no in-app payment functionality (see Billing note above). The three
Stripe-shaped vars formerly listed here (`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`) would only matter again if `stripe-webhook` is ever deployed.

## Build & Run
```bash
npm install                       # SDK 56 + React 19 align cleanly, no flags needed
npx expo start                    # dev server (Expo Go does not support SDK 56 yet — use web or a dev client)
npx expo start --web
npm run build:web                 # → dist/ (Netlify auto-deploys on push)
```

### EAS Build & Submit
Not currently used — distribution is web-only (see Overview). Kept for reference only, in case native
distribution is ever reconsidered:
```bash
eas build --platform all --profile production
eas submit --platform ios
eas submit --platform android
```

### Deploy Edge Functions
```bash
supabase functions deploy create-employee --project-ref norktuyfqdfhhekldbwj
```
Then add `SUPABASE_SERVICE_ROLE_KEY` in Supabase Dashboard → Edge Functions → Secrets.
`stripe-webhook` is deliberately not in this list — see the Billing note above.

## Status

**2026-09-08 session, part 2 (security hardening).** Later the same day as the UI pass below: a
4-item security pass covering PIN-login rate-limiting (redesigned into a 3-strikes-per-employee lockout,
which required adding a name-picker step to the login flow), Edge Function CORS (wide-open `'*'` replaced
with an origin allowlist, all three functions redeployed and verified live), `supabase/.temp/` untracked,
and the owner-password 8-char minimum actually enforced (was only promised in a placeholder before). Ran
migration `017_pin_login_rate_limit.sql`. See "Security Hardening" above for the full detail — this is
just the index.

**2026-09-08 session, part 1.** UI pass on top of 09-03's build: flipped the color theme from dark to light
(same "Night Bordeaux → Sandy Brown" palette, now used as accents on a white/off-white base instead of as
the dark background), made the app responsive for tablet/desktop-width browsers, fixed a hover-flicker
bug on the owner dashboard, narrowed the owner-session-invalidation bug (confirmed NOT caused by employee
creation alone, against a real production build), and built mandatory PIN reset on an employee's first
login (plus owner-initiated reset) — which along the way surfaced and fixed a real pre-existing bug where
`register.tsx`/`employee-pin.tsx` bypassed `app/index.tsx`'s redirect chain entirely, and forced PINs from
4 to 6 digits (Supabase Auth's password-length policy). See "Design & Responsive Layout" and "Mandatory
PIN reset on first login" below for the full detail — this is just the index.

**2026-09-03 session.** In one session: dropped Stripe/subscription billing
entirely (now external), applied a new warm "Night Bordeaux → Sandy Brown" color palette throughout, ran
migrations 007–015 (trial-lock enforcement + the entire inventory/services data model), and built
inventory end-to-end including a real AI feature (Fernando). Full detail is in the migration files
themselves and the Core Data Model / Billing note / Known Issues sections above — this is just the index.

**Done (all-time):** schema/RLS (001–015, applied), security hardening, auth flows, employee homepage +
concurrent timers, walk-ins, AZG alerts, owner dashboard + calendar tab, appointments CRUD, corrections
flow, PDF reports (+ purchase-list export), avatar upload UI, legal pages, Netlify config, SDK 56 upgrade,
branding/theme (**Night Bordeaux → Sandy Brown palette** — originally an all-dark theme, **flipped to
light/white with the palette as accents on 2026-09-08**, see "Design & Responsive Layout"), Resend
SMTP + DNS, `create-employee` Edge Function (**deployed**), onboarding tutorial, per-page help popups,
report vault (archive + re-share), Schwarzarbeit compliance tracking, trial-lock enforcement
(read-only-on-expiry is now real, not just documented), employee working hours *(schema only, no UI)*,
**priced services** (`services/index.tsx`), **inventory** — consumable stock with Gebinde-based costing +
Produktverbrauch (recipes) + retail products, all with owner CRUD (`inventory/index.tsx`), the
completion-time "which services were rendered" flow (employee homepage + owner appointment detail) that
actually drives stock deduction and cost logging, and **Fernando** — an AI-powered (Groq,
`ai-inventory-forecast` Edge Function, **deployed**) reorder-list assistant with a deterministic fallback.
Also: **security hardening pass** — per-employee 3-strikes PIN lockout, Edge Function CORS origin
allowlist, `supabase/.temp/` untracked, owner-password length actually enforced (see "Security
Hardening").

**In progress:** none of v1's original launch checklist is blocking — see Pending below for what's left of
it. The bigger open thread is v2: Phase C (inventory) is essentially done, Phase D.1 (AI) has its first
real feature shipped (Fernando), **Phase B (booking) hasn't been started**. See
[PROJECT-PLAN.md](PROJECT-PLAN.md) for the full phase breakdown.

**Immediate next steps (pick one, per Known Issues below):**
- [ ] Wire `appointments/new.tsx` (owner scheduling form) to optionally pick specific `services`, not just
      the broad category — currently only the *completion*-time flow populates `appointment_services`.
- [ ] Start Phase B (public booking) — genuinely untouched so far.
- [ ] Investigate the owner-session-invalidation bug (see Known Issues) — still unfixed, still real.
- [ ] Reconcile schema drift: run `supabase db diff` / a schema dump against migrations 001–015 to confirm
      there's nothing else undocumented beyond the two cases already found and fixed.

**Remaining v1 launch checklist (small, not urgent — day-to-day dev continues regardless):**
- [ ] Smoke-test: run through [TESTCASES.md](TESTCASES.md) (manual QA checklist derived from this file,
      added 2026-09-08 — no automated test suite exists yet)
- [ ] `git push -u origin main`
- [ ] `git rm --cached -r supabase/.temp` (now gitignored, but the already-committed copy needs this
      manually to actually stop being tracked — see "Security Hardening")
- [ ] Steuernummer in `app/legal/impressum.tsx` (currently placeholder)
- [ ] Connect swartschaf.de to Netlify + confirm SSL

**Not pursuing (web-only distribution decision):** iOS/Android store submission is out of scope — no EAS
build/submit, no publisher rename, no TestFlight/Google Play Internal Testing/store listings. Kept here
for context in case that decision is ever revisited, not as open work:
- Publisher rename from "Lalaland Studios" to "Ladebeer Studios" was researched (no conflicts found for
  "Ladebeer"/"Ladebeer Studios" in a web search, unlike earlier candidates) but never executed. Google
  Play would have been self-service (Play Console → Settings → Developer account → Store settings →
  "Developer name"). Apple was a dead end on the current account: App Store Connect's Business/Agreements
  page confirmed the account is enrolled as an **Individual** (legal name "Illana De Beer", W-8BEN tax
  form) — the Seller Name is locked to the personal legal name on that account type, no in-place rename
  possible; the only path would have been a new Organization account + app-transfer.

- ~~**Owner session gets invalidated when adding an employee**~~ **Narrowed 2026-09-08 — creating an
  employee alone does NOT break the owner session**, confirmed live against the production build
  (`npm run build:web`, served standalone, no dev server/HMR in the mix): owner created a Mitarbeiter, the
  admin session stayed open and intact. This means the original report was never "employee creation
  breaks the session" by itself.
  Investigation trail, for whoever picks this back up: ruled out no rogue `setProfile`/`signOut`/`clear()`
  calls anywhere, no duplicate `createClient()` in the shipped code (only `lib/supabase.ts`'s singleton),
  and `create-employee` runs entirely server-side via the service-role key, isolated from the browser.
  Also disabled `detectSessionInUrl` (was `true` on web with no OAuth/magic-link/password-reset flow in
  the app to justify it — unnecessary risk, harmless to remove regardless of whether it was ever the
  cause). Separately, live in the *dev server only*, Fast Refresh re-evaluating `lib/supabase.ts` on hot
  reload was observed spawning a second `GoTrueClient` instance ("Multiple GoTrueClient instances detected
  in the same browser context") — real, but Fast Refresh doesn't exist in a production build, so it can't
  explain a production bug and wasn't the cause of the confirmed-clean result above either way.
  **Leading remaining theory, not yet tested:** the browser holds exactly one Supabase session per
  storage key (`sb-norktuyfqdfhhekldbwj-auth-token`) — testing a newly-created employee's PIN login in the
  *same browser tab* right after creating them would legitimately overwrite the owner's session via that
  same key (`employee-pin.tsx`'s `signInWithPassword` call does exactly that). If that's what the original
  report actually saw, it's a testing-workflow trap (use a separate/incognito window to test employee
  login), not a code bug to fix. **Still needs:** that one specific test, to close this out for good — has
  not been tried yet.
- ~~The employee login screen is a two-step flow (Saloncode, 6 chars → PIN, 4 digits) that reads as
  confusing if the step change isn't noticed.~~ **Resolved as a side effect, 2026-09-08**: PINs are now 6
  digits too (see "Mandatory PIN reset on first login" above — the change was forced by Supabase's Auth
  password-length policy rejecting a 4-character password on the reset path, not originally motivated by
  this UX note, but it happens to fix it too). Both steps are 6 characters now, so there's no digit-count
  mismatch left to be confused by.
- **Schema drift: the live DB has had objects not captured in any migration file, twice now.** First:
  two duplicate, lock-bypassing policies on `appointments` UPDATE (fixed by `011`). Second: a live
  `appointments.service_category_ids uuid[]` column, already written to by
  `app/(owner)/appointments/new.tsx`'s multi-select, that no migration file ever created — discovered
  while building the services/inventory feature (2026-09-03). Neither was destructive, but both mean the
  migration files can't be fully trusted as the source of truth for the live schema — worth an explicit
  `supabase db diff`/schema-dump reconciliation pass at some point rather than assuming migrations 001-015
  are the complete picture.
- **`appointments/new.tsx` (scheduling, owner) still only picks a broad category**, not a specific priced
  `service` — that's fine, it's just what's planned, not what was rendered. The actual billing/consumption
  chain now runs at *completion* time instead, which is more correct anyway (what got done can differ from
  what was booked): both `hooks/useActiveAppointments.ts`'s `stopTimer` (employee homepage) and
  `app/(owner)/appointments/[id].tsx`'s stop-timer flow now prompt "which services were rendered" (optional
  — skippable if a salon hasn't set up `services` yet), write to `appointment_services`, *then* flip status
  to `completed` — order matters, since the inventory-decrement trigger fires on that same UPDATE and reads
  whatever `appointment_services` rows exist at that moment.

### Considered, not yet decided
- Replacing the shared `salon_code` employee-login step with a unique **per-employee code** (generated at creation, stored on `profiles`, shown to the owner once) instead of every employee typing the same salon-wide code + their PIN. Would also resolve the two-step confusion above. Not implemented — needs a decision on whether it replaces `salon_code` entirely or supplements it before building (touches the schema, `create-employee` Edge Function, `verify_employee_pin` RPC, and `employee-pin.tsx`).
- Confirmed `salon_code` itself does not need to be owner-editable — it's already random + `UNIQUE NOT NULL` per salon at registration (`register.tsx`), which is sufficient.

### Notes
- SSL workaround for this terminal: `$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"`
- Email confirmation is OFF in Supabase — leave off until Edge Function handles post-confirm profile creation
- Settings → Abonnement → Saloncode now has an inline info toggle (ℹ️) explaining the two-step login to owners

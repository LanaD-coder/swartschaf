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
covers the current app's architecture and day-to-day build status; PROJECT-PLAN.md is the forward roadmap.

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
- **Employee**: own appointments, start/stop timers, walk-ins, correction requests. 2-step PIN login:
  1. `verify_employee_pin(p_salon_code, p_pin)` — SECURITY DEFINER RPC, no session needed, returns `user_id`/`full_name`/`salon_id`.
  2. `supabase.auth.signInWithPassword({ email: emp_<user_id>@swartschaf.internal, password: pin })` — gives a real JWT session so RLS works.
- Employee `auth.users` rows are created by the `create-employee` Edge Function (service role). Internal email is never shown in the UI. A Zustand-only session has no JWT, so this Edge Function + PIN pattern is required for RLS to work at all.
- PINs are bcrypt-hashed (`pin_hash`, via `pgcrypto`) — see `004_security_hardening.sql`.

## Core Data Model
- **salons** – multi-tenant root (`salon_code`, billing/tax info, `subscription_status`). The
  `stripe_customer_id`/`stripe_subscription_id`/`subscription_status`/`plan` columns exist in the schema
  but are no longer wired to live Stripe events (see Billing note below) — treat `subscription_status`
  as a plain status flag set however billing actually gets handled, not as something the app keeps in
  sync automatically.
- **profiles** – extends `auth.users` (`role`, `pin_hash`, `color`, `avatar_url`, `has_seen_onboarding`,
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
| Trial | — | 14 days free |

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

## Project Structure
```
app/
  onboarding.tsx  role-specific first-login tutorial slideshow (plain ScrollView carousel, no Reanimated)
  (auth)/         login.tsx, employee-pin.tsx, register.tsx
  (owner)/        index.tsx (dashboard), calendar.tsx (day view),
                  appointments/{new,[id]}.tsx (still category-only — doesn't yet pick specific `services`
                  or write to `appointment_services`, see Known Issues), employees/{index,[id]}.tsx
                  (+ Schwarzarbeit compliance card), corrections.tsx, reports/{index,vault}.tsx,
                  settings.tsx (+ tutorial replay), services/index.tsx (priced service variants),
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
  functions/      create-employee/ (deployed), ai-inventory-forecast/ (deployed, Fernando),
                  stripe-webhook/ (undeployed, see Billing note)
  migrations/     001_schema.sql, 002_employee_auth.sql, 003_breaks.sql, 004_security_hardening.sql,
                  005_rls_helper_functions_security_definer.sql, 006_avatars_storage.sql,
                  007_profiles_onboarding_and_visibility.sql, 008_reports_vault.sql,
                  009_schwarzarbeit_compliance.sql, 010_trial_lock.sql,
                  011_fix_duplicate_timer_policies.sql, 012_working_hours_and_inventory.sql,
                  013_inventory_portions_and_costing.sql, 014_services_and_recipe_linking.sql,
                  015_appointment_services_junction.sql
                  — 001–015 applied
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

**2026-09-03 session — start here tomorrow.** In one session: dropped Stripe/subscription billing
entirely (now external), applied a new warm "Night Bordeaux → Sandy Brown" color palette throughout, ran
migrations 007–015 (trial-lock enforcement + the entire inventory/services data model), and built
inventory end-to-end including a real AI feature (Fernando). Full detail is in the migration files
themselves and the Core Data Model / Billing note / Known Issues sections above — this is just the index.

**Done (all-time):** schema/RLS (001–015, applied), security hardening, auth flows, employee homepage +
concurrent timers, walk-ins, AZG alerts, owner dashboard + calendar tab, appointments CRUD, corrections
flow, PDF reports (+ purchase-list export), avatar upload UI, legal pages, Netlify config, SDK 56 upgrade,
branding/theme (**Night Bordeaux → Sandy Brown palette, replaces the old dark-purple/mauve one**), Resend
SMTP + DNS, `create-employee` Edge Function (**deployed**), onboarding tutorial, per-page help popups,
report vault (archive + re-share), Schwarzarbeit compliance tracking, trial-lock enforcement
(read-only-on-expiry is now real, not just documented), employee working hours *(schema only, no UI)*,
**priced services** (`services/index.tsx`), **inventory** — consumable stock with Gebinde-based costing +
Produktverbrauch (recipes) + retail products, all with owner CRUD (`inventory/index.tsx`), the
completion-time "which services were rendered" flow (employee homepage + owner appointment detail) that
actually drives stock deduction and cost logging, and **Fernando** — an AI-powered (Groq,
`ai-inventory-forecast` Edge Function, **deployed**) reorder-list assistant with a deterministic fallback.

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
- [ ] Smoke-test: employee PIN login under the tightened profile RLS, vault archive/re-share round-trip, onboarding first-login/skip/replay, Sofortmeldung/Ausweispflicht confirm actions
- [ ] `git push -u origin main`
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

### Known Issues
- **Owner session gets invalidated when adding an employee** (web browser, `create-employee` Edge Function deployed): after creating an employee via the "Mitarbeiter" screen, the owner's profile/dashboard stats go blank and a fresh login is required — confirmed this is a real session loss (not just a stale-render bug), since reloading did not recover it. Ruled out so far: no rogue `setProfile` call anywhere in the app (grepped all call sites — only `app/_layout.tsx`'s `loadProfile`, `AvatarPicker`, and `onboarding.tsx` ever call it), and the `create-employee` Edge Function's admin client runs server-side via the service-role key, isolated from the browser session. Still needs: reproduce with browser DevTools open (Network + Console) to see what auth event actually fires, and check whether testing the new employee's PIN login in the *same browser tab* right after creating them is what's overwriting the owner's session in shared `localStorage` (both would use the same Supabase client/storage key on web).
- The employee login screen (`employee-pin.tsx`) is a **two-step** flow (Saloncode, 6 chars → PIN, 4 digits) that reads as confusing ("PIN asks for 6 digits") if the step change isn't noticed. Not a bug, but flagged as a real UX pain point.
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

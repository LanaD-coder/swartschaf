# Swartschaf – Zeiterfassungs-App für Beauty-Salons

> **Slogan:** *Zeit für das schwarze Schaf.*
> **Expo Project ID:** `497702e9-b5a2-494e-9981-bcce2d4824af` | **ASC App ID:** `6783376086` | **Apple Team:** `CM82SUJ92U`

## Overview
SaaS time-tracking app for German beauty salons (**swartschaf.de**). Owners subscribe via Stripe,
configure their salon, add employees. The day runs from an admin-only calendar; each employee has a
homepage with personal Start/Stop timers (multiple can run concurrently, e.g. highlights + washing
another client). Walk-ins (`Laufkunde`) can be logged instantly by any employee. All time data is
GoBD-compliant and exportable as German `Arbeitszeitnachweis` PDFs for the Finanzamt.

## Stack
| Layer | Technology |
|---|---|
| App | Expo SDK 56 + Expo Router v5 (iOS, Android, Web) |
| Backend | Supabase (Auth, Postgres, Edge Functions, Realtime) |
| Hosting | Netlify (`expo export --platform web` → `dist/`) |
| Payments | Stripe Checkout + Customer Portal + webhooks |
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
- **salons** – multi-tenant root (`salon_code`, Stripe + tax info, `subscription_status`)
- **profiles** – extends `auth.users` (`role`, `pin_hash`, `color`, `avatar_url`, `has_seen_onboarding`,
  `sofortmeldung_confirmed_at`, `sofortmeldung_reference`, `ausweis_acknowledged_at`) — the last three are
  owner-only attestations (Schwarzarbeit compliance, see below), not employee-editable.
- **appointments** – `scheduled_start/end` (admin-set) + `actual_start/end` (employee timers); `customer_type: appointment|walkin`; `status: scheduled|in_progress|completed|no_show|cancelled`
- **correction_requests** – GoBD audit trail; originals never overwritten
- **breaks** – lunch/coffee/sick/day_off per employee (`003_breaks.sql`)
- **generated_reports** – archive of every PDF report ever generated (`008_reports_vault.sql`); immutable, owner-only, backed by a private `reports` storage bucket
- **service_categories** – per-salon, seeded on registration

## Key Business Rules
- Concurrent timers per employee; walk-ins start a timer immediately, category picked on stop
- GoBD: no hard deletes on time data; corrections create new rows only. Employees can only touch `actual_start/actual_end/status/notes` on their own appointments — everything else (schedule, client, reassignment) requires the owner or `correction_requests` (enforced by RLS trigger, `004_security_hardening.sql`)
- AZG compliance (`utils/compliance.ts`): warn at 6h without break (30min req.), at 9h (45min), and if <11h since last appointment (Ruhezeit §5)
- Expired/cancelled subscription → read-only mode (view + export still work)
- Employees only ever see their own data — `profiles_salon_read` (salon-wide profile read) was dropped in `007`; owners still see the full team via `profiles_owner_write`'s `FOR ALL`
- **Schwarzarbeit compliance** (Friseurhandwerk is a legally listed Sofortmeldepflicht-Branche): the app tracks but does not submit — owner attests Sofortmeldung (Zoll) and Ausweispflicht per employee in `employees/[id].tsx`; a warning icon on the employee list flags unconfirmed Sofortmeldung. Actually filing with the Zoll requires ITSG certification, out of scope (same category of problem as KassenSichV/TSE for cash registers, which this app also deliberately does not attempt — it has no POS/cash-register module at all)

## Stripe Plans
| Plan | Employees | Price |
|---|---|---|
| Starter | up to 3 | €9.99/mo |
| Pro | unlimited | €19.99/mo |
| Trial | — | 14 days free |

Webhook (`supabase/functions/stripe-webhook/index.ts`) updates `salons.subscription_status`.

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
                  appointments/{new,[id]}.tsx, employees/{index,[id]}.tsx (+ Schwarzarbeit compliance card),
                  corrections.tsx, reports/{index,vault}.tsx, settings.tsx (+ tutorial replay)
  (employee)/     index.tsx (schedule + timers + Laufkunde FAB + tutorial replay), history.tsx, correction.tsx
  legal/          impressum.tsx, datenschutz.tsx, agb.tsx

components/       AppointmentCard.tsx, AvatarPicker.tsx, ComplianceAlert.tsx, HelpButton.tsx (per-page help popup)
hooks/            useActiveAppointments.ts – today's appointments + startTimer/stopTimer/startWalkIn + Realtime
store/            authStore.ts, appointmentStore.ts (Zustand)
utils/            compliance.ts, pdf.ts, dateFormat.ts, theme.ts, helpContent.ts (per-page German help copy),
                  onboardingContent.ts (owner/employee slide content), reportsVault.ts (archive/list/re-share)
lib/              supabase.ts, types.ts

supabase/
  functions/      create-employee/, stripe-webhook/
  migrations/     001_schema.sql, 002_employee_auth.sql, 003_breaks.sql, 004_security_hardening.sql,
                  005_rls_helper_functions_security_definer.sql, 006_avatars_storage.sql,
                  007_profiles_onboarding_and_visibility.sql, 008_reports_vault.sql,
                  009_schwarzarbeit_compliance.sql
                  — 001–006 applied; 007–009 written but NOT yet run in Supabase SQL Editor
```

## Environment Variables
```
EXPO_PUBLIC_SUPABASE_URL=https://norktuyfqdfhhekldbwj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<in .env>
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=        # add when Stripe is set up

SUPABASE_SERVICE_ROLE_KEY=                 # Edge Functions only — Supabase Dashboard secrets
STRIPE_SECRET_KEY=                         # Edge Functions only
STRIPE_WEBHOOK_SECRET=                     # Edge Functions only
```

## Build & Run
```bash
npm install                       # SDK 56 + React 19 align cleanly, no flags needed
npx expo start                    # dev server (Expo Go does not support SDK 56 yet — use web or a dev client)
npx expo start --web
npm run build:web                 # → dist/ (Netlify auto-deploys on push)
```

### EAS Build & Submit
```bash
eas build --platform all --profile production
eas submit --platform ios
eas submit --platform android
```

### Deploy Edge Functions
```bash
supabase functions deploy create-employee --project-ref norktuyfqdfhhekldbwj
supabase functions deploy stripe-webhook  --project-ref norktuyfqdfhhekldbwj
```
Then add `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Supabase Dashboard → Edge Functions → Secrets.

## Status
**Done:** schema/RLS (001–006, applied), security hardening, auth flows, employee homepage + concurrent
timers, walk-ins, AZG alerts, owner dashboard + calendar tab, appointments CRUD, corrections flow, PDF
reports, avatar upload UI, legal pages, Netlify config, SDK 56 upgrade, branding/theme, Resend SMTP + DNS,
create-employee Edge Function code (not yet deployed), onboarding tutorial, per-page help popups, report
vault (archive + re-share), Schwarzarbeit compliance tracking (Sofortmeldung/Ausweispflicht) — code for
these last four is written but migrations 007–009 haven't been run yet (see below).

**In progress:** iOS/Android build + store submission.

**Pending:**
- [ ] Run migrations `007`–`009` in Supabase SQL Editor (onboarding flag + profile lockdown, report vault, Schwarzarbeit compliance fields) — see file headers for what each does
- [ ] Smoke-test after running them: employee PIN login still works under the tightened profile RLS, vault archive/re-share round-trip on native, onboarding first-login/skip/replay, Sofortmeldung/Ausweispflicht confirm actions
- [ ] Rename publisher from "Lalaland Studios" to "Ladebeer Studios" on Apple + Google (see Publisher Rename below)
- [ ] Deploy `create-employee` + `stripe-webhook` Edge Functions (add service-role/Stripe secrets first)
- [ ] Store listings: expo.dev build status, TestFlight, Google Play Internal Testing, screenshots/descriptions (German), content rating
- [ ] `git push -u origin main`
- [ ] Steuernummer in `app/legal/impressum.tsx` (currently placeholder)
- [ ] Connect swartschaf.de to Netlify + confirm SSL
- [ ] Stripe: create account + Starter/Pro products, wire keys into Netlify/.env + Edge Function secrets, wire Checkout into `register.tsx`/`settings.tsx`

### Publisher Rename (Lalaland Studios → Ladebeer Studios)
- No conflicts found in a web search for "Ladebeer"/"Ladebeer Studios" (unlike earlier name candidates, which had domain/trademark collisions) — still confirm `ladebeer.de`/`.com` availability and check the DPMA/EUIPO trademark registers before committing.
- **Google Play**: self-service — Play Console → Settings → Developer account → Store settings → "Developer name". If the account is Organization-verified, a legal name change may require re-uploading business documents; otherwise it's just a text field + routine review.
- **Apple**: confirmed via App Store Connect's Business/Agreements page that the account is enrolled as an **Individual** (legal name "Illana De Beer", W-8BEN tax form) — the Seller Name is locked to the personal legal name on this account type, no in-place rename possible. Path forward: enroll a **new Organization account** under "Ladebeer Studios" with its own D-U-N-S number, then transfer the Swartschaf app to it via App Store Connect's app-transfer feature (new $99/year membership).

### Known Issues
- **Owner session gets invalidated when adding an employee** (web browser, `create-employee` Edge Function deployed): after creating an employee via the "Mitarbeiter" screen, the owner's profile/dashboard stats go blank and a fresh login is required — confirmed this is a real session loss (not just a stale-render bug), since reloading did not recover it. Ruled out so far: no rogue `setProfile` call anywhere in the app (grepped all call sites — only `app/_layout.tsx`'s `loadProfile`, `AvatarPicker`, and `onboarding.tsx` ever call it), and the `create-employee` Edge Function's admin client runs server-side via the service-role key, isolated from the browser session. Still needs: reproduce with browser DevTools open (Network + Console) to see what auth event actually fires, and check whether testing the new employee's PIN login in the *same browser tab* right after creating them is what's overwriting the owner's session in shared `localStorage` (both would use the same Supabase client/storage key on web).
- The employee login screen (`employee-pin.tsx`) is a **two-step** flow (Saloncode, 6 chars → PIN, 4 digits) that reads as confusing ("PIN asks for 6 digits") if the step change isn't noticed. Not a bug, but flagged as a real UX pain point.

### Considered, not yet decided
- Replacing the shared `salon_code` employee-login step with a unique **per-employee code** (generated at creation, stored on `profiles`, shown to the owner once) instead of every employee typing the same salon-wide code + their PIN. Would also resolve the two-step confusion above. Not implemented — needs a decision on whether it replaces `salon_code` entirely or supplements it before building (touches the schema, `create-employee` Edge Function, `verify_employee_pin` RPC, and `employee-pin.tsx`).
- Confirmed `salon_code` itself does not need to be owner-editable — it's already random + `UNIQUE NOT NULL` per salon at registration (`register.tsx`), which is sufficient.

### Notes
- SSL workaround for this terminal: `$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"`
- Email confirmation is OFF in Supabase — leave off until Edge Function handles post-confirm profile creation
- Settings → Abonnement → Saloncode now has an inline info toggle (ℹ️) explaining the two-step login to owners

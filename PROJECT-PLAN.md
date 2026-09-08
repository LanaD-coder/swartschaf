# Project: Swartschaf — AI-Powered Salon Operations Platform

**Goal:** Evolve Swartschaf from an internal time-tracking tool into a sellable, multi-tenant SaaS for
German beauty salons — booking + inventory + time-tracking + AI — while doubling as the flagship
portfolio project for job applications (marketing tech / e-commerce / logistics software roles in
Germany).

**Candidate context:** Career-changer, background in marketing & logistics, fullstack diploma, fluent
German + English. Compared to a generic mini-store demo, a real multi-tenant SaaS with GoBD/AZG legal
compliance and genuine German-market domain depth is a substantially stronger interview story — this
plan supersedes the standalone E-Shopperce roadmap as the primary portfolio piece. E-Shopperce itself
stays untouched as a separate, smaller CV entry; nothing here modifies that repo.

**Billing:** no payment functionality lives in the app — billing is handled entirely outside it (decided
2026-09-03). See CLAUDE.md's Billing note for what that means for the pre-existing `stripe-webhook`
function and for the deferred card-machine/POS idea.

**Sales & onboarding model (decided 2026-09-03):** each new customer is a white-glove, week-long pilot,
not self-service signup. The flow: the salon owner registers via the existing `register.tsx` (personally
run by the vendor — you — on the customer's behalf, using details the customer supplies: employee list,
working hours, and their inventory), gets a 7-day trial (`salons.trial_ends_at`, which already exists in
the schema, default `now() + 14 days` — worth changing that default to 7 to match the pilot length), and
uses the app normally during that window. If the customer doesn't pay by then, the salon locks to
**read-only** (view + PDF export still work, nothing else) — this rule was already *documented* in
CLAUDE.md's Key Business Rules but, confirmed by grep, never actually *enforced* anywhere; that
enforcement is what Phase A.5 below builds. Unlocking is manual: you flip `subscription_status` to
`'active'` directly in Supabase (table editor or a one-line SQL snippet) once paid outside the app — no
in-app billing UI, consistent with the Billing note above. No new "vendor/reseller" role or cross-tenant
admin tooling is needed for any of this: registering as each customer's owner via the existing flow, then
handing off/resetting those credentials once they're paid, covers it. Each sale = one new `salons` row,
already fully isolated by the existing multi-tenant RLS — nothing new required there either.

**Relationship to the existing Swartschaf codebase:** this is additive. The current app (calendar,
employee timers, walk-ins, corrections, PDF reports) is the foundation — see
[CLAUDE.md](CLAUDE.md) for its architecture and current build status. Nothing below replaces it; Booking
and Inventory are new modules bolted onto the same `salons`-scoped multi-tenant model, and AI features
are woven into each module rather than shipped as a separate bolt-on phase.

**Distribution decision: web-only, no native app stores.** Google Play's testing/review requirements were
judged too slow for this product's timeline. Swartschaf drops iOS/Android store submission entirely and
ships as a web product (`npm run build:web` → Netlify). This does **not** require leaving Expo/React
Native — Expo already exports a web build, and the current codebase (timers, PIN auth, PDF export,
calendar) already runs on web with no native-only dependencies (per CLAUDE.md's excluded-package list).
Rewriting onto a plain Vite/React stack was considered and rejected: it would burn effort re-implementing
working functionality for no functional gain, now that native distribution was the only reason to be on
Expo in the first place. Native builds remain possible later if store distribution is ever reconsidered —
going web-only now doesn't foreclose that.

**Sequencing decision:** Phase A (unblock the current base, web-only scope — see below) ships first as
v1. Everything in this document is v2 and starts only after that. **Superseded 2026-09-03**: the original
plan was Booking before Inventory; the user explicitly chose to finish Inventory first instead ("one
section at a time"), which is what actually happened — Phase C (+ D.1's Fernando) is done, Phase B hasn't
been started at all. AI capabilities were built alongside Inventory as originally intended, not saved for
the end.

---

## 0. Phase A — Unblock the Current Base (prerequisite, not new scope)

Store-submission work is dropped from scope entirely: no EAS build/submit, no publisher rename
(Lalaland→Ladebeer), no TestFlight, no Google Play Internal Testing, no store listings/screenshots/content
rating. What's left to ship v1 on the web:

- [ ] Run migrations `007`–`009` in Supabase SQL Editor, then smoke-test (employee PIN login under
      tightened profile RLS, vault archive/re-share, onboarding flows, Sofortmeldung/Ausweispflicht
      confirm actions) — see CLAUDE.md's "Pending" list for detail.
- [ ] Deploy `create-employee` Edge Function (service-role secret first). `stripe-webhook` is deliberately
      excluded — see CLAUDE.md's Billing note.
- [ ] Steuernummer in `app/legal/impressum.tsx` (currently placeholder).
- [ ] Connect swartschaf.de to Netlify + confirm SSL.
- [x] Investigate the known owner-session-invalidation bug — narrowed 2026-09-08: creating an employee
      alone does NOT break the owner session (confirmed live against a production build). One remaining
      test not yet tried: whether testing the new employee's PIN login in the *same browser tab* right
      after is what actually causes it (see CLAUDE.md's "Known Issues" for the full trail). Safe to rely
      on the employee-creation flow for onboarding; just don't test the new login in the same tab yet.

Nothing in the phases below starts until this list is done.

## 0.5 Phase A.5 — Trial-Lock Enforcement (new, precedes Booking/Inventory)

Directly needed by the sales model above, so it comes before Booking/Inventory rather than after. Adds:
- A `salon_is_locked()` SECURITY DEFINER helper (`subscription_status <> 'active' AND now() > trial_ends_at`),
  same pattern as `current_salon_id()`/`get_user_role()` in `005_rls_helper_functions_security_definer.sql`.
- Splits every owner-side `FOR ALL` write policy (`profiles_owner_write`, `categories_owner_write`,
  `appointments_owner_all`, `corrections_owner_all`) into an unrestricted `FOR SELECT` plus
  lock-checked `FOR INSERT`/`FOR UPDATE`/`FOR DELETE` policies — Postgres RLS policies for the same
  command are OR'd together, so the lock check has to replace the permissive `FOR ALL`, not just add
  alongside it, or it'd have no effect. `breaks_own_all` gets the same split, gated by the break's own
  `salon_id`. `salons.salon_owner_all` is deliberately **not** gated — editing salon metadata (name,
  address) isn't the "keep using the service" behavior the lock is meant to stop, and the owner needs to
  stay able to see their own row regardless.
- Change `trial_ends_at`'s default from `now() + 14 days` to `now() + 7 days` to match the pilot length
  (only affects new salons; doesn't touch existing rows).

This is a wider RLS surface change than 007–009 was (rewrites several existing write policies rather than
only adding new tables), so it gets written up and reviewed before being run, not run immediately.

**Status: done (2026-09-03).** Applied as `010_trial_lock.sql` + `011_fix_duplicate_timer_policies.sql`
(the latter closing a gap found during verification — two hand-added, undocumented policies on
`appointments` that would have let employees bypass the lock). The `employee_working_hours` /
`inventory_items` / `service_recipes` / `products` / `appointment_products` schema from section 2 below is
also now applied (`012_working_hours_and_inventory.sql`), including the auto-decrement trigger — but only
the schema; no admin UI exists yet for any of it (working hours, inventory, or recipes).

---

## 1. Tech Stack Additions

| Layer | Choice | Why |
|---|---|---|
| AI provider | Groq (Llama 3.1) or Google Gemini, free tier to start | Fast + free during build; revisit pricing/rate-limits per tenant before charging real customers |
| AI compute | New Supabase Edge Functions (`ai-inventory-forecast`, `ai-query`, `ai-compliance-chat`, `ai-generate-description`, `ai-sentiment`) | Same pattern as the existing `create-employee` function — service-role isolated, never called with a client-side API key |
| Vector store (Phase 5 only) | Supabase `pgvector` | Already Postgres-native, no new infra |
| Everything else | Unchanged (Expo SDK 56 web export, Supabase, Netlify, Zustand, `expo-print`) | No new frontend/hosting stack needed — see distribution decision above |

**Multi-tenant AI safety rule:** every AI Edge Function call is scoped by `salon_id` from the caller's
verified session — never let one salon's prompt context include another salon's data. This is the direct
equivalent of E-Shopperce's "structured filter, not raw SQL" safety pattern, applied at the tenant
boundary instead of the query boundary.

---

## 2. Data Model Additions

```sql
-- Booking (Phase B)
alter table appointments add column source text default 'admin'; -- admin | walkin | online
alter table appointments add column booking_status text default 'confirmed'; -- confirmed | pending | declined
-- pending only used if a salon opts into "owner must approve online bookings" instead of auto-confirm

-- Employee working hours (Phase B dependency — doesn't exist yet; Phase B's availability
-- computation assumed this data already existed, it doesn't)
employee_working_hours (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  salon_id uuid references salons(id) not null,
  weekday int not null check (weekday between 0 and 6), -- 0=Sunday
  start_time time not null,
  end_time time not null
)

-- Inventory: consumable/professional-use stock (Phase C — the AI-forecasting focus)
inventory_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references salons(id) not null,
  name text not null,           -- e.g. "Blondierpulver", "Entwickler 20 Vol."
  unit text not null,           -- 'ml' | 'g' | 'piece'
  stock_quantity numeric not null default 0,
  low_stock_threshold numeric,
  created_at timestamptz default now()
)

-- Recipe: how much of each inventory_item a service_category consumes per use
service_recipes (
  id uuid primary key default gen_random_uuid(),
  service_category_id uuid references service_categories(id) not null,
  inventory_item_id uuid references inventory_items(id) not null,
  amount_per_use numeric not null
)
-- On an appointment's status -> 'completed', look up service_recipes for its
-- service_category_id and decrement each matched inventory_items.stock_quantity by
-- amount_per_use. A trigger on appointments (mirroring the existing
-- appointments_updated_at trigger) is the natural place for this, not app code —
-- keeps it correct regardless of which client (web, future booking flow) completes it.

-- Inventory: retail stock sold to clients (Phase C) — mirrors E-Shopperce's products table
products (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references salons(id) not null,
  name text not null,
  description text,
  price numeric not null,
  stock_quantity int not null default 0,
  category text,
  image_url text,
  sourcing_type text default 'in_house', -- in_house | dropship (see Phase F below)
  created_at timestamptz default now()
)

appointment_products ( -- retail items sold during a visit
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id) not null,
  product_id uuid references products(id) not null,
  quantity int not null default 1,
  unit_price numeric not null
)

-- Client feedback (Phase D.2 — net new, doesn't exist in Swartschaf today)
client_feedback (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id) not null,
  rating int, -- 1-5
  comment text,
  sentiment text, -- filled by AI: positive/neutral/negative
  created_at timestamptz default now()
)

-- Trending retail scout (Phase F, optional — mirrors E-Shopperce Phase 6's review queue)
product_candidates (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references salons(id) not null,
  suggested_name text, suggested_description text, suggested_category text, suggested_price numeric,
  reasoning text,
  status text default 'pending', -- pending | approved | rejected
  created_at timestamptz default now()
)
```

All new tables get RLS scoped by `salon_id`, following the existing pattern in `004_security_hardening.sql`
and `005_rls_helper_functions_security_definer.sql`. Product image upload reuses the storage-bucket
pattern already proven in `006_avatars_storage.sql` (private bucket + signed URL flow), not a new design.

---

## 3. Feature Phases

### Phase B — Public Booking — **NOT STARTED**
- Public, unauthenticated booking page per salon (`swartschaf.de/book/<salon_code>`): pick service →
  employee → available slot → confirm with name/phone/email.
- Availability computed from existing `scheduled_start/end`, breaks, and employee working hours — no new
  scheduling engine, just a read-only view over data that already exists.
- Writes a new `appointments` row with `source = 'online'`. Owner can require confirmation
  (`booking_status = 'pending'`) or auto-confirm, salon-configurable.
- **AI woven in:** service description generator (Phase 2-equivalent) writes the client-facing copy for
  each service shown on the booking page.
- This is genuinely the next big untouched piece of the plan (2026-09-03).

### Phase C — Inventory (consumable + retail) — **DONE 2026-09-03**, built beyond the original spec
- ~~Admin CRUD for `inventory_items`~~ Done, and richer than originally scoped here: instead of raw ml/g,
  built around purchase-unit ("Gebinde") costing — `product_code`/`brand`/`total_qty`/`portions_per_unit`/
  `purchase_price`/`portion_price`, stock tracked in portions. ~~`service_recipes`~~ done, renamed
  "Produktverbrauch" in the UI and re-pointed to link a specific priced `services` row (also newly built,
  not originally planned as its own table) rather than the broad category — see Core Data Model in
  CLAUDE.md for the full shape (`013`–`015`).
- ~~Admin CRUD for `products`~~ done (`inventory/index.tsx`'s "Verkaufsprodukte" tab). Image upload was
  *not* built — products currently have no `image_url` UI, just the schema field.
- ~~Attach retail items sold to a completed appointment~~ done (`appointment_products`), plus a second,
  originally-unplanned table `appointment_material_usage` that snapshots consumable-material cost the same
  way, since the actual requirement (2026-09-03 conversation) turned out to need cost tracking on both
  sides, not just retail.
- ~~Low-stock indicator on the admin dashboard~~ done (owner dashboard tile badge + count).
- **AI woven in:** description generator was **not** built (deprioritized per Phase D's reordering below).
  What *was* built instead: Fernando (Phase D.1) — a bigger win for a hairdresser-focused product than
  generated copy would have been.
- **Not built, still open:** `appointments/new.tsx` (the owner's scheduling form) still only picks a broad
  `service_category`, never a specific priced `service` — the consumption/cost chain only actually fires
  from the *completion*-time flow (employee stop-timer / owner appointment-detail stop-timer), which is
  arguably more correct (what got done can differ from what was booked) but means booking-time service
  selection is still a gap if that's ever wanted.

### Phase D — AI Layer (built alongside B/C, not after)
**Inventory and time-tracking are the flagship AI features** (decided 2026-09-03) — they're where there's
real signal to work with (actual consumption data, actual hours data), not just generated copy. Listed in
priority order:
1. **Inventory consumption forecasting** (`ai-inventory-forecast`, aka "Fernando") — **DONE 2026-09-03**,
   deployed and live. Simpler than originally scoped (no "project when it hits zero" timeline yet — that's
   still open) but real: given each low-stock item's 30-day consumption from `appointment_material_usage`,
   Groq (`llama-3.3-70b-versatile`, JSON-mode) suggests a reorder quantity in Gebinde with a one-line German
   reasoning, surfaced in `inventory/index.tsx`'s "Fernando" tab with a printable/shareable PDF export
   (`utils/pdf.ts`'s `generateAndSharePurchaseList`). Falls back to a deterministic "1 Gebinde" suggestion
   if the model call fails, times out, or the key is ever missing — Fernando never leaves the owner with
   nothing. **Next increment here, not yet built:** an actual depletion-date projection ("hits zero around
   [date]"), not just a point-in-time reorder suggestion.
2. **Natural-language reporting over time-tracking data** (`ai-query`) — "Which employees are near 9h
   overtime this week?" / "How much Blondierpulver did we use last month?" LLM emits a **structured JSON
   filter**, never raw SQL — the Edge Function validates the filter against an allowlisted schema and runs
   a parameterized query. Same safety pattern and interview talking point as E-Shopperce's Phase 4, now
   over compliance-sensitive time data and inventory data instead of just stock counts.
3. **Compliance assistant** (`ai-compliance-chat`, RAG) — `utils/compliance.ts` already encodes AZG/GoBD/
   Ruhezeit/Sofortmeldung rules but never explains them; embed the rule text + short plain-language
   explanations, retrieve top matches for an owner's question ("Do I need to log a 15-minute coffee
   break?"), answer with that context. Real sellable value (avoids labor-law fines for the salon owner),
   not a novelty chatbot — a stronger RAG story than a generic product-catalog bot.
4. **No-show risk flag** — flag appointments statistically likely to no-show based on that client's/slot's
   history, surfaced on the admin calendar.
5. **Description generator** (`ai-generate-description`) — admin enters name + bullets → LLM drafts
   service/product copy, admin can accept/edit/regenerate. Shared by Phase B and C, but lowest priority of
   the five — it's generated copy, not decision support from real data.
6. **Client feedback + sentiment** (`ai-sentiment`) — short post-appointment rating/comment (SMS or email
   link, no login needed) → LLM tags sentiment + one-line summary → per-employee/per-service trend on the
   owner dashboard.

### Phase F — Trending Retail Scout (optional, later)
Direct port of E-Shopperce's Phase 6 philosophy: curated, human-in-the-loop, not automated sourcing.
Weekly job suggests retail restock candidates into `product_candidates`; owner approves/edits/rejects
before anything becomes a real `products` row. `sourcing_type` exists from Phase C for this reason.

### Phase G — Sellability Polish
- Public marketing site for swartschaf.de (could reuse E-Shopperce's Black & Lime visual language for the
  marketing pages specifically, distinct from the in-app theme).
- Employee-limit plan tiers (Starter/Pro, see CLAUDE.md's Pricing table) stay informational only —
  billing/invoicing happens outside the app, so this is about which limits the app enforces per plan, not
  payment collection.
- Per-tenant AI usage tracking/rate-limiting before enabling AI features broadly (cost control).

---

## 4. New Edge Functions / RPCs

```
POST supabase/functions/ai-inventory-forecast        { salon_id }             -- flagship, see Phase D.1
POST supabase/functions/ai-query                    { salon_id, question }   -> structured filter -> results
POST supabase/functions/ai-compliance-chat           { salon_id, question }
POST supabase/functions/ai-generate-description   { salon_id, kind: 'service'|'product', name, bullets }
POST supabase/functions/ai-sentiment               { feedback_id }
POST supabase/functions/get-availability (RPC)       { salon_id, employee_id, date } -- public, no auth
POST supabase/functions/create-online-booking (RPC)  { salon_id, employee_id, service_id, start, client_name, client_phone } -- public, no auth
```

All admin-triggered AI functions verify the caller's session + `salon_id` match, same pattern as existing
owner-only RPCs. The two public ones (`get-availability`, `create-online-booking`) are the only
intentionally unauthenticated surface in the app — rate-limit and validate these carefully since they're
the new attack surface this plan introduces.

---

## 5. Environment Variables (additions)

```
GROQ_API_KEY=              # or GEMINI_API_KEY — Edge Functions only, Supabase Dashboard secrets
```

No new frontend env vars — AI calls are always server-side via Edge Functions, matching the existing
`SUPABASE_SERVICE_ROLE_KEY` pattern.

---

## 6. CV / Interview Talking Points

- "Extended a real multi-tenant SaaS (GoBD-compliant time tracking) with a public booking flow, a retail
  inventory module, and four AI features, rather than building an AI demo in isolation."
- "Designed a safe LLM-to-database pattern using structured JSON filters instead of raw SQL generation —
  applied to labor-compliance queries, not just inventory."
- "Built a RAG-based compliance assistant that explains German AZG/GoBD rules in plain language to salon
  owners — a real cost-avoidance feature, not a novelty chatbot."
- "Shipped sentiment analysis on post-appointment client feedback to surface per-employee/service trends."
- "Enforced tenant isolation at the AI-prompt boundary, not just the database-query boundary, in a
  multi-tenant product."
- "Made a deliberate distribution-scope call (web-only, no native app stores) to ship faster, without
  giving up the option of native builds later — Expo's web export made that a non-decision technically,
  just a shipping-speed one."

---

## 7. Open Decisions

- **Owner approval on online bookings**: auto-confirm vs. pending-until-owner-approves — likely a
  per-salon setting, default TBD.
- **Feedback delivery channel**: SMS vs. email post-appointment link for `client_feedback` — depends on
  what's already wired up for confirmations (currently: none — no client contact channel exists yet, this
  needs to be built as part of Phase B regardless of feedback).
- **Per-employee salon_code login UX** (already flagged in CLAUDE.md's "Considered, not yet decided") is
  independent of this plan but touches the same `verify_employee_pin` surface — worth resolving before or
  alongside Phase B if a per-employee code ever needs to appear on booking confirmations.
- **Client-payment / card-machine integration (parked, not scheduled)**: letting the app capture payment
  from a salon's own clients at appointment completion (e.g. wired to a physical card terminal) was raised
  and explicitly deferred — not built, not scoped into any phase above. It's the same category of problem
  CLAUDE.md already rules the app out of: a system that records/archives sales transactions in Germany is
  generally subject to KassenSichV/TSE fiscal cash-register certification, regardless of whether the
  actual card charge happens on a third-party terminal. If this is ever picked back up, get a real
  Steuerberater/tax-lawyer opinion on which of "payment-status flag only" vs. "full in-app checkout with
  receipts" (framed as two very different risk levels when this was discussed) is actually being built —
  don't let it get quietly implemented as a side effect of a booking or inventory feature.

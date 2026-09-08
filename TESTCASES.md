# Swartschaf — Manual Test Cases

Derived from [CLAUDE.md](CLAUDE.md)'s documented architecture and business rules (as of 2026-09-08).
Each case tests a behavior the markdown asserts is true — if a case fails, either the app regressed or
CLAUDE.md is stale; fix whichever is wrong and update the other. This is a manual QA checklist, not an
automated suite (none exists yet, per CLAUDE.md's Pending list).

**Format:** ID · Preconditions · Steps · Expected Result.

---

## 1. Auth

**AUTH-01 — Owner email/password login**
Pre: registered owner account exists.
Steps: Login screen → enter email + password → submit.
Expected: redirected to `(owner)` dashboard; profile + salon loaded.

**AUTH-02 — Owner login, wrong password**
Steps: Login screen → correct email, wrong password → submit.
Expected: inline error "E-Mail oder Passwort ist falsch." (not a raw Supabase error string).

**AUTH-03 — Employee PIN login, two-step flow**
Pre: an active employee with a known 6-digit PIN exists in a salon with a known 6-char Saloncode, and
`must_reset_pin = false` (already completed their first-login reset).
Steps: Mitarbeiter-Anmeldung → enter 6-char Saloncode → "Weiter" → enter 6-digit PIN.
Expected: on the 6th digit, auto-submits; redirects (via `/`) to `(employee)` homepage. Two distinct
steps are required — Saloncode alone does not log in.

**AUTH-04 — Employee PIN login, wrong PIN**
Steps: correct Saloncode → wrong 6-digit PIN.
Expected: alert "Saloncode oder PIN nicht korrekt."; PIN field clears; stays on PIN step.

**AUTH-05 — Employee internal email never shown**
Steps: complete AUTH-03.
Expected: nowhere in the employee UI does `emp_<uuid>@swartschaf.internal` appear.

**AUTH-06 — Registration seeds default service categories**
Steps: Register a new salon (name, owner name, email, password) → submit → land on owner dashboard.
Expected: `service_categories` for the new salon contains the 6 defaults (Haare, Nägel, Waxing, Makeup,
Massage, Kosmetik) with the current theme's accent colors (not the old dark-theme hex values).

**AUTH-07 — New employee is forced to reset their PIN on first login**
Pre: owner creates a new employee with an owner-chosen 6-digit PIN (`must_reset_pin` defaults `true`).
Steps: log in as that employee (Saloncode + the owner-set PIN).
Expected: login succeeds, but instead of landing on the employee homepage, redirected to `/reset-pin`
("Neue PIN festlegen") — cannot reach anything else until this is completed. No back button/skip.

**AUTH-08 — Completing the first-login reset**
Pre: mid-way through AUTH-07.
Steps: enter a new 6-digit PIN, confirm it (matching), submit.
Expected: succeeds; `profiles.must_reset_pin` flips to `false`; redirected onward (via `/`) — to
onboarding if not yet seen, otherwise straight to the employee homepage. A subsequent logout/login with
the *old* (owner-set) PIN now fails; only the new PIN works.

**AUTH-09 — Reset screen: PIN mismatch**
Steps: on `/reset-pin`, enter two different values in "Neue PIN" and "PIN bestätigen" → submit.
Expected: inline error "Die PINs stimmen nicht überein."; nothing is written; still on the reset screen.

**AUTH-10 — Owner-initiated PIN reset**
Pre: an existing employee with `must_reset_pin = false` (already past their first login).
Steps: owner → employee detail → "Mitarbeiter-PIN" card → "PIN zurücksetzen" → enter a new 6-digit PIN →
"Setzen".
Expected: succeeds; that employee's `must_reset_pin` flips back to `true`. Their *old* PIN stops working
immediately (both the Auth password and `pin_hash` were changed). Card's status line updates to "Warten
auf PIN-Vergabe durch Mitarbeiter".

**AUTH-11 — Owner-reset PIN behaves exactly like a brand-new employee's first login**
Steps: log in as the employee from AUTH-10 using the PIN the owner just set.
Expected: same as AUTH-07 — routed straight to `/reset-pin`, not the employee homepage, even though this
employee has logged in before and already completed onboarding.

**AUTH-12 — Employee cannot reset another employee's PIN**
Pre: employee A and employee B both exist in the same salon.
Steps: as employee A, attempt to call the self-reset path (`profiles.update({ pin_hash })`) against
employee B's `id`, or attempt to invoke `reset-employee-pin` directly.
Expected: both rejected — `prevent_profile_privilege_escalation` only allows `auth.uid() = id` for
`pin_hash` changes, and `reset-employee-pin` requires the caller's role to be `owner`.

---

## 2. Time Tracking

**TIME-01 — Concurrent timers**
Pre: an employee has two scheduled appointments today.
Steps: Start Appointment A's timer → without stopping A, start Appointment B's timer.
Expected: both show `status: in_progress` and a running elapsed counter simultaneously.

**TIME-02 — Walk-in (Laufkunde) instant capture**
Steps: Employee homepage → Laufkunde FAB → pick a service category.
Expected: a new `in_progress` appointment is created immediately with `customer_type: 'walkin'`,
`actual_start` = now, `scheduled_end` = now + 1h placeholder.

**TIME-03 — AZG warning at 6h without a break**
Pre: an employee has logged ~6h of completed appointment time today with no `lunch`/`coffee` break.
Steps: View employee homepage.
Expected: a compliance alert referencing the 30-minute break requirement appears.

**TIME-04 — AZG warning at 9h**
Pre: ~9h logged, no adequate break.
Expected: a stronger alert referencing the 45-minute requirement.

**TIME-05 — Ruhezeit (§5) warning**
Pre: an appointment starts <11h after the same employee's previous appointment ended.
Expected: a Ruhezeit compliance alert appears.

---

## 3. Appointments & Corrections

**APPT-01 — Owner creates an appointment**
Steps: `(owner)/appointments/new` → fill client, employee, one or more service categories (multi-select),
date, start/end time → save.
Expected: appointment appears on the calendar for that day; `service_category_ids` array is populated for
all selected categories, `service_category_id` set to the first.

**APPT-02 — GoBD: employee cannot edit protected fields**
Pre: an appointment assigned to employee X.
Steps: as employee X, attempt to change `client_name` or `service_category_id` directly (e.g. via a
direct API call, bypassing UI).
Expected: rejected by the `restrict_employee_appointment_updates` trigger — only
`actual_start`/`actual_end`/`status`/`notes` are writable by the employee.

**APPT-03 — Correction request round-trip**
Steps: as employee, submit a correction request for a completed appointment's actual start/end with a
reason → as owner, open Korrekturen → approve.
Expected: on approval, the appointment's `actual_start`/`actual_end` update to the requested values and
`status` flips to `completed`; the original values remain visible in `correction_requests.original_data`
(never overwritten — no hard deletes).

**APPT-04 — Correction rejection leaves data untouched**
Steps: submit a correction → owner rejects.
Expected: appointment's actual times are unchanged; request shows `status: rejected`.

---

## 4. "Which Services Were Rendered" → Inventory Consumption (2026-09-03 build)

**COMP-01 — Employee stop-timer prompts for services**
Pre: at least one `services` row with a linked `service_recipes` entry exists for the salon.
Steps: employee homepage → Stop on a running timer.
Expected: a modal "Welche Leistungen wurden erbracht?" appears listing priced services with checkboxes;
skippable (Fertig works with nothing selected).

**COMP-02 — Owner appointment-detail stop-timer prompts too**
Steps: `(owner)/appointments/[id]` on an `in_progress` appointment → "Timer beenden".
Expected: same service-confirmation modal appears before the appointment flips to `completed`.

**COMP-03 — Completion writes appointment_services BEFORE the status flip**
Steps: complete COMP-01 or COMP-02 with at least one service selected.
Expected: `appointment_services` rows exist for that appointment; only then does `status` become
`completed` (order matters — the trigger reads `appointment_services` on that same UPDATE).

**COMP-04 — Stock auto-decrements on completion**
Pre: an `inventory_items` row with known `stock_quantity`, linked via `service_recipes` to a service with
`portions_per_use = N`.
Steps: complete an appointment with that service selected.
Expected: `inventory_items.stock_quantity` decreases by exactly N; `appointment_material_usage` gains a
row with `portions_used = N` and `portion_price` = the item's price *at that moment* (snapshot, not a
live reference).

**COMP-05 — Skipping the service picker doesn't break completion**
Pre: a salon with no `services` configured yet.
Steps: stop a timer.
Expected: modal shows "Noch keine Leistungen mit Preisen hinterlegt..." hint; Fertig still completes the
appointment with no `appointment_services` rows and no error.

**COMP-06 — Multi-service visit (cut + color)**
Steps: complete an appointment selecting two services, each with its own recipe.
Expected: both services' recipe items decrement; `appointment_material_usage` has rows for the union of
both recipes (summed if they share an `inventory_item_id`).

---

## 5. Trial Lock (read-only enforcement)

**LOCK-01 — Active salon has full write access**
Pre: `salons.subscription_status = 'active'`.
Expected: owner can create/edit appointments, employees, inventory, services without restriction.

**LOCK-02 — Expired trial blocks writes**
Pre: `subscription_status != 'active'` and `now() > trial_ends_at` (set a past `trial_ends_at` to test).
Steps: attempt to create an appointment, add an inventory item, or add an employee.
Expected: the write is rejected by RLS (`salon_is_locked()` check) — UI should surface this as a save
failure, not a silent no-op.

**LOCK-03 — Locked salon still allows viewing and export**
Pre: same as LOCK-02.
Steps: view the calendar, view inventory list, generate/export a PDF report.
Expected: all read operations and PDF generation/export succeed — the documented rule is "view + export
still work."

**LOCK-04 — Employee timer actions also blocked while locked**
Pre: same as LOCK-02.
Steps: as an employee, attempt to start or stop a timer, or log a walk-in.
Expected: rejected — the lock applies to employee writes too, not just owner writes (this was the gap
`011_fix_duplicate_timer_policies.sql` closed; regression-test it specifically).

**LOCK-05 — Own-profile edits still work while locked**
Steps: while locked, as any user, update your own avatar or `has_seen_onboarding`.
Expected: succeeds — `profiles_self` is intentionally not gated (personal preferences, not "using the
service").

---

## 6. Schwarzarbeit Compliance

**SCHW-01 — Unconfirmed Sofortmeldung shows a warning icon**
Pre: a new employee with no `sofortmeldung_confirmed_at`.
Expected: employee list shows a warning icon next to their name.

**SCHW-02 — Owner confirms Sofortmeldung**
Steps: employee detail → confirm Sofortmeldung (optional reference number).
Expected: `sofortmeldung_confirmed_at` set; warning icon disappears from the list.

**SCHW-03 — Employee cannot self-confirm compliance fields**
Steps: as the employee themself, attempt to write `sofortmeldung_confirmed_at` or
`ausweis_acknowledged_at` directly.
Expected: rejected by `prevent_profile_privilege_escalation` — only the owner (or service role) may set
these.

---

## 7. Services (priced variants)

**SVC-01 — Create a service under a category**
Steps: Leistungen → add → name "Schneiden Kurz Damen", pick category "Schneiden", price 35, duration 30.
Expected: new `services` row; appears in the list grouped/labeled with its category's color dot.

**SVC-02 — Two services under one category, different prices**
Steps: add "Schneiden Kurz Damen" (€35) and "Schneiden Lang Herren" (€45) under the same category.
Expected: both list independently with their own prices — the category itself is unaffected (still just
name + color, used for calendar grouping as before).

---

## 8. Inventory & Produktverbrauch

**INV-01 — Add a consumable item with Gebinde-based costing**
Steps: Inventar → Verbrauchsmaterial → add: name, unit (ml/g/piece), Gesamtmenge pro Gebinde, Portionen
pro Gebinde, Einkaufspreis, Preis pro Portion, Bestand, Mindestmenge.
Expected: `inventory_items` row created; `stock_quantity`/`low_stock_threshold` are in **portions**, not
raw ml/g or whole Gebinde.

**INV-02 — "1 Gebinde" quick-restock button**
Pre: an item with `portions_per_unit` set.
Steps: edit the item → tap "1 Gebinde" next to the stock field.
Expected: stock field increases by exactly `portions_per_unit` (doesn't save until "Speichern" is tapped).

**INV-03 — Low-stock indicator**
Pre: an item where `stock_quantity <= low_stock_threshold`.
Expected: red alert icon on that item's card in the Verbrauchsmaterial list; owner dashboard's Inventar
tile shows the low-stock count as a badge.

**INV-04 — Produktverbrauch (recipe) links a service to an item**
Steps: Inventar → Produktverbrauch → add → pick a service, pick an inventory item, set portions per use.
Expected: `service_recipes` row created, `service_id` (not `service_category_id`) referencing the specific
priced service.

**INV-05 — Retail product CRUD**
Steps: Inventar → Verkaufsprodukte → add name/price/stock/category.
Expected: `products` row created; independent of consumable items (no recipe linkage).

**INV-06 — Rezept terminology check**
Expected: nowhere in the Inventar screen does the word "Rezept" appear — the tab and all copy read
"Produktverbrauch" (explicit rename per user feedback).

**INV-07 — "Gebinde" not hardcoded to a package type**
Expected: no UI copy names a specific container type (e.g. "Tube") — only the generic "Gebinde" term,
since items may come in tubes, bottles, boxes, etc.

---

## 9. Fernando (AI purchase list)

**FERN-01 — Fernando tab lists only low-stock items**
Pre: some items above threshold, some at/below.
Expected: Fernando tab shows only the at/below-threshold items; "Alles auf Lager" empty state if none.

**FERN-02 — "Fernando fragen" returns AI suggestions**
Pre: `GROQ_API_KEY` Edge Function secret is set; at least one low-stock item with 30-day consumption
history in `appointment_material_usage`.
Steps: Fernando tab → "Fernando fragen".
Expected: each item shows a suggested Gebinde quantity + a German one-line reasoning; intro text updates
to "Vorschläge unten sind KI-gestützt (Groq)...".

**FERN-03 — Fallback when the model call fails or the key is missing**
Pre: simulate by temporarily unsetting `GROQ_API_KEY` (or forcing a Groq API error).
Steps: "Fernando fragen".
Expected: `ai_powered: false` in the response; deterministic "1 Gebinde" suggestions still returned — the
owner is never left with nothing, no error surfaced to the UI.

**FERN-04 — Purchase-list PDF export**
Steps: Fernando tab → "Bestellliste exportieren".
Expected: a PDF titled "BESTELLLISTE — von Fernando" generates/downloads/shares, listing each low-stock
item with Art.-Nr., current stock, Mindestmenge, suggested Gebinde, and estimated cost.

---

## 10. Reports & Vault

**REP-01 — Generate an Arbeitszeitnachweis PDF**
Steps: Berichte → pick a period → pick an employee → generate.
Expected: PDF with Salon + Steuernummer + Adresse header, appointment table, totals, signature lines,
"GoBD-konform" footer + timestamp.

**REP-02 — Report auto-archives to the vault**
Pre: not running in a web browser (archiving is native-only per the "Web-Note" in the Berichte screen).
Steps: generate a report on a native build.
Expected: a `generated_reports` row is created; appears in Berichtsarchiv under the correct month.

**REP-03 — Vault reports are immutable**
Expected: no UI path exists to edit or delete a `generated_reports` row — only re-share (via the archive
screen's share icon).

**REP-04 — Vault re-share doesn't regenerate**
Steps: Berichtsarchiv → tap share icon on an existing entry.
Expected: the already-generated PDF is re-shared as-is, not recreated from live data.

---

## 11. Design, Theme & Responsive Layout (2026-09-08)

**UI-01 — Light theme applied throughout**
Steps: open every major screen (dashboard, calendar, inventory, services, reports, settings, legal pages,
login, register, employee homepage).
Expected: white/off-white background (`#FBF7F6`), white cards, near-black text — no screen renders with a
dark maroon/red background left over from the old theme.

**UI-02 — No leftover dark-theme literals in error/alert states**
Steps: trigger a validation error on login, register, appointment creation, employee creation, and
inventory item creation; trigger a compliance warning/critical alert.
Expected: every error/alert box is a pale tint (e.g. `#FDE8E8` for errors) with legible dark-red text —
none render as a near-black box (the old dark-theme literal).

**UI-03 — Splash screen matches the light theme**
Steps: cold-load the app.
Expected: splash background is the light `#FBF7F6`, not the old dark `#4f000b` — no dark flash before the
UI loads.

**UI-04 — Status bar icons visible on light background**
Expected: status bar uses dark icons (`StatusBar style="dark"`), legible against the light app chrome.

**UI-05 — Content stays readable on iPad-width viewports**
Steps: open the app at 768px (iPad portrait) and 1024px+ (iPad landscape / small desktop) widths, on
several list/form screens (inventory, employees, reports, settings).
Expected: content is capped and centered (~720px for lists/dashboards, ~440px for login/register), not
stretched edge-to-edge into unreadably wide rows.

**UI-06 — Content still fills phone-width viewports**
Steps: open the same screens at ~375–430px width.
Expected: unchanged from before the responsive change — content fills the width as it always did (the
max-width cap is a no-op below the threshold).

**UI-07 — Dashboard card hover opens the info panel (desktop/mouse only)**
Steps: on a desktop browser with a mouse, hover over (without clicking) an owner-dashboard tile.
Expected: the description text appears; moving the mouse off the card hides it again — no flicker, no
rapid show/hide loop.

**UI-08 — Dashboard card hover has a large, forgiving hit area**
Expected: hovering anywhere over the card (not just the small "i" icon) triggers the description — the
whole card is the hover target.

**UI-09 — Touch devices unaffected by hover logic**
Steps: on a touch-only device (or emulated touch), tap a dashboard card's small "i" icon.
Expected: tap toggles the description open/closed as before; tapping elsewhere on the card still
navigates to that section (hover handlers are no-ops on touch).

---

## 12. Known Stale Content (expected failures — not regressions)

These are pre-existing gaps CLAUDE.md already flags. They should currently **fail** if tested strictly
against reality; don't "fix" the app to match them without checking with the user first — the markdown
and the legal text disagree on purpose right now, pending a decision.

~~**STALE-01** — `legal/datenschutz.tsx` and `legal/agb.tsx` still describe Stripe billing/payment
processing in detail.~~ **Fixed 2026-09-08**: both rewritten to reflect external billing (no in-app
payment, no Stripe data processor, no Stripe Customer Portal reference); trial length also corrected from
14 to 7 days to match `trial_ends_at`'s actual default (`010_trial_lock.sql`). **Not legal advice** — this
was a factual-accuracy content edit (matching text to decisions already made), not a substitute for
review by an actual lawyer/Steuerberater before real customers see these pages, especially the payment
terms in AGB §3/§3a/§5.

**STALE-02** — `app/legal/impressum.tsx`'s Steuernummer field is still a placeholder
(`[Ihre Steuernummer]`). Real value pending from the user.

**STALE-03** — `appointments/new.tsx` still only picks a broad `service_category`, never a specific priced
`service` — by design for now (see CLAUDE.md's Known Issues), not a bug to fix incidentally.

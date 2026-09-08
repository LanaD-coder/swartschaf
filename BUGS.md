# Swartschaf — Bugs & Fixes Log

A running record of real bugs found and fixed, chronological within each section. Companion to
[CLAUDE.md](CLAUDE.md) (architecture/status) and [TESTCASES.md](TESTCASES.md) (the QA checklist these
feed into) — this file is specifically "what broke, why, and what fixed it," kept separate so that
history doesn't get buried inside the architecture doc as it grows.

**Pattern worth naming up front:** almost every bug below only surfaced through actual click-through
testing against a real build (`npm run build:web` served standalone, not just the dev server) — none of
them were caught by code review or static reasoning alone. If touching auth/session flows in particular,
treat "the code looks right" as insufficient; a live test is the actual bar.

---

## Auth & Session (2026-09-08)

### BUG-01 — Owner login had no navigation on success
**Symptom:** entering correct email/password did nothing visible — no error, no redirect, just sat on
the login form. Read exactly like broken credentials even when they were correct.
**Root cause:** `login.tsx`'s `handleLogin()` only had an error-handling branch. `signInWithPassword`
succeeding fell through to nothing — no `router.replace(...)` call existed anywhere in the success path.
**Fix:** added `router.replace('/')` after a successful sign-in, gated behind the existing error branch
`return`ing first.
**Note:** this is basic enough that it's a strong signal owner login had likely never been click-through
tested end-to-end before this session.

### BUG-02 — Both logout buttons (owner dashboard, employee homepage) had no navigation after sign-out
**Symptom:** clicking the logout icon cleared the session but stayed on the same (now broken/stale)
screen.
**Root cause:** same shape as BUG-01, on the way out instead of in — `onPress={() =>
supabase.auth.signOut()}` with nothing after it.
**Fix:** `await supabase.auth.signOut(); router.replace('/(auth)/login');` in both places.

### BUG-03 — Logout's first fix attempt had a race condition
**Symptom:** logout appeared to still fail — "only reverts to login screen on hard refresh."
**Root cause:** the first fix routed through `/` (matching the login-flow convention of letting
`app/index.tsx`'s redirect chain decide the destination). But navigating to `/` re-evaluates that chain
*immediately*, while Zustand's `session`/`profile` clear asynchronously via `_layout.tsx`'s
`onAuthStateChange` listener. On the very next render, `index.tsx` could still see the stale logged-in
state and redirect straight back to `/(owner)` before the clear propagated.
**Fix:** route logout directly to `/(auth)/login`, not through `/`. There's no gate to check on the way
*out* — only coming *in* (where routing through `/` remains correct: login, register, and reset-pin all
still do this, since those need `must_reset_pin`/`has_seen_onboarding` checked).

### BUG-04 — `register.tsx` and `employee-pin.tsx` bypassed the onboarding gate entirely
**Symptom:** (not directly reported by the user — found while building the mandatory-PIN-reset feature,
tracing why a new gate might not fire.)
**Root cause:** both screens navigated straight to their destination (`router.replace('/(owner)')` /
`router.replace('/(employee)')`) after a successful signup/login, skipping `app/index.tsx`'s redirect
chain — the only place `has_seen_onboarding` (and now `must_reset_pin`) is checked. This means the
onboarding tutorial had likely never actually been reachable via normal login either, despite being
documented as "done."
**Fix:** both now route through `/` so the chain actually runs.

### BUG-05 — Owner-session-invalidation bug, narrowed but not fully closed
**Symptom:** (pre-existing, documented before this session) creating an employee was reported to log the
owner out.
**Investigation:** confirmed live against a production build that creating an employee **alone** does
NOT break the owner session. Ruled out rogue `setProfile`/`signOut`/`clear()` calls and duplicate
`createClient()` instances in the shipped code. Found and disabled `detectSessionInUrl` (was `true` on
web with no OAuth/magic-link/password-reset flow to justify it). Separately observed "Multiple
GoTrueClient instances detected" live in the *dev server* — real, but caused by Metro Fast Refresh
re-evaluating `lib/supabase.ts` on hot reload, which doesn't happen in a production build, so it can't be
the production cause.
**Status: open, narrowed.** Leading untested theory: testing a newly-created employee's PIN login in the
*same browser tab* right after creating them would legitimately overwrite the owner's session (one
browser = one Supabase session slot per storage key) — if so, it's a testing-workflow trap, not a code
bug. See CLAUDE.md's Known Issues for full detail.

---

## Employee PIN Login (2026-09-08)

### BUG-06 — Saloncode entry used a digits-only keypad for an alphanumeric value
**Symptom:** employee PIN login failed with "Saloncode oder PIN nicht korrekt" even with a saloncode the
user believed was correct.
**Root cause:** `salon_code` is generated as base-36 (`Math.random().toString(36)...toUpperCase()` in
`register.tsx`) — letters *and* digits (e.g. `X34TEZ`). The employee-pin screen's on-screen keypad only
had digit keys `0`–`9`. There was no way to type a letter at all, making any salon code containing one
**literally impossible to enter** through the UI.
**Fix:** the Saloncode step is now a normal `TextInput` (`autoCapitalize="characters"`, sanitized to
`[A-Z0-9]`, max 6 chars); the numeric keypad is kept only for the PIN step, which genuinely is
digits-only by design. Added a "Saloncode ändern" link so a wrong code doesn't require restarting the
whole screen.
**Note:** this is very likely the actual cause of the *very first* employee-login test failure in this
session, which was initially (and incorrectly) diagnosed as a credentials/data problem — see BUG-08.

### BUG-07 — `Alert.alert(...)` on the employee-pin screen could fail silently
**Symptom:** a failed login attempt showed nothing at all — no error, no feedback, just cleared the PIN
field.
**Root cause:** React Native Web's `Alert.alert` is known to be unreliable (can no-op instead of
rendering anything). This was the one auth screen still using it; every other auth screen already used an
inline error box.
**Fix:** replaced both `Alert.alert(...)` calls with an inline `errorMsg` state + error box, matching
`login.tsx`/`register.tsx`'s existing pattern. Also logs the underlying Supabase error to the console for
easier future debugging.

### BUG-08 — A "wrong PIN" report that turned out to be user error, confirmed by direct DB inspection
**Symptom:** owner reported PIN `123456` failing with "Saloncode oder PIN nicht korrekt" for a
just-recreated employee.
**Investigation:** queried the live `profiles`/`salons` tables directly — the employee record was fully
correct (`role: employee`, `is_active: true`, properly bcrypt-hashed `pin_hash`), and a direct
`crypt('123456', pin_hash)` comparison confirmed the PIN itself was correct. The actual salon code was a
different value (`X34TEZ`) than what was being typed into the Saloncode step.
**Resolution:** not a bug — user was very likely typing the PIN into the Saloncode field too (compounded
by BUG-06 making the real, letter-containing code impossible to type correctly anyway). Confirmed
`verify_employee_pin`'s error message is deliberately generic ("Saloncode oder PIN nicht korrekt", not
distinguishing which one was wrong) — correct for security, but makes self-diagnosis hard, which is
exactly why BUG-06/07's visible-error and typeable-input fixes matter.

---

## Web/DOM-specific (2026-09-08)

### BUG-09 — `title="..."` on `TouchableOpacity` doesn't produce a browser hover tooltip
**Symptom:** added `title="Info"` / `title="Abmelden"` directly on `TouchableOpacity` components,
expecting a native browser tooltip on hover — nothing appeared.
**Root cause:** React Native Web doesn't forward the `title` prop to the underlying DOM node the way it
does for plain `View`.
**Fix:** wrap the `TouchableOpacity` in a `View` carrying the `title` instead — `View` reliably passes
arbitrary HTML attributes through on RN Web. Applied to `HelpButton.tsx` and both logout buttons.
**Takeaway:** if a future web-only DOM attribute needs to reach the browser through an RN component,
prefer wrapping in `View` over adding it straight to a `Touchable*`/`Pressable`.

### BUG-10 — Password field had no `autoComplete`/`autoCorrect`/`autoCapitalize` props
**Symptom:** inspecting the login password field's DOM showed `autocapitalize="sentences"
autocorrect="on" spellcheck="true"` — browser defaults for a plain text field, applied to a password
field where none of them make sense.
**Root cause:** the email field above it had `autoCapitalize="none"` explicitly set; the password field
had no equivalent props at all, so RN Web fell through to its generic defaults.
**Fix:** added `autoCapitalize="none" autoCorrect={false} textContentType="password"
autoComplete="current-password"` to `login.tsx`'s password field, and the `"new-password"` equivalents to
`register.tsx`'s (helps password managers suggest a generated password instead of autofilling an old
one).

---

## RLS / Schema (2026-09-03–08)

### BUG-11 — Duplicate, lock-bypassing RLS policies on `appointments` UPDATE
**Symptom:** found while verifying `010_trial_lock.sql` — not user-reported.
**Root cause:** two hand-added, undocumented policies (`appointments_employee_update_timers`,
`employee_update_own_timers`) existed in the live database with no corresponding migration file. Both
were exact duplicates of the pre-lock `appointments_employee_timer` policy — since RLS policies for the
same command are OR'd together, they'd have let employees keep running timers straight through a trial
lock, silently defeating it.
**Fix:** `011_fix_duplicate_timer_policies.sql` drops both; their permissions are fully covered by the
already-corrected `appointments_employee_timer` policy.

### BUG-12 — Undocumented schema drift: `appointments.service_category_ids`
**Symptom:** found while designing the services/inventory consumption chain — a live `uuid[]` column
already being written to by `appointments/new.tsx`'s multi-select, with no migration file behind it.
**Status:** not destructive, left as-is (still in active use). Documented in CLAUDE.md's Known Issues as
the second confirmed case of schema drift — a `supabase db diff` reconciliation pass against migrations
001–016 is still an open TODO, not yet done.

### BUG-13 — First design of `service_recipes`/completion consumption assumed one service per appointment
**Symptom:** found via the same schema-drift discovery as BUG-12, before anything shipped — appointments
actually support multiple services per visit (cut + color in one booking), which the drift's
`service_category_ids` array already implied.
**Fix:** self-corrected before shipping — replaced a singular `appointments.service_id` (migration 014)
with an `appointment_services` junction table (migration 015) and updated the consumption trigger to
loop over every linked service, summing per-item quantities.

### BUG-14 — Password-length policy rejected the owner-initiated PIN reset
**Symptom:** resetting an employee's PIN from `employees/[id].tsx` failed: "Password should be at least 6
characters."
**Root cause:** Supabase Auth's project-level password-length policy rejected a raw 4-digit PIN via
`admin.auth.admin.updateUserById` — even though `admin.auth.admin.createUser` (initial employee creation)
apparently didn't enforce the same check, an inconsistency between Supabase's own endpoints.
**Fix:** rather than weaken the policy project-wide or add a hidden derived-password layer, PINs are now
6 digits everywhere (login keypad, both reset screens, both Edge Functions' validation, all German copy).
Simpler, and the user-facing PIN is honestly what gets checked. Also resolved the older "Saloncode 6
chars vs. PIN 4 digits" UX-confusion note as a side effect.

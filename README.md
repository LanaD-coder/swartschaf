# swartschaf
### *Zeit fuer das schwarze Schaf.*

GoBD-konforme Zeiterfassungs-App fuer Beauty-Salons in Deutschland.
**Domain:** swartschaf.de

---

## Was ist swartschaf?

SaaS-App fuer Friseursalons, Nagelstudios und Beauty-Betriebe. Der Saloninhaber pflegt
einen zentralen Kalender; jeder Mitarbeiter sieht seine eigenen Termine und startet/stoppt
individuelle Timer. Mehrere Timer koennen gleichzeitig laufen (z.B. Highlights + Waschen).
Laufkunden koennen jederzeit direkt erfasst werden. Alle Zeiten sind GoBD-konform gespeichert
und als Arbeitszeitnachweis (PDF) fuer das Finanzamt exportierbar.

---

## Stack

| Schicht       | Technologie                                          |
|---------------|------------------------------------------------------|
| App           | Expo SDK 56 + Expo Router v5 (iOS, Android, Web)     |
| Backend       | Supabase (Auth, Postgres, Realtime, Edge Functions)  |
| Hosting       | Netlify (expo export --platform web)                 |
| Zahlung       | Stripe Checkout + Webhooks                           |
| State         | Zustand                                              |
| PDF           | expo-print + expo-sharing                            |
| Sprache       | Deutsch                                              |
| Datum         | date-fns mit de Locale                               |
| Builds        | EAS Build (Expo Application Services)                |

---

## Schnellstart

### Voraussetzungen
- Node 20+
- Supabase-Projekt (bereits eingerichtet)
- Expo-Konto (expo.dev) fuer EAS Build

### Installation

```bash
npm install
```

### Umgebungsvariablen

Kopiere `.env.example` zu `.env` und trage deine Werte ein:

```
EXPO_PUBLIC_SUPABASE_URL=https://norktuyfqdfhhekldbwj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

SUPABASE_SERVICE_ROLE_KEY=...       # nur Edge Functions
STRIPE_SECRET_KEY=sk_live_...       # nur Edge Functions
STRIPE_WEBHOOK_SECRET=whsec_...     # nur Edge Functions
```

### App starten

```bash
npx expo start            # Dev-Server (QR-Code mit Expo Go scannen)
npx expo start --web      # Web-Version im Browser
npm run build:web         # Web-Build fuer Netlify (-> dist/)
```

### EAS Build (nativer App-Build)

```bash
eas login                              # einmalig
eas build --platform all --profile production
eas submit --platform ios              # nach erfolgreichem Build
eas submit --platform android          # nach erfolgreichem Build
```

### Edge Functions deployen

```bash
supabase functions deploy create-employee --project-ref norktuyfqdfhhekldbwj
supabase functions deploy stripe-webhook  --project-ref norktuyfqdfhhekldbwj
```

---

## App-Versionen

| Version | React Native | Expo SDK | Status            |
|---------|-------------|----------|-------------------|
| 1.0.0   | 0.85.3      | 56.0.12  | Aktuell (Store)   |

---

## Projektstruktur

```
app/
  (auth)/         login.tsx, employee-pin.tsx, register.tsx
  (owner)/        index (Kalender), appointments/, employees/,
                  corrections.tsx, reports/, settings.tsx
  (employee)/     index (Termine + Timer), history.tsx, correction.tsx
  legal/          impressum.tsx, datenschutz.tsx, agb.tsx

components/       AppointmentCard.tsx, ComplianceAlert.tsx
hooks/            useActiveAppointments.ts
store/            authStore.ts, appointmentStore.ts
utils/            compliance.ts, pdf.ts, dateFormat.ts, theme.ts
lib/              supabase.ts, types.ts

supabase/
  functions/      create-employee/, stripe-webhook/
  migrations/     001_schema.sql, 002_employee_auth.sql

assets/           icon.png, splash.png, adaptive-icon.png, favicon.png
declarations.d.ts
eas.json
```

---

## Rollen & Login

| Rolle          | Login                        | Zugang                                                    |
|----------------|------------------------------|-----------------------------------------------------------|
| **Inhaber**    | E-Mail + Passwort            | Kalender CRUD, Mitarbeiter, Korrekturen, Berichte, Abo    |
| **Mitarbeiter**| Saloncode (6 Zeichen) + PIN  | Eigene Termine, Timer, Laufkunden, Korrekturanfragen      |

---

## Stripe-Plaene

| Plan       | Mitarbeiter | Preis          |
|------------|-------------|----------------|
| Starter    | bis 3       | 9,99 EUR/Monat |
| Pro        | unbegrenzt  | 19,99 EUR/Monat|
| Testphase  | --          | 14 Tage kostenlos |

---

## Deployment

### Web (Netlify)
Netlify deployt automatisch bei jedem Push auf `main`.
- Build command: `npm install && npm run build:web`
- Publish dir: `dist`
- Domain: swartschaf.de

### iOS (App Store)
```bash
eas build --platform ios --profile production
eas submit --platform ios
```
Bundle ID: `de.swartschaf.app` | ASC App ID: `6783376086` | Team: `CM82SUJ92U`

### Android (Google Play)
```bash
eas build --platform android --profile production
eas submit --platform android
```
Package: `de.swartschaf.app`

---

## Build-Status

| Schritt                                        | Status               |
|------------------------------------------------|----------------------|
| Supabase Schema + RLS                          | Erledigt             |
| Mitarbeiter-Auth (Edge Function)               | Erledigt             |
| Auth-Flows (Inhaber + PIN)                     | Erledigt             |
| Registrierung (Session-Race + Email-Confirm)   | Erledigt             |
| Inline-Fehleranzeige (Login + Registrierung)   | Erledigt             |
| Mitarbeiter-Homepage + Timer                   | Erledigt             |
| Laufkunden-Erfassung                           | Erledigt             |
| AZG-Konformitaetswarnungen                     | Erledigt             |
| Inhaber-Dashboard (Karten-Navigation)          | Erledigt             |
| Inhaber-Kalender + Termine CRUD                | Erledigt             |
| Korrektur-Flow (Zeitkorrekturen)               | Erledigt             |
| PDF-Berichte                                   | Erledigt             |
| Profilbild-Upload (Inhaber + Mitarbeiter)      | Erledigt             |
| Rechtliche Seiten (DE)                         | Erledigt             |
| Netlify-Konfiguration                          | Erledigt             |
| Expo SDK 56 Upgrade                            | Erledigt             |
| EAS Build Konfiguration                        | Erledigt             |
| Farbschema + Login-Logo                        | Erledigt             |
| E-Mail-Branding (Resend + Template)            | Erledigt             |
| iOS Build + Submission                         | In Bearbeitung       |
| Android Build + Submission                     | In Bearbeitung       |
| Avatars-Storage-Bucket (SQL ausfuehren)        | Ausstehend           |
| Stripe Checkout in der App                     | Ausstehend           |
| Edge Functions deployen                        | Ausstehend           |
| swartschaf.de Domain verbinden                 | Ausstehend           |

---

## Lizenz

Proprietaer -- alle Rechte vorbehalten. (c) 2026 Illana De Beer

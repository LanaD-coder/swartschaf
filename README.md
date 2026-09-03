# swartschaf
### *Zeit fuer das schwarze Schaf.*

GoBD-konforme Zeiterfassungs- und Betriebs-App fuer Beauty-Salons in Deutschland.
**Domain:** swartschaf.de

> Fuer die volle Architektur, den aktuellen Baustatus und die Roadmap siehe **[CLAUDE.md](CLAUDE.md)**
> (Tagesgeschaeft, Architektur, offene Punkte) und **[PROJECT-PLAN.md](PROJECT-PLAN.md)** (Booking/
> Inventar/KI-Roadmap). Diese Datei ist nur der Schnelleinstieg.

---

## Was ist swartschaf?

SaaS-Betriebssystem fuer Friseursalons, Nagelstudios und Beauty-Betriebe — drei Saeulen: **Zeiterfassung**,
**Inventar** und **Buchung**. Der Saloninhaber pflegt einen zentralen Kalender; jeder Mitarbeiter sieht
seine eigenen Termine und startet/stoppt individuelle Timer (mehrere gleichzeitig moeglich, z.B. Highlights
+ Waschen). Laufkunden koennen jederzeit direkt erfasst werden. Beim Abschluss eines Termins waehlt der
Mitarbeiter, welche Leistungen erbracht wurden — das aktualisiert automatisch den Materialbestand und
protokolliert die Kosten. **Fernando**, ein KI-gestuetzter Einkaufsassistent (Groq), erstellt daraus eine
Bestellliste fuer Artikel unter der Mindestmenge. Alle Zeiten sind GoBD-konform gespeichert und als
Arbeitszeitnachweis (PDF) fuer das Finanzamt exportierbar.

**Buchung (oeffentliche Terminseite fuer Kunden) ist noch nicht gebaut** — naechster grosser Baustein.

**Abrechnung:** Es gibt keine In-App-Zahlungsfunktion. Abonnements werden ausserhalb der App abgewickelt.

---

## Stack

| Schicht       | Technologie                                          |
|---------------|-------------------------------------------------------|
| App           | Expo SDK 56 + Expo Router v5 (**nur Web** — kein App-Store-Vertrieb, siehe CLAUDE.md) |
| Backend       | Supabase (Auth, Postgres, Realtime, Edge Functions)  |
| Hosting       | Netlify (`expo export --platform web`)               |
| KI            | Groq (`llama-3.3-70b-versatile`) fuer Fernando        |
| State         | Zustand                                              |
| PDF           | expo-print + expo-sharing                            |
| Sprache       | Deutsch                                              |
| Datum         | date-fns mit de-Locale                               |
| Farbschema    | "Night Bordeaux → Sandy Brown" (warme Bordeaux-zu-Koralle-Palette, `utils/theme.ts`) |

---

## Schnellstart

### Voraussetzungen
- Node 20+
- Supabase-Projekt (bereits eingerichtet, Projekt-Ref `norktuyfqdfhhekldbwj`)
- Supabase CLI eingeloggt (`npx supabase login`) fuer Migrationen/Functions

### Installation

```bash
npm install
```

### Umgebungsvariablen

Kopiere `.env.example` zu `.env` und trage deine Werte ein:

```
EXPO_PUBLIC_SUPABASE_URL=https://norktuyfqdfhhekldbwj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...

SUPABASE_SERVICE_ROLE_KEY=...       # nur Edge Functions
GROQ_API_KEY=...                    # nur Edge Functions, fuer Fernando (ai-inventory-forecast)
```

Kein Stripe/Zahlungs-Env — es gibt keine In-App-Zahlungsfunktion (siehe CLAUDE.md's Billing-Hinweis).

### App starten

```bash
npx expo start            # Dev-Server (Expo Go unterstuetzt SDK 56 noch nicht — Web oder Dev-Client nutzen)
npx expo start --web      # Web-Version im Browser
npm run build:web         # Web-Build fuer Netlify (-> dist/)
```

### Migrationen ausfuehren

Migrationsdateien liegen unter `supabase/migrations/` und werden ueber die Supabase CLI direkt gegen die
Datenbank ausgefuehrt (kein `supabase db push` — die Historie ist nicht vollstaendig CLI-getrackt, siehe
CLAUDE.md's "Known Issues" zu Schema-Drift):

```bash
npx supabase link --project-ref norktuyfqdfhhekldbwj
npx supabase db query --linked --file "supabase/migrations/<datei>.sql"
```

### Edge Functions deployen

```bash
npx supabase functions deploy create-employee        --project-ref norktuyfqdfhhekldbwj
npx supabase functions deploy ai-inventory-forecast   --project-ref norktuyfqdfhhekldbwj
```
`stripe-webhook` bewusst **nicht** deployen — siehe CLAUDE.md's Billing-Hinweis.

---

## Projektstruktur

```
app/
  (auth)/         login.tsx, employee-pin.tsx, register.tsx
  (owner)/        index (Dashboard), calendar.tsx, appointments/{new,[id]}.tsx,
                  employees/{index,[id]}.tsx, corrections.tsx, reports/{index,vault}.tsx,
                  settings.tsx, services/index.tsx (Leistungen mit Preisen),
                  inventory/index.tsx (Verbrauchsmaterial, Produktverbrauch, Verkaufsprodukte, Fernando)
  (employee)/     index (Termine + Timer + Laufkunde), history.tsx, correction.tsx
  legal/          impressum.tsx, datenschutz.tsx, agb.tsx

components/       AppointmentCard.tsx, AvatarPicker.tsx, ComplianceAlert.tsx, HelpButton.tsx
hooks/            useActiveAppointments.ts
store/            authStore.ts, appointmentStore.ts
utils/            compliance.ts, pdf.ts (Arbeitszeitnachweis + Fernandos Bestellliste), dateFormat.ts,
                  theme.ts, helpContent.ts, onboardingContent.ts, reportsVault.ts
lib/              supabase.ts, types.ts

supabase/
  functions/      create-employee/, ai-inventory-forecast/ (Fernando), stripe-webhook/ (undeployed)
  migrations/     001–015 (siehe CLAUDE.md fuer die vollstaendige Liste)

assets/           icon.png, splash.png, adaptive-icon.png, favicon.png
declarations.d.ts
```

---

## Rollen & Login

| Rolle          | Login                        | Zugang                                                    |
|----------------|-------------------------------|-----------------------------------------------------------|
| **Inhaber**    | E-Mail + Passwort            | Kalender CRUD, Mitarbeiter, Leistungen, Inventar, Korrekturen, Berichte |
| **Mitarbeiter**| Saloncode (6 Zeichen) + PIN  | Eigene Termine, Timer, Laufkunden, Korrekturanfragen      |

---

## Deployment

### Web (Netlify)
Netlify deployt automatisch bei jedem Push auf `main`.
- Build command: `npm install && npm run build:web`
- Publish dir: `dist`
- Domain: swartschaf.de (Verbindung noch ausstehend, siehe CLAUDE.md)

Kein iOS/Android-Build-Prozess — Vertrieb ist bewusst web-only (siehe CLAUDE.md's Overview).

---

## Baustatus (kurz — Details in CLAUDE.md)

| Bereich                                         | Status               |
|--------------------------------------------------|----------------------|
| Schema/RLS (Migrationen 001–015)                 | Erledigt             |
| Auth-Flows (Inhaber + Mitarbeiter-PIN)           | Erledigt             |
| Zeiterfassung (Timer, Laufkunden, AZG-Warnungen) | Erledigt             |
| Trial-Lock (Nur-Lese-Modus nach Ablauf)          | Erledigt             |
| Leistungen (Preisvarianten je Service)           | Erledigt             |
| Inventar (Verbrauchsmaterial + Produktverbrauch + Verkaufsprodukte) | Erledigt |
| Fernando (KI-Bestellliste via Groq)              | Erledigt             |
| PDF-Berichte + Bestelllisten-Export              | Erledigt             |
| **Buchung (oeffentliche Terminseite)**           | **Nicht begonnen**   |
| Steuernummer im Impressum                        | Ausstehend (Platzhalter) |
| swartschaf.de Domain verbinden                   | Ausstehend           |

---

## Lizenz

Proprietaer -- alle Rechte vorbehalten. (c) 2026 Illana De Beer

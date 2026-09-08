export type HelpPageKey =
  | 'ownerDashboard'
  | 'calendar'
  | 'settings'
  | 'corrections'
  | 'appointmentNew'
  | 'appointmentDetail'
  | 'employeesList'
  | 'employeeDetail'
  | 'reports'
  | 'reportsVault'
  | 'employeeHome'
  | 'employeeHistory'
  | 'employeeCorrection'
  | 'login'
  | 'register'
  | 'employeePin'
  | 'inventory'
  | 'services';

export interface HelpEntry {
  title: string;
  body: string;
}

export const helpContent: Record<HelpPageKey, HelpEntry> = {
  ownerDashboard: {
    title: 'Startseite',
    body:
      'Hier sehen Sie Ihre wichtigsten Kennzahlen für heute: Termine, aktive Mitarbeiter und offene Zeitkorrekturen. ' +
      'Tippen Sie auf Ihr Profilbild oben, um ein Foto hochzuladen. Über die Kacheln gelangen Sie zu Kalender, Mitarbeitern, ' +
      'Zeitkorrekturen und Berichten – das kleine "i" auf jeder Kachel zeigt eine kurze Erklärung. Falls Sie selbst mitarbeiten, ' +
      'können Sie hier auch eine eigene Pause (Mittag, Kaffee, krank, frei) starten und stoppen.',
  },
  calendar: {
    title: 'Kalender',
    body:
      'Die Tagesansicht zeigt alle Termine aller Mitarbeiter für den ausgewählten Tag. Mit den Pfeilen wechseln Sie zwischen ' +
      'den Tagen. Jeder Termin zeigt Kunde, Uhrzeit und Status farblich markiert – Grau: geplant, Grün: läuft gerade, ' +
      'Lila: fertig, Orange: nicht erschienen, Rot: storniert. Tippen Sie auf einen Termin, um Details zu sehen oder ihn zu bearbeiten.',
  },
  settings: {
    title: 'Einstellungen',
    body:
      'Hier verwalten Sie Ihr Profil (Foto durch Antippen ändern) sowie die Salon-Daten wie Name, Steuernummer und Adresse – ' +
      'diese erscheinen automatisch auf jedem PDF-Bericht. Unter "Hilfe" können Sie das Einführungs-Tutorial jederzeit erneut ' +
      'ansehen. Über "Abmelden" verlassen Sie Ihr Konto.',
  },
  corrections: {
    title: 'Zeitkorrekturen',
    body:
      'Wenn ein Mitarbeiter eine falsch erfasste Zeit korrigieren möchte, stellt er hier einen Antrag statt die Zeit selbst zu ' +
      'ändern – so bleiben die Originaldaten für das Finanzamt GoBD-konform erhalten. Sie sehen Vorher/Nachher-Zeiten und die ' +
      'Begründung und können den Antrag genehmigen (die Zeit wird dann aktualisiert) oder ablehnen.',
  },
  appointmentNew: {
    title: 'Neuer Termin',
    body:
      'Legen Sie einen neuen Termin an: Kunde, Mitarbeiter, Leistung sowie geplante Start- und Endzeit. Der Termin erscheint ' +
      'danach im Kalender und auf der Startseite des zugewiesenen Mitarbeiters, der den Timer selbst startet, sobald die ' +
      'Behandlung beginnt.',
  },
  appointmentDetail: {
    title: 'Termindetails',
    body:
      'Hier sehen Sie geplante und tatsächliche Zeiten eines Termins. Über die Symbole oben können Sie den Termin als ' +
      '"Nicht erschienen" markieren oder stornieren. Die tatsächlichen Start-/Endzeiten setzt der Mitarbeiter selbst über ' +
      'seinen eigenen Timer – als Inhaber ändern Sie diese nicht direkt, sondern über eine genehmigte Zeitkorrektur.',
  },
  employeesList: {
    title: 'Mitarbeiter',
    body:
      'Hier legen Sie neue Mitarbeiter an: Name, ein 6-stelliger PIN zur Anmeldung und eine Farbe für den Kalender. Der PIN ' +
      'wird sicher verschlüsselt gespeichert. Mit dem Pause/Play-Symbol können Sie einen Mitarbeiter vorübergehend deaktivieren, ' +
      'ohne seine Daten zu löschen – deaktivierte Mitarbeiter können sich dann nicht mehr anmelden. Ein Warnsymbol bei einem ' +
      'Mitarbeiter bedeutet: Die Sofortmeldung beim Zoll steht für diese Person noch aus (Pflicht im Friseurhandwerk).',
  },
  employeeDetail: {
    title: 'Mitarbeiter-Verlauf',
    body:
      'Oben sehen Sie den Compliance-Status: Sofortmeldung beim Zoll (Pflicht im Friseurhandwerk vor dem ersten Arbeitstag) ' +
      'und die Bestätigung, dass der Mitarbeiter über die Ausweispflicht am Arbeitsplatz informiert wurde. Darunter finden Sie ' +
      'die abgeschlossenen Termine mit Gesamtstunden – nützlich, um die Arbeitszeit vor der Erstellung eines Berichts zu prüfen.',
  },
  reports: {
    title: 'Berichte',
    body:
      'Erstellen Sie einen Arbeitszeitnachweis (PDF) für einen Mitarbeiter: Zeitraum wählen (heute, diese/letzte Woche, ' +
      'diesen/letzten Monat), dann den Mitarbeiter antippen. Der Bericht wird zum Teilen oder Speichern geöffnet und – auf dem ' +
      'Smartphone – automatisch im Archiv abgelegt, damit Sie ihn später jederzeit wiederfinden.',
  },
  reportsVault: {
    title: 'Berichtsarchiv',
    body:
      'Alle bisher erstellten Arbeitszeitnachweise, nach Monat sortiert. Berichte werden hier dauerhaft aufbewahrt und können ' +
      'nicht gelöscht werden – das entspricht der GoBD-Pflicht zur unveränderten Aufbewahrung. Tippen Sie auf das Teilen-Symbol, ' +
      'um einen bereits erstellten Bericht erneut zu versenden, ohne ihn neu zu erzeugen.',
  },
  services: {
    title: 'Leistungen',
    body:
      'Preisvarianten je Leistung: eine Kategorie (z.B. "Schneiden") kann mehrere unterschiedlich ' +
      'bepreiste Leistungen haben, z.B. "Schneiden Kurz Damen" und "Schneiden Lang Herren". Diese Preise ' +
      'werden bei der Terminabrechnung sowie für automatisch verbrauchtes Material (Inventar → Produktverbrauch) ' +
      'verwendet.',
  },
  inventory: {
    title: 'Inventar',
    body:
      'Verbrauchsmaterial (z.B. Blondierpulver, Entwickler) mit Bestand und hinterlegtem Produktverbrauch pro Leistung – der Bestand sinkt ' +
      'automatisch, wenn ein Termin mit dieser Leistung abgeschlossen wird. Verkaufsprodukte (z.B. Pflegeprodukte für ' +
      'Kunden) verwalten Sie separat. Ein rotes Symbol zeigt niedrigen Bestand an, sobald die Mindestmenge unterschritten ist. ' +
      'Im Tab "Fernando" finden Sie eine automatisch erstellte Bestellliste für alle Artikel unter der Mindestmenge, ' +
      'die Sie als PDF exportieren können.',
  },
  employeeHome: {
    title: 'Mein Tag',
    body:
      'Ihre heutigen Termine im Überblick. Bei einem Termin tippen Sie auf "Start", wenn Sie mit der Behandlung beginnen, und ' +
      'auf "Stop", wenn Sie fertig sind – mehrere Timer können gleichzeitig laufen. Über "Laufkunde" erfassen Sie spontan einen ' +
      'Kunden ohne Termin; die Leistung wählen Sie beim Stoppen. Über das Pausen-Symbol können Sie Mittag-, Kaffeepause, ' +
      'Krankheit oder einen freien Tag eintragen.',
  },
  employeeHistory: {
    title: 'Mein Verlauf',
    body:
      'Ihre bereits abgeschlossenen Termine, gruppiert nach Tag, mit tatsächlicher Arbeitszeit. Falls eine Zeit falsch erfasst ' +
      'wurde, stellen Sie über "Korrektur" einen Änderungsantrag statt die Zeit selbst zu ändern.',
  },
  employeeCorrection: {
    title: 'Korrektur beantragen',
    body:
      'Wählen Sie den betroffenen Termin, geben Sie die richtige Start-/Endzeit ein und eine kurze Begründung. Ihr Inhaber prüft ' +
      'den Antrag und genehmigt oder lehnt ihn ab – die ursprünglich erfasste Zeit bleibt in jedem Fall zusätzlich gespeichert.',
  },
  login: {
    title: 'Anmeldung',
    body:
      'Als Inhaber melden Sie sich mit E-Mail und Passwort an. Mitarbeiter melden sich stattdessen über den eigenen PIN-Code an ' +
      '(Salon-Code + 6-stelliger PIN, kein Passwort nötig).',
  },
  register: {
    title: 'Registrierung',
    body:
      'Legen Sie hier Ihren Salon an: Name, Ihre E-Mail-Adresse und ein Passwort. Sie erhalten automatisch 14 Tage kostenlose ' +
      'Testzeit und können danach zwischen Starter- und Pro-Tarif wählen.',
  },
  employeePin: {
    title: 'Mitarbeiter-Anmeldung',
    body:
      'Geben Sie den Salon-Code Ihres Betriebs sowie Ihren persönlichen 6-stelligen PIN ein, den Sie von Ihrem Inhaber erhalten ' +
      'haben. Damit gelangen Sie direkt zu Ihren eigenen Terminen.',
  },
};

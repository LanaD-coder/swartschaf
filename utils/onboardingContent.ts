export interface OnboardingSlide {
  icon: string;
  title: string;
  body: string;
}

export const OWNER_ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    icon: 'calendar',
    title: 'Ihr Kalender',
    body:
      'Im Kalender sehen Sie alle Termine Ihres Salons an einem Tag – egal welcher Mitarbeiter sie ' +
      'bearbeitet. Farben zeigen den Status: geplant, läuft gerade, fertig, nicht erschienen oder storniert. ' +
      'Neue Termine legen Sie über den runden Plus-Button an.',
  },
  {
    icon: 'people',
    title: 'Ihr Team',
    body:
      'Unter "Mitarbeiter" legen Sie Ihr Team an: Name, eine Kalenderfarbe und ein 6-stelliger PIN, mit dem ' +
      'sich der Mitarbeiter anmeldet – ganz ohne E-Mail oder Passwort. Sie können Mitarbeiter jederzeit ' +
      'pausieren, ohne ihre Daten zu verlieren.',
  },
  {
    icon: 'create',
    title: 'Zeitkorrekturen',
    body:
      'Falls ein Mitarbeiter eine Zeit falsch erfasst hat, stellt er einen Korrekturantrag statt die Zeit ' +
      'selbst zu ändern. Sie genehmigen oder lehnen ihn ab – die ursprüngliche Zeit bleibt dabei immer ' +
      'zusätzlich gespeichert, ganz im Sinne der GoBD.',
  },
  {
    icon: 'document-text',
    title: 'Berichte & Archiv',
    body:
      'Mit einem Fingertipp erstellen Sie einen Arbeitszeitnachweis als PDF für einen Mitarbeiter und ' +
      'Zeitraum Ihrer Wahl. Jeder erstellte Bericht wird automatisch im Archiv abgelegt, damit Sie ihn ' +
      'jederzeit wiederfinden – ohne ihn neu erstellen zu müssen.',
  },
];

export const EMPLOYEE_ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    icon: 'play-circle',
    title: 'Termine starten & stoppen',
    body:
      'Auf "Mein Tag" sehen Sie Ihre heutigen Termine. Tippen Sie auf "Start", wenn Sie mit der Behandlung ' +
      'beginnen, und auf "Stop", wenn Sie fertig sind. Mehrere Termine können gleichzeitig laufen – zum ' +
      'Beispiel, wenn eine Farbe einwirkt, während Sie einen anderen Kunden waschen.',
  },
  {
    icon: 'flash',
    title: 'Laufkunden',
    body:
      'Kommt ein Kunde spontan ohne Termin herein? Tippen Sie einfach auf "Laufkunde" und der Timer startet ' +
      'sofort. Die passende Leistung wählen Sie erst beim Stoppen aus.',
  },
  {
    icon: 'cafe',
    title: 'Pausen',
    body:
      'Über das Pausen-Symbol tragen Sie Mittag- oder Kaffeepause, Krankheit oder einen freien Tag ein. ' +
      'Das hilft, Ihre Arbeitszeit korrekt zu dokumentieren.',
  },
  {
    icon: 'create',
    title: 'Korrektur beantragen',
    body:
      'Falls eine Zeit falsch erfasst wurde, ändern Sie sie nicht selbst, sondern stellen Sie unter ' +
      '"Korrektur" einen Antrag mit Begründung. Ihr Inhaber prüft und genehmigt ihn.',
  },
];

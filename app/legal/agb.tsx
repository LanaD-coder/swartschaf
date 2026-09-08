import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { colors, layout } from '@/utils/theme';

export default function AGB() {
  return (
    <>
      <Stack.Screen options={{ title: 'Nutzungsbedingungen' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Nutzungsbedingungen</Text>
        <Text style={styles.muted}>Allgemeine Geschäftsbedingungen (AGB) · Stand: Juni 2026</Text>

        <Text style={styles.h2}>§ 1 Geltungsbereich</Text>
        <Text style={styles.body}>
          Diese AGB gelten für die Nutzung der SaaS-Plattform „Swartschaf" (swartschaf.de),
          betrieben von Illana De Beer, Oberdreisbach-Höhe, 53804 Much, Deutschland
          (nachfolgend „Anbieterin"), durch Unternehmer im Sinne des § 14 BGB
          (nachfolgend „Kunde").
        </Text>

        <Text style={styles.h2}>§ 2 Leistungsbeschreibung</Text>
        <Text style={styles.body}>
          Swartschaf ist eine cloudbasierte Zeiterfassungssoftware für Friseursalons und
          Beauty-Betriebe. Der Leistungsumfang umfasst:{'\n\n'}
          • Terminverwaltung und digitale Zeiterfassung{'\n'}
          • GoBD-konforme Arbeitszeitnachweise als PDF-Export{'\n'}
          • Verwaltung von Mitarbeitern und Leistungskategorien{'\n'}
          • Erfassung von Laufkunden{'\n'}
          • AZG-Konformitätswarnungen
        </Text>

        <Text style={styles.h2}>§ 3 Vertragsschluss und Testphase</Text>
        <Text style={styles.body}>
          Mit der Registrierung gibt der Kunde ein verbindliches Angebot zum Abschluss
          eines Nutzungsvertrages ab. Der Vertrag kommt mit Freischaltung des Kontos zustande.{'\n\n'}
          Neukunden erhalten eine kostenlose Testphase von 14 Tagen. Nach Ablauf der
          Testphase ist zur weiteren Nutzung ein kostenpflichtiger Tarif erforderlich.
          Es erfolgt keine automatische Konvertierung ohne aktive Zahlungsmethode.
        </Text>

        <Text style={styles.h2}>§ 4 Tarife und Preise</Text>
        <Text style={styles.body}>
          <Text style={styles.bold}>Starter:</Text> bis 3 aktive Mitarbeiter · 9,99 € / Monat{'\n'}
          <Text style={styles.bold}>Pro:</Text> unbegrenzte Mitarbeiter · 19,99 € / Monat{'\n\n'}
          Alle Preise verstehen sich zzgl. der gesetzlichen Mehrwertsteuer.{'\n'}
          Die Abrechnung erfolgt monatlich im Voraus über Stripe.
        </Text>

        <Text style={styles.h2}>§ 5 Zahlung</Text>
        <Text style={styles.body}>
          Die Zahlung erfolgt per Kreditkarte oder SEPA-Lastschrift über den
          Zahlungsdienstleister Stripe. Bei fehlgeschlagener Zahlung wird das Konto
          in einen eingeschränkten Lesemodus versetzt. Zeitdaten bleiben erhalten
          und können weiterhin exportiert werden.
        </Text>

        <Text style={styles.h2}>§ 6 Kündigung</Text>
        <Text style={styles.body}>
          Der Vertrag kann jederzeit zum Ende des laufenden Abrechnungszeitraums
          gekündigt werden — über das Kundenportal (Stripe Customer Portal) oder per
          E-Mail an hallo@swartschaf.de.{'\n\n'}
          Nach Kündigung bleiben alle erfassten Zeitdaten für 30 Tage abrufbar und
          exportierbar. Danach werden die Daten gemäß den gesetzlichen
          Aufbewahrungsfristen behandelt.
        </Text>

        <Text style={styles.h2}>§ 7 Pflichten des Kunden</Text>
        <Text style={styles.body}>
          Der Kunde ist verpflichtet:{'\n'}
          • Zugangsdaten sicher zu verwahren{'\n'}
          • Mitarbeiter-PINs regelmäßig zu aktualisieren{'\n'}
          • Die Software ausschließlich für legale Zwecke zu nutzen{'\n'}
          • Keine automatisierten Abfragen oder Scraping durchzuführen{'\n'}
          • Korrekte Angaben bei der Registrierung zu machen
        </Text>

        <Text style={styles.h2}>§ 8 Verfügbarkeit</Text>
        <Text style={styles.body}>
          Die Anbieterin strebt eine Verfügbarkeit von 99 % im Jahresmittel an,
          ausgenommen geplante Wartungsarbeiten. Ein Anspruch auf ununterbrochene
          Verfügbarkeit besteht nicht.
        </Text>

        <Text style={styles.h2}>§ 9 Haftung</Text>
        <Text style={styles.body}>
          Die Anbieterin haftet unbeschränkt für Schäden aus der Verletzung des Lebens,
          des Körpers oder der Gesundheit sowie bei Vorsatz und grober Fahrlässigkeit.{'\n\n'}
          Bei einfacher Fahrlässigkeit haftet die Anbieterin nur bei Verletzung einer
          wesentlichen Vertragspflicht (Kardinalpflicht), begrenzt auf den vorhersehbaren,
          vertragstypischen Schaden.{'\n\n'}
          Die Anbieterin übernimmt keine Haftung für die steuerliche oder rechtliche
          Korrektheit der exportierten Dokumente. Der Kunde ist für die Prüfung der
          Dokumente durch einen Steuerberater verantwortlich.
        </Text>

        <Text style={styles.h2}>§ 10 Datenschutz</Text>
        <Text style={styles.body}>
          Es gilt die separate Datenschutzerklärung unter swartschaf.de/datenschutz.
          Der Kunde erklärt sich als Auftraggeber im Sinne des Art. 28 DSGVO und ist
          für die Rechtmäßigkeit der in Swartschaf eingegebenen personenbezogenen Daten
          (insb. Mitarbeiter- und Kundendaten) verantwortlich.
        </Text>

        <Text style={styles.h2}>§ 11 Anzuwendendes Recht und Gerichtsstand</Text>
        <Text style={styles.body}>
          Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
          UN-Kaufrechts.{'\n\n'}
          Ist der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder
          öffentlich-rechtliches Sondervermögen, ist ausschließlicher Gerichtsstand
          für alle Streitigkeiten aus diesem Vertrag Köln.
        </Text>

        <Text style={styles.h2}>§ 12 Änderungen der AGB</Text>
        <Text style={styles.body}>
          Die Anbieterin behält sich vor, diese AGB mit einer Frist von 30 Tagen
          zu ändern. Der Kunde wird per E-Mail informiert. Widerspricht der Kunde
          nicht innerhalb von 30 Tagen, gelten die neuen AGB als angenommen.
        </Text>

        <View style={styles.spacer} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 60, ...layout.contentWidth },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 4 },
  muted: { fontSize: 13, color: colors.textMuted, marginBottom: 24 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 24, marginBottom: 8 },
  body: { fontSize: 15, color: colors.textLight, lineHeight: 24 },
  bold: { fontWeight: '700', color: colors.text },
  spacer: { height: 40 },
});

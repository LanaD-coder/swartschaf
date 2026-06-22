import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/utils/theme';

export default function Datenschutz() {
  return (
    <>
      <Stack.Screen options={{ title: 'Datenschutzerklärung' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Datenschutzerklärung</Text>
        <Text style={styles.muted}>Stand: Juni 2026</Text>

        <Text style={styles.h2}>1. Verantwortliche</Text>
        <Text style={styles.body}>
          Illana De Beer{'\n'}
          Oberdreisbach-Höhe, 53804 Much, Deutschland{'\n'}
          E-Mail: hallo@swartschaf.de
        </Text>

        <Text style={styles.h2}>2. Erhobene Daten</Text>
        <Text style={styles.body}>
          Wir verarbeiten folgende personenbezogene Daten:{'\n\n'}
          <Text style={styles.bold}>Beim Registrieren (Inhaber):{'\n'}</Text>
          Name, E-Mail-Adresse, Passwort (verschlüsselt), Salonname, Steuernummer, Adresse.{'\n\n'}
          <Text style={styles.bold}>Im laufenden Betrieb:{'\n'}</Text>
          Mitarbeiternamen, Arbeitszeiten, Kundennamen (von Ihnen eingegeben), Termindetails.{'\n\n'}
          <Text style={styles.bold}>Technische Daten:{'\n'}</Text>
          IP-Adresse, Geräteinformationen, Zeitstempel (Log-Daten durch Supabase/Netlify).
        </Text>

        <Text style={styles.h2}>3. Zweck der Verarbeitung</Text>
        <Text style={styles.body}>
          • Bereitstellung der Zeiterfassungs-Software (Vertragserfüllung, Art. 6 Abs. 1 lit. b DSGVO){'\n'}
          • GoBD-konforme Arbeitszeitnachweise für das Finanzamt (rechtliche Verpflichtung, Art. 6 Abs. 1 lit. c DSGVO){'\n'}
          • Abrechnung über Stripe (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO){'\n'}
          • Technischer Betrieb und Sicherheit der Plattform
        </Text>

        <Text style={styles.h2}>4. Auftragsverarbeiter</Text>
        <Text style={styles.body}>
          <Text style={styles.bold}>Supabase Inc.{'\n'}</Text>
          Datenbankhosting und Authentifizierung.{'\n'}
          Rechenzentrum: EU (Frankfurt).{'\n'}
          Datenschutz: https://supabase.com/privacy{'\n\n'}

          <Text style={styles.bold}>Netlify Inc.{'\n'}</Text>
          Hosting der Web-App.{'\n'}
          Datenschutz: https://www.netlify.com/privacy/{'\n\n'}

          <Text style={styles.bold}>Stripe Inc.{'\n'}</Text>
          Zahlungsabwicklung.{'\n'}
          Datenschutz: https://stripe.com/de/privacy{'\n\n'}

          Mit allen Auftragsverarbeitern bestehen oder werden Auftragsverarbeitungsverträge (AVV)
          gemäß Art. 28 DSGVO geschlossen.
        </Text>

        <Text style={styles.h2}>5. Speicherdauer</Text>
        <Text style={styles.body}>
          Arbeitszeitdaten werden gemäß GoBD mindestens 10 Jahre aufbewahrt.{'\n'}
          Kontodaten werden nach Kündigung und Ablauf der gesetzlichen Aufbewahrungsfristen gelöscht.{'\n'}
          Zahlungsdaten werden gemäß steuerrechtlicher Pflichten (§ 147 AO) 10 Jahre gespeichert.
        </Text>

        <Text style={styles.h2}>6. Ihre Rechte</Text>
        <Text style={styles.body}>
          Sie haben das Recht auf:{'\n'}
          • Auskunft (Art. 15 DSGVO){'\n'}
          • Berichtigung (Art. 16 DSGVO){'\n'}
          • Löschung (Art. 17 DSGVO) — soweit keine gesetzliche Aufbewahrungspflicht besteht{'\n'}
          • Einschränkung der Verarbeitung (Art. 18 DSGVO){'\n'}
          • Datenübertragbarkeit (Art. 20 DSGVO){'\n'}
          • Widerspruch (Art. 21 DSGVO){'\n\n'}
          Zur Ausübung Ihrer Rechte wenden Sie sich an: hallo@swartschaf.de{'\n\n'}
          Sie haben außerdem das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.
          Zuständig ist der Landesbeauftragte für Datenschutz Nordrhein-Westfalen.
        </Text>

        <Text style={styles.h2}>7. Datensicherheit</Text>
        <Text style={styles.body}>
          Alle Daten werden verschlüsselt übertragen (TLS/HTTPS). Passwörter werden
          ausschließlich verschlüsselt gespeichert. Der Zugriff auf Daten ist durch
          Row Level Security (RLS) auf Datenbankebene auf den jeweiligen Salon beschränkt.
        </Text>

        <Text style={styles.h2}>8. Cookies</Text>
        <Text style={styles.body}>
          Die Web-App verwendet ausschließlich technisch notwendige Cookies zur Aufrechterhaltung
          der Anmeldesitzung. Es werden keine Tracking- oder Werbe-Cookies eingesetzt.
        </Text>

        <View style={styles.spacer} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 60 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 4 },
  muted: { fontSize: 13, color: colors.textMuted, marginBottom: 24 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 24, marginBottom: 8 },
  body: { fontSize: 15, color: colors.textLight, lineHeight: 24 },
  bold: { fontWeight: '700', color: colors.text },
  spacer: { height: 40 },
});

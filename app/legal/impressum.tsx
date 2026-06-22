import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/utils/theme';

export default function Impressum() {
  return (
    <>
      <Stack.Screen options={{ title: 'Impressum' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Impressum</Text>
        <Text style={styles.muted}>Angaben gemäß § 5 TMG</Text>

        <Text style={styles.h2}>Verantwortlich</Text>
        <Text style={styles.body}>
          Illana De Beer{'\n'}
          Oberdreisbach-Höhe{'\n'}
          53804 Much{'\n'}
          Deutschland
        </Text>

        <Text style={styles.h2}>Kontakt</Text>
        <Text style={styles.body}>
          E-Mail: hallo@swartschaf.de{'\n'}
          {/* Add phone if desired: Telefon: +49 ... */}
        </Text>

        <Text style={styles.h2}>Steuerliche Angaben</Text>
        <Text style={styles.body}>
          Steuernummer: [Ihre Steuernummer]{'\n'}
          {/* Falls vorhanden: USt-IdNr.: DE ... */}
        </Text>

        <Text style={styles.h2}>Berufsbezeichnung</Text>
        <Text style={styles.body}>
          Softwareentwicklerin / IT-Dienstleisterin{'\n'}
          Tätig in Deutschland
        </Text>

        <Text style={styles.h2}>Streitschlichtung</Text>
        <Text style={styles.body}>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{'\n'}
          https://ec.europa.eu/consumers/odr{'\n\n'}
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </Text>

        <Text style={styles.h2}>Haftung für Inhalte</Text>
        <Text style={styles.body}>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten
          nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
          Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
          Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
          Tätigkeit hinweisen.
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
  spacer: { height: 40 },
});

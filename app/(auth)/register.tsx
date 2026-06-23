import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/utils/theme';

export default function RegisterScreen() {
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [steuernummer, setSteuernummer] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!salonName || !ownerName || !email || !password) {
      Alert.alert('Fehler', 'Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error || !data.user) {
      setLoading(false);
      Alert.alert('Fehler', error?.message ?? 'Registrierung fehlgeschlagen.');
      return;
    }

    const salonCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: salon, error: salonErr } = await supabase
      .from('salons')
      .insert({
        name: salonName,
        steuernummer,
        salon_code: salonCode,
        subscription_status: 'trialing',
        owner_id: data.user.id,
      })
      .select()
      .single();

    if (salonErr || !salon) {
      setLoading(false);
      Alert.alert('Fehler', 'Salon konnte nicht erstellt werden.');
      return;
    }

    await supabase.from('profiles').insert({
      id: data.user.id,
      salon_id: salon.id,
      full_name: ownerName,
      role: 'owner',
      color: '#e94560',
      is_active: true,
    });

    // Seed default service categories
    const defaultCategories = [
      { name: 'Haare', color: '#e94560' },
      { name: 'Nägel', color: '#9b59b6' },
      { name: 'Waxing', color: '#f39c12' },
      { name: 'Makeup', color: '#e67e22' },
      { name: 'Massage', color: '#2ecc71' },
      { name: 'Kosmetik', color: '#3498db' },
    ];
    await supabase.from('service_categories').insert(
      defaultCategories.map((c) => ({ ...c, salon_id: salon.id, is_active: true }))
    );

    setLoading(false);
    Alert.alert(
      'Willkommen!',
      `Ihr Saloncode lautet: ${salonCode}\n\nTeilen Sie diesen Code mit Ihren Mitarbeitern.`
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>swartschaf</Text>
        <Text style={styles.slogan}>Zeit für das schwarze Schaf.</Text>
        <Text style={styles.title}>Salon registrieren</Text>

        <Text style={styles.label}>Salonname *</Text>
        <TextInput style={styles.input} value={salonName} onChangeText={setSalonName} placeholder="z.B. Beauty Lounge Berlin" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Ihr Name *</Text>
        <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Vor- und Nachname" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>E-Mail *</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="inhaber@salon.de" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>Passwort *</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mindestens 8 Zeichen" placeholderTextColor={colors.textMuted} secureTextEntry />

        <Text style={styles.label}>Steuernummer (optional)</Text>
        <TextInput style={styles.input} value={steuernummer} onChangeText={setSteuernummer} placeholder="123/456/78901" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Registrieren...' : 'Kostenlos starten (14 Tage)'}
          </Text>
        </TouchableOpacity>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => router.push('/legal/agb')}>
            <Text style={styles.legalLink}>Nutzungsbedingungen</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}> · </Text>
          <TouchableOpacity onPress={() => router.push('/legal/datenschutz')}>
            <Text style={styles.legalLink}>Datenschutz</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}> · </Text>
          <TouchableOpacity onPress={() => router.push('/legal/impressum')}>
            <Text style={styles.legalLink}>Impressum</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.legal}>
          Mit der Registrierung stimmen Sie den Nutzungsbedingungen und der Datenschutzerklärung zu.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, gap: 6 },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 2,
  },
  slogan: {
    fontSize: 16,
    fontWeight: '300',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  label: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  legalLink: {
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  legalSep: {
    fontSize: 13,
    color: colors.textMuted,
  },
  legal: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
});

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { colors, layout } from '@/utils/theme';

export default function RegisterScreen() {
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [steuernummer, setSteuernummer] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);

  async function handleRegister() {
    setErrorMsg(null);
    if (!salonName || !ownerName || !email || !password) {
      setErrorMsg('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error || !data.user) {
        setErrorMsg(error?.message ?? 'Registrierung fehlgeschlagen.');
        return;
      }

      // If email confirmation is required, session is null
      if (!data.session) {
        setConfirmedEmail(email);
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
        setErrorMsg(`Salon-Fehler: ${salonErr?.message ?? 'Salon konnte nicht erstellt werden.'}`);
        return;
      }

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: data.user.id,
        salon_id: salon.id,
        full_name: ownerName,
        role: 'owner',
        color: colors.primary,
        is_active: true,
      });

      if (profileErr) {
        setErrorMsg(`Profil-Fehler: ${profileErr.message}`);
        return;
      }

      const defaultCategories = [
        { name: 'Haare', color: colors.primary },
        { name: 'Nägel', color: colors.surface },
        { name: 'Waxing', color: colors.warning },
        { name: 'Makeup', color: colors.timerActive },
        { name: 'Massage', color: colors.success },
        { name: 'Kosmetik', color: colors.primaryDark },
      ];
      await supabase.from('service_categories').insert(
        defaultCategories.map((c) => ({ ...c, salon_id: salon.id, is_active: true }))
      );

      // Route through '/' — app/index.tsx gates on has_seen_onboarding (new owners
      // start unseen); navigating directly here would skip that check.
      router.replace('/');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  }

  if (confirmedEmail) {
    return (
      <View style={styles.container}>
        <View style={styles.confirmCard}>
          <Ionicons name="mail-outline" size={56} color={colors.primary} />
          <Text style={styles.confirmTitle}>E-Mail bestätigen</Text>
          <Text style={styles.confirmText}>
            Wir haben eine Bestätigungs-E-Mail an
          </Text>
          <Text style={styles.confirmEmail}>{confirmedEmail}</Text>
          <Text style={styles.confirmText}>
            gesendet. Bitte klicken Sie auf den Link in der E-Mail, bevor Sie sich anmelden.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.buttonText}>Zur Anmeldung</Text>
          </TouchableOpacity>
        </View>
      </View>
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

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

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
  scroll: { padding: 24, gap: 6, ...layout.formWidth },
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
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    margin: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FDE8E8',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
});

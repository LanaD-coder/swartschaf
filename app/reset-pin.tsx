import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { colors, layout } from '@/utils/theme';

// Mandatory gate — no back button, no skip. Reached only via app/index.tsx's redirect
// when profile.must_reset_pin is true (owner-set initial PIN, or an owner-issued reset).
export default function ResetPinScreen() {
  const { profile } = useAuthStore();
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit() {
    setErrorMsg(null);
    if (newPin.length !== 6) {
      setErrorMsg('Bitte eine 6-stellige PIN eingeben.');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('Die PINs stimmen nicht überein.');
      return;
    }
    if (!profile) return;
    setSaving(true);

    // 1. Auth password — what signInWithPassword actually checks.
    const { error: authErr } = await supabase.auth.updateUser({ password: newPin });
    if (authErr) {
      setSaving(false);
      setErrorMsg(authErr.message);
      return;
    }

    // 2. profiles.pin_hash — what the pre-auth verify_employee_pin RPC checks.
    // The hash_pin_on_write trigger bcrypt-hashes this automatically.
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ pin_hash: newPin, must_reset_pin: false })
      .eq('id', profile.id);

    setSaving(false);

    if (profileErr) {
      setErrorMsg(profileErr.message);
      return;
    }

    useAuthStore.getState().setProfile({ ...profile, must_reset_pin: false });
    // Back through '/' — app/index.tsx decides the next hop (onboarding, then home).
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.title}>Neue PIN festlegen</Text>
        <Text style={styles.subtitle}>
          Aus Sicherheitsgründen müssen Sie bei der ersten Anmeldung eine eigene PIN vergeben.
        </Text>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <Text style={styles.label}>Neue PIN (6 Ziffern)</Text>
        <TextInput
          style={styles.input}
          value={newPin}
          onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />

        <Text style={styles.label}>PIN bestätigen</Text>
        <TextInput
          style={styles.input}
          value={confirmPin}
          onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={submit}
          disabled={saving}
        >
          <Text style={styles.buttonText}>{saving ? 'Speichern...' : 'PIN festlegen'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 6, ...layout.formWidth },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 4 },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  label: { fontSize: 13, color: colors.textMuted, marginTop: 10 },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorBox: {
    backgroundColor: '#FDE8E8',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    marginBottom: 8,
  },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
});

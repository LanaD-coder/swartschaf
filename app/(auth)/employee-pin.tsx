import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/utils/theme';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function EmployeePinScreen() {
  const [salonCode, setSalonCode] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'salon' | 'pin'>('salon');
  const [loading, setLoading] = useState(false);

  function onKey(key: string) {
    if (key === '⌫') {
      if (step === 'salon') setSalonCode((v) => v.slice(0, -1));
      else setPin((v) => v.slice(0, -1));
      return;
    }
    if (step === 'salon') {
      const next = (salonCode + key).slice(0, 6);
      setSalonCode(next);
    } else {
      const next = (pin + key).slice(0, 4);
      setPin(next);
      if (next.length === 4) handleLogin(next);
    }
  }

  async function handleLogin(enteredPin: string) {
    setLoading(true);

    // Step 1: verify PIN via SECURITY DEFINER function (no session needed)
    const { data, error } = await supabase.rpc('verify_employee_pin', {
      p_salon_code: salonCode.toUpperCase(),
      p_pin: enteredPin,
    });

    if (error || !data || data.length === 0) {
      setLoading(false);
      Alert.alert('Fehler', 'Saloncode oder PIN nicht korrekt.');
      setPin('');
      return;
    }

    const { user_id } = data[0];

    // Step 2: sign in with the internal email + PIN as password
    const email = `emp_${user_id}@swartschaf.internal`;
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: enteredPin,
    });

    setLoading(false);

    if (signInErr) {
      Alert.alert('Anmeldefehler', 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
      setPin('');
      return;
    }

    // Auth state change in _layout.tsx will load profile + salon and redirect
    router.replace('/(employee)');
  }

  const current = step === 'salon' ? salonCode : pin;
  const dots = step === 'pin' ? 4 : 6;

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>swartschaf</Text>
      <Text style={styles.title}>
        {step === 'salon' ? 'Saloncode eingeben' : 'PIN eingeben'}
      </Text>
      {loading && <Text style={styles.loadingText}>Anmelden...</Text>}

      <View style={styles.dotsRow}>
        {Array.from({ length: dots }).map((_, i) => (
          <View key={i} style={[styles.dot, i < current.length && styles.dotFilled]} />
        ))}
      </View>

      {step === 'salon' && salonCode.length === 6 && (
        <TouchableOpacity style={styles.nextButton} onPress={() => setStep('pin')}>
          <Text style={styles.nextButtonText}>Weiter</Text>
        </TouchableOpacity>
      )}

      <View style={styles.keypad}>
        {KEYS.map((key, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.key, key === '' && styles.keyEmpty]}
            onPress={() => key !== '' && onKey(key)}
            disabled={loading || key === ''}
          >
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>Inhaber-Anmeldung</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  logo: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
  title: { fontSize: 18, color: colors.text, fontWeight: '600' },
  loadingText: { fontSize: 14, color: colors.textMuted },
  dotsRow: { flexDirection: 'row', gap: 14 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.border,
    borderWidth: 2, borderColor: colors.textMuted,
  },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: 240, gap: 12, justifyContent: 'center',
  },
  key: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  keyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { fontSize: 24, color: colors.text, fontWeight: '500' },
  link: { color: colors.primary, fontSize: 14, marginTop: 8 },
});

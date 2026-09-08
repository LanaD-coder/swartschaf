import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/utils/theme';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

interface EmployeeOption {
  id: string;
  full_name: string;
}

export default function EmployeePinScreen() {
  const [salonCode, setSalonCode] = useState('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'salon' | 'name' | 'pin'>('salon');
  const [loading, setLoading] = useState(false);
  // Alert.alert is unreliable on React Native Web (can silently no-op instead of
  // showing anything) — every other auth screen uses an inline error box instead;
  // this one didn't, which very likely made a real login failure look like "nothing
  // happens" rather than a visible error.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Saloncode is base-36 (generated as Math.random().toString(36)...toUpperCase() —
  // register.tsx), so it's letters AND digits (e.g. "X34TEZ"). A digits-only keypad
  // has no way to type a letter at all — that made some real saloncodes literally
  // impossible to enter. This step is a normal text field for that reason; the
  // keypad is kept only for the PIN step, which genuinely is digits-only by design.
  function onSalonCodeChange(v: string) {
    setErrorMsg(null);
    setSalonCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  }

  // Login used to go straight from Saloncode to a blind PIN guess — the flow never
  // identified *which* employee was attempting, since a wrong PIN doesn't match
  // anyone. That made a precise per-employee lockout impossible. This step fixes
  // that at the root: list the salon's employees by name, employee picks themself,
  // *then* enters their PIN against that specific profile.
  async function loadEmployees() {
    setErrorMsg(null);
    setLoading(true);
    const { data, error } = await supabase.rpc('list_salon_employees', {
      p_salon_code: salonCode.toUpperCase(),
    });
    setLoading(false);
    if (error || !data || data.length === 0) {
      if (error) console.error('list_salon_employees error:', error);
      setErrorMsg('Saloncode nicht gefunden oder keine Mitarbeiter vorhanden.');
      return;
    }
    setEmployees(data as EmployeeOption[]);
    setStep('name');
  }

  function selectEmployee(emp: EmployeeOption) {
    setErrorMsg(null);
    setSelectedEmployee(emp);
    setPin('');
    setStep('pin');
  }

  function onKey(key: string) {
    setErrorMsg(null);
    if (key === '⌫') {
      setPin((v) => v.slice(0, -1));
      return;
    }
    const next = (pin + key).slice(0, 6);
    setPin(next);
    if (next.length === 6) handleLogin(next);
  }

  async function handleLogin(enteredPin: string) {
    if (!selectedEmployee) return;
    setLoading(true);
    setErrorMsg(null);

    // Step 1: verify PIN via SECURITY DEFINER function (no session needed) — now
    // scoped to the specific employee picked in the previous step, which is what
    // makes the 3-strikes lockout (enforced server-side) precise instead of
    // salon-wide.
    const { data, error } = await supabase.rpc('verify_employee_pin', {
      p_salon_code: salonCode.toUpperCase(),
      p_profile_id: selectedEmployee.id,
      p_pin: enteredPin,
    });

    if (error) {
      setLoading(false);
      console.error('verify_employee_pin error:', error);
      setErrorMsg(`Fehler bei der Überprüfung: ${error.message}`);
      setPin('');
      return;
    }

    const result = data?.[0];

    if (result?.locked) {
      setLoading(false);
      setErrorMsg(
        'Zu viele Fehlversuche. Diese PIN ist gesperrt — bitte wenden Sie sich an Ihren Inhaber, ' +
        'um eine neue PIN zu erhalten.'
      );
      setPin('');
      return;
    }

    if (!result || !result.user_id) {
      setLoading(false);
      setErrorMsg('PIN nicht korrekt.');
      setPin('');
      return;
    }

    // Step 2: sign in with the internal email + PIN as password
    const email = `emp_${result.user_id}@swartschaf.internal`;
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: enteredPin,
    });

    setLoading(false);

    if (signInErr) {
      console.error('signInWithPassword error:', signInErr);
      setErrorMsg(`Anmeldung fehlgeschlagen: ${signInErr.message}`);
      setPin('');
      return;
    }

    // Route through '/' rather than straight to '/(employee)' — app/index.tsx is what
    // actually gates on must_reset_pin/has_seen_onboarding; navigating directly here
    // would skip both checks entirely.
    router.replace('/');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>swartschaf</Text>
      <Text style={styles.title}>
        {step === 'salon' && 'Saloncode eingeben'}
        {step === 'name' && 'Wer sind Sie?'}
        {step === 'pin' && `PIN eingeben — ${selectedEmployee?.full_name}`}
      </Text>
      {loading && <Text style={styles.loadingText}>Lädt...</Text>}
      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {step === 'salon' && (
        <>
          <TextInput
            style={styles.codeInput}
            value={salonCode}
            onChangeText={onSalonCodeChange}
            placeholder="Z.B. X34TEZ"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            autoFocus
          />
          {salonCode.length === 6 && !loading && (
            <TouchableOpacity style={styles.nextButton} onPress={loadEmployees}>
              <Text style={styles.nextButtonText}>Weiter</Text>
            </TouchableOpacity>
          )}
          {loading && <ActivityIndicator color={colors.primary} />}
        </>
      )}

      {step === 'name' && (
        <>
          <View style={styles.nameList}>
            {employees.map((emp) => (
              <TouchableOpacity
                key={emp.id}
                style={styles.nameRow}
                onPress={() => selectEmployee(emp)}
              >
                <Text style={styles.nameRowText}>{emp.full_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => { setStep('salon'); setErrorMsg(null); }}>
            <Text style={styles.link}>Saloncode ändern</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'pin' && (
        <>
          <View style={styles.dotsRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
            ))}
          </View>

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

          <TouchableOpacity onPress={() => { setStep('name'); setPin(''); setErrorMsg(null); }}>
            <Text style={styles.link}>Andere Person</Text>
          </TouchableOpacity>
        </>
      )}

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
  title: { fontSize: 18, color: colors.text, fontWeight: '600', textAlign: 'center' },
  loadingText: { fontSize: 14, color: colors.textMuted },
  errorBox: {
    backgroundColor: '#FDE8E8',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    maxWidth: 300,
  },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  codeInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    width: 240,
  },
  nameList: { width: 280, gap: 10 },
  nameRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  nameRowText: { fontSize: 17, color: colors.text, fontWeight: '600' },
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

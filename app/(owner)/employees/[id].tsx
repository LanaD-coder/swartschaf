import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Profile, Appointment } from '@/lib/types';
import { formatDate, formatTime, formatDurationHHMM, minutesBetween } from '@/utils/dateFormat';
import { colors, layout } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import HelpButton from '@/components/HelpButton';

export default function EmployeeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [employee, setEmployee] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sofortmeldungForm, setSofortmeldungForm] = useState(false);
  const [sofortmeldungRefInput, setSofortmeldungRefInput] = useState('');
  const [savingCompliance, setSavingCompliance] = useState(false);
  const [pinResetForm, setPinResetForm] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [resettingPin, setResettingPin] = useState(false);
  const [pinResetError, setPinResetError] = useState<string | null>(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    const [empRes, apptRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single<Profile>(),
      supabase
        .from('appointments')
        .select('*, service_category:service_categories(*)')
        .eq('assigned_to', id)
        .eq('status', 'completed')
        .order('actual_start', { ascending: false })
        .limit(100),
    ]);
    setEmployee(empRes.data);
    setAppointments((apptRes.data as Appointment[]) ?? []);
    setLoading(false);
  }

  async function confirmSofortmeldung() {
    if (!employee) return;
    setSavingCompliance(true);
    const { data } = await supabase
      .from('profiles')
      .update({
        sofortmeldung_confirmed_at: new Date().toISOString(),
        sofortmeldung_reference: sofortmeldungRefInput.trim() || null,
      })
      .eq('id', employee.id)
      .select()
      .single<Profile>();
    if (data) setEmployee(data);
    setSofortmeldungForm(false);
    setSofortmeldungRefInput('');
    setSavingCompliance(false);
  }

  async function toggleAusweisAck() {
    if (!employee) return;
    setSavingCompliance(true);
    const { data } = await supabase
      .from('profiles')
      .update({ ausweis_acknowledged_at: employee.ausweis_acknowledged_at ? null : new Date().toISOString() })
      .eq('id', employee.id)
      .select()
      .single<Profile>();
    if (data) setEmployee(data);
    setSavingCompliance(false);
  }

  // Owner-initiated reset (e.g. employee forgot their PIN) — distinct from the
  // employee's own forced self-reset (app/reset-pin.tsx): this changes someone
  // ELSE's credential, so it has to go through a service-role Edge Function, not a
  // direct client update (prevent_profile_privilege_escalation only allows a user to
  // change their own pin_hash).
  async function resetEmployeePin() {
    setPinResetError(null);
    if (newPinInput.length !== 6) {
      setPinResetError('Bitte eine 6-stellige PIN eingeben.');
      return;
    }
    if (!employee) return;
    setResettingPin(true);

    const { data: { session } } = await supabase.auth.getSession();
    let res: Response;
    try {
      res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/reset-employee-pin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ employee_id: employee.id, new_pin: newPinInput }),
        }
      );
    } catch {
      setResettingPin(false);
      setPinResetError('Edge Function nicht erreichbar. Bitte erst deployen: supabase functions deploy reset-employee-pin');
      return;
    }

    const json = await res.json();
    setResettingPin(false);

    if (!res.ok) {
      setPinResetError(json.error ?? 'PIN konnte nicht zurückgesetzt werden.');
      return;
    }

    setEmployee({ ...employee, must_reset_pin: true, pin_locked_at: null, failed_pin_attempts: 0 });
    setPinResetForm(false);
    setNewPinInput('');
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!employee) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Nicht gefunden</Text></View>;

  const totalMins = appointments.reduce((sum, a) => {
    if (!a.actual_start || !a.actual_end) return sum;
    return sum + minutesBetween(a.actual_start, a.actual_end);
  }, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{employee.full_name}</Text>
        <HelpButton pageKey="employeeDetail" />
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.statsCard}>
              <View style={[styles.avatar, { backgroundColor: employee.color }]}>
                <Text style={styles.avatarText}>{employee.full_name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.statTotal}>{formatDurationHHMM(totalMins)}</Text>
              <Text style={styles.statLabel}>Gesamtstunden ({appointments.length} Termine)</Text>
            </View>

            <View style={styles.complianceCard}>
              <Text style={styles.complianceTitle}>Schwarzarbeit-Compliance</Text>

              <View style={styles.complianceRow}>
                <View style={styles.complianceInfo}>
                  <Text style={styles.complianceLabel}>Sofortmeldung beim Zoll</Text>
                  {employee.sofortmeldung_confirmed_at ? (
                    <Text style={styles.complianceDone}>
                      Bestätigt am {formatDate(employee.sofortmeldung_confirmed_at)}
                      {employee.sofortmeldung_reference ? ` · Ref: ${employee.sofortmeldung_reference}` : ''}
                    </Text>
                  ) : (
                    <Text style={styles.compliancePending}>Ausstehend</Text>
                  )}
                </View>
                {!employee.sofortmeldung_confirmed_at && !sofortmeldungForm && (
                  <TouchableOpacity onPress={() => setSofortmeldungForm(true)}>
                    <Text style={styles.complianceAction}>Bestätigen</Text>
                  </TouchableOpacity>
                )}
              </View>

              {sofortmeldungForm && (
                <View style={styles.sofortmeldungForm}>
                  <TextInput
                    style={styles.sofortmeldungInput}
                    value={sofortmeldungRefInput}
                    onChangeText={setSofortmeldungRefInput}
                    placeholder="Referenz/Aktenzeichen (optional)"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity
                    style={[styles.confirmBtn, savingCompliance && { opacity: 0.6 }]}
                    onPress={confirmSofortmeldung}
                    disabled={savingCompliance}
                  >
                    <Text style={styles.confirmBtnText}>
                      {savingCompliance ? '...' : 'Jetzt bestätigen'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.complianceRow, { marginTop: 12 }]}>
                <View style={styles.complianceInfo}>
                  <Text style={styles.complianceLabel}>Ausweispflicht informiert</Text>
                  <Text style={employee.ausweis_acknowledged_at ? styles.complianceDone : styles.compliancePending}>
                    {employee.ausweis_acknowledged_at
                      ? `Bestätigt am ${formatDate(employee.ausweis_acknowledged_at)}`
                      : 'Ausstehend'}
                  </Text>
                </View>
                <TouchableOpacity onPress={toggleAusweisAck} disabled={savingCompliance}>
                  <Ionicons
                    name={employee.ausweis_acknowledged_at ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={employee.ausweis_acknowledged_at ? colors.success : colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.complianceCard}>
              <Text style={styles.complianceTitle}>Mitarbeiter-PIN</Text>

              <View style={styles.complianceRow}>
                <View style={styles.complianceInfo}>
                  <Text style={styles.complianceLabel}>Status</Text>
                  {employee.pin_locked_at ? (
                    <Text style={styles.compliancePending}>
                      Gesperrt nach 3 Fehlversuchen (seit {formatDate(employee.pin_locked_at)}) — PIN
                      zurücksetzen zum Entsperren
                    </Text>
                  ) : (
                    <Text style={employee.must_reset_pin ? styles.compliancePending : styles.complianceDone}>
                      {employee.must_reset_pin
                        ? 'Warten auf PIN-Vergabe durch Mitarbeiter'
                        : 'Eigene PIN aktiv'}
                    </Text>
                  )}
                </View>
                {!pinResetForm && (
                  <TouchableOpacity onPress={() => { setPinResetForm(true); setPinResetError(null); }}>
                    <Text style={styles.complianceAction}>PIN zurücksetzen</Text>
                  </TouchableOpacity>
                )}
              </View>

              {pinResetForm && (
                <>
                  <Text style={styles.pinResetHint}>
                    Setzt eine temporäre PIN. Der Mitarbeiter muss bei der nächsten Anmeldung eine eigene
                    PIN vergeben.
                  </Text>
                  {pinResetError && <Text style={styles.pinResetError}>{pinResetError}</Text>}
                  <View style={styles.sofortmeldungForm}>
                    <TextInput
                      style={styles.sofortmeldungInput}
                      value={newPinInput}
                      onChangeText={(v) => setNewPinInput(v.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Neue 6-stellige PIN"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={6}
                    />
                    <TouchableOpacity
                      style={[styles.confirmBtn, resettingPin && { opacity: 0.6 }]}
                      onPress={resetEmployeePin}
                      disabled={resettingPin}
                    >
                      <Text style={styles.confirmBtnText}>
                        {resettingPin ? '...' : 'Setzen'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => { setPinResetForm(false); setNewPinInput(''); setPinResetError(null); }}>
                    <Text style={styles.pinResetCancel}>Abbrechen</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => {
          const mins = item.actual_start && item.actual_end
            ? minutesBetween(item.actual_start, item.actual_end) : 0;
          return (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.client}>{item.client_name}</Text>
                <Text style={styles.detail}>
                  {item.actual_start ? formatDate(item.actual_start) : '–'} · {(item.service_category as any)?.name}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.time}>
                  {item.actual_start ? formatTime(item.actual_start) : '–'} – {item.actual_end ? formatTime(item.actual_end) : '–'}
                </Text>
                <Text style={styles.duration}>{formatDurationHHMM(mins)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Noch keine abgeschlossenen Termine.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  content: { padding: 16, ...layout.contentWidth },
  statsCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16, gap: 6, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  statTotal: { fontSize: 28, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 14, color: colors.textMuted },
  complianceCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  complianceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  complianceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  complianceInfo: { flex: 1 },
  complianceLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  complianceDone: { fontSize: 13, color: colors.success, marginTop: 2 },
  compliancePending: { fontSize: 13, color: colors.warning, marginTop: 2 },
  complianceAction: { fontSize: 13, fontWeight: '700', color: colors.primary },
  sofortmeldungForm: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  sofortmeldungInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pinResetHint: { fontSize: 12, color: colors.textMuted, marginTop: 10, lineHeight: 17 },
  pinResetError: { fontSize: 12, color: colors.danger, marginTop: 6 },
  pinResetCancel: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end' },
  client: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  time: { fontSize: 13, color: colors.textLight },
  duration: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});

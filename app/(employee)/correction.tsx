import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TextInput,
  TouchableOpacity, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Appointment } from '@/lib/types';
import { formatDate, formatTime } from '@/utils/dateFormat';
import { colors } from '@/utils/theme';
import HelpButton from '@/components/HelpButton';

export default function CorrectionScreen() {
  const { profile } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [reason, setReason] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('appointments')
      .select('*, service_category:service_categories(*)')
      .eq('assigned_to', profile?.id)
      .eq('status', 'completed')
      .order('actual_start', { ascending: false })
      .limit(50);
    setAppointments((data as Appointment[]) ?? []);
    setLoading(false);
  }

  function openModal(a: Appointment) {
    setSelected(a);
    setNewStart(a.actual_start ? formatTime(a.actual_start) : '');
    setNewEnd(a.actual_end ? formatTime(a.actual_end) : '');
    setReason('');
  }

  async function submit() {
    if (!selected || !reason.trim()) {
      Alert.alert('Fehler', 'Bitte einen Grund angeben.');
      return;
    }
    setSubmitting(true);
    await supabase.from('correction_requests').insert({
      appointment_id: selected.id,
      requested_by: profile?.id,
      original_data: {
        actual_start: selected.actual_start,
        actual_end: selected.actual_end,
      },
      requested_data: {
        actual_start: newStart,
        actual_end: newEnd,
      },
      reason,
      status: 'pending',
    });
    setSubmitting(false);
    setSelected(null);
    Alert.alert('Eingereicht', 'Ihre Korrekturanfrage wurde an den Inhaber weitergeleitet.');
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={appointments}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Text style={styles.heading}>Korrektur beantragen</Text>
              <HelpButton pageKey="employeeCorrection" />
            </View>
            <Text style={styles.sub}>Wählen Sie einen Termin aus, den Sie korrigieren möchten.</Text>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openModal(item)}>
            <View>
              <Text style={styles.clientName}>{item.client_name}</Text>
              <Text style={styles.detail}>
                {item.actual_start ? formatDate(item.actual_start) : '–'} · {item.service_category?.name}
              </Text>
            </View>
            <Text style={styles.times}>
              {item.actual_start ? formatTime(item.actual_start) : '–'} – {item.actual_end ? formatTime(item.actual_end) : '–'}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Keine Termine zum Korrigieren.</Text>}
      />

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>Korrektur: {selected?.client_name}</Text>

            <Text style={styles.fieldLabel}>Tatsächlicher Beginn (HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={newStart}
              onChangeText={setNewStart}
              placeholder="09:00"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Tatsächliches Ende (HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={newEnd}
              onChangeText={setNewEnd}
              placeholder="10:30"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Begründung *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={reason}
              onChangeText={setReason}
              placeholder="z.B. Gerät hat sich nicht abgemeldet..."
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={submit}
              disabled={submitting}
            >
              <Text style={styles.submitText}>{submitting ? 'Einreichen...' : 'Anfrage einreichen'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 6 },
  sub: { fontSize: 14, color: colors.textMuted, marginBottom: 16 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  clientName: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  times: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  fieldLabel: { fontSize: 13, color: colors.textMuted },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelText: { color: colors.textMuted, textAlign: 'center', padding: 12 },
});

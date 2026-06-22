import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/lib/types';
import { formatDate, formatTime, formatDurationHHMM, minutesBetween } from '@/utils/dateFormat';
import { colors } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Geplant',
  in_progress: 'Läuft',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  no_show: 'Nicht erschienen',
};

export default function AppointmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [id]);

  async function load() {
    const { data } = await supabase
      .from('appointments')
      .select('*, service_category:service_categories(*), assigned_profile:profiles!assigned_to(*)')
      .eq('id', id)
      .single<Appointment>();
    setAppointment(data);
    setLoading(false);
  }

  async function updateStatus(status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id);
    load();
  }

  async function deleteAppointment() {
    Alert.alert('Termin löschen?', 'Dieser Termin wird storniert. Zeitdaten bleiben erhalten (GoBD).', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Stornieren',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
          router.back();
        },
      },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!appointment) return <View style={styles.center}><Text style={styles.errorText}>Termin nicht gefunden.</Text></View>;

  const mins = appointment.actual_start && appointment.actual_end
    ? minutesBetween(appointment.actual_start, appointment.actual_end)
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Termindetails</Text>
        <TouchableOpacity onPress={deleteAppointment}>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.clientName}>{appointment.client_name}</Text>
          <Text style={styles.category}>{(appointment.service_category as any)?.name}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusChip}>
              <Text style={styles.statusText}>{STATUS_LABELS[appointment.status]}</Text>
            </View>
            {appointment.customer_type === 'walkin' && (
              <View style={styles.walkinChip}>
                <Text style={styles.walkinText}>Laufkunde</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Mitarbeiter</Text>
          <Text style={styles.value}>{(appointment.assigned_profile as any)?.full_name ?? '–'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Geplante Zeit</Text>
          <Text style={styles.value}>
            {formatDate(appointment.scheduled_start)} · {formatTime(appointment.scheduled_start)} – {formatTime(appointment.scheduled_end)}
          </Text>
        </View>

        {(appointment.actual_start || appointment.actual_end) && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Tatsächliche Zeit</Text>
            <Text style={styles.value}>
              {appointment.actual_start ? formatTime(appointment.actual_start) : '–'} – {appointment.actual_end ? formatTime(appointment.actual_end) : 'läuft noch'}
            </Text>
            {mins !== null && (
              <Text style={styles.duration}>{formatDurationHHMM(mins)}</Text>
            )}
          </View>
        )}

        {appointment.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Notizen</Text>
            <Text style={styles.value}>{appointment.notes}</Text>
          </View>
        )}

        {appointment.status === 'scheduled' && (
          <TouchableOpacity style={styles.noShowBtn} onPress={() => updateStatus('no_show')}>
            <Text style={styles.noShowText}>Als "Nicht erschienen" markieren</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { color: colors.textMuted, fontSize: 15 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  content: { padding: 16, gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clientName: { fontSize: 22, fontWeight: '700', color: colors.text },
  category: { fontSize: 15, color: colors.textMuted },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statusChip: { backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: colors.textLight, fontSize: 13, fontWeight: '600' },
  walkinChip: { backgroundColor: colors.walkin, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  walkinText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 16, color: colors.text },
  duration: { fontSize: 18, fontWeight: '700', color: colors.primary },
  noShowBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: 8,
  },
  noShowText: { color: colors.warning, fontWeight: '600', fontSize: 15 },
});

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Profile, Appointment } from '@/lib/types';
import { formatDate, formatTime, formatDurationHHMM, minutesBetween } from '@/utils/dateFormat';
import { colors } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';

export default function EmployeeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [employee, setEmployee] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

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
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.statsCard}>
            <View style={[styles.avatar, { backgroundColor: employee.color }]}>
              <Text style={styles.avatarText}>{employee.full_name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.statTotal}>{formatDurationHHMM(totalMins)}</Text>
            <Text style={styles.statLabel}>Gesamtstunden ({appointments.length} Termine)</Text>
          </View>
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
  content: { padding: 16 },
  statsCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16, gap: 6, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  statTotal: { fontSize: 28, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end' },
  client: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  time: { fontSize: 13, color: colors.textLight },
  duration: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Appointment, Profile } from '@/lib/types';
import { formatDayName, formatTime } from '@/utils/dateFormat';
import { colors } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, subDays, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  scheduled: colors.textMuted,
  in_progress: colors.success,
  completed: colors.primary,
  cancelled: colors.danger,
  no_show: colors.warning,
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Geplant',
  in_progress: 'Läuft',
  completed: 'Fertig',
  cancelled: 'Storniert',
  no_show: 'Nicht erschienen',
};

export default function OwnerCalendar() {
  const { profile, salon } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);

  useEffect(() => { loadEmployees(); }, []);
  useEffect(() => { loadAppointments(); }, [selectedDate]);

  async function loadEmployees() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('salon_id', profile?.salon_id)
      .eq('is_active', true);
    setEmployees((data as Profile[]) ?? []);
  }

  async function loadAppointments() {
    const start = startOfDay(selectedDate).toISOString();
    const end = startOfDay(addDays(selectedDate, 1)).toISOString();
    const { data } = await supabase
      .from('appointments')
      .select('*, service_category:service_categories(*), assigned_profile:profiles!assigned_to(*)')
      .eq('salon_id', profile?.salon_id)
      .gte('scheduled_start', start)
      .lt('scheduled_start', end)
      .order('scheduled_start', { ascending: true });
    setAppointments((data as Appointment[]) ?? []);
  }

  function goDay(offset: number) {
    setSelectedDate((d) => addDays(d, offset));
  }

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const activeCount = appointments.filter((a) => a.status === 'in_progress').length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Date nav */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => goDay(-1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.dateMid}>
          <Text style={styles.dateText}>
            {format(selectedDate, 'EEEE, dd. MMM', { locale: de })}
          </Text>
          {isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayText}>Heute</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => goDay(1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{appointments.length}</Text>
          <Text style={styles.statLabel}>Termine</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.success }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Aktiv</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{employees.length}</Text>
          <Text style={styles.statLabel}>Mitarbeiter</Text>
        </View>
      </View>

      {/* Appointment list */}
      <FlatList
        data={appointments}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.apptCard}
            onPress={() => router.push(`/(owner)/appointments/${item.id}`)}
          >
            <View style={[styles.statusBar, { backgroundColor: STATUS_COLORS[item.status] ?? colors.border }]} />
            <View style={styles.apptMain}>
              <View style={styles.apptRow}>
                <Text style={styles.apptClient}>{item.client_name}</Text>
                <Text style={styles.apptTime}>{formatTime(item.scheduled_start)}</Text>
              </View>
              <View style={styles.apptRow}>
                <Text style={styles.apptSub}>
                  {(item.assigned_profile as any)?.full_name ?? '–'} · {item.service_category?.name}
                </Text>
                <View style={[styles.statusChip, { borderColor: STATUS_COLORS[item.status] }]}>
                  <Text style={[styles.statusChipText, { color: STATUS_COLORS[item.status] }]}>
                    {STATUS_LABELS[item.status]}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyText}>Keine Termine an diesem Tag</Text>
          </View>
        }
      />

      {/* New appointment FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(owner)/appointments/new')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBtn: { padding: 8 },
  dateMid: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dateText: { fontSize: 17, fontWeight: '700', color: colors.text },
  todayBadge: { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  todayText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  statsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted },
  list: { padding: 12 },
  apptCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBar: { width: 4 },
  apptMain: { flex: 1, padding: 14, gap: 6 },
  apptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  apptClient: { fontSize: 16, fontWeight: '600', color: colors.text },
  apptTime: { fontSize: 14, color: colors.textMuted },
  apptSub: { fontSize: 13, color: colors.textMuted, flex: 1 },
  statusChip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 12, marginTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    backgroundColor: colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

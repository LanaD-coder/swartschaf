import { useEffect, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Appointment } from '@/lib/types';
import { formatDate, formatTime, formatDurationHHMM, minutesBetween } from '@/utils/dateFormat';
import { colors } from '@/utils/theme';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import HelpButton from '@/components/HelpButton';

interface Section { title: string; data: Appointment[] }

export default function EmployeeHistory() {
  const { profile } = useAuthStore();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from('appointments')
      .select('*, service_category:service_categories(*)')
      .eq('assigned_to', profile?.id)
      .eq('status', 'completed')
      .order('actual_start', { ascending: false })
      .limit(200);

    const entries = (data as Appointment[]) ?? [];
    const byDay = new Map<string, Appointment[]>();
    for (const e of entries) {
      const key = format(new Date(e.actual_start!), 'yyyy-MM-dd');
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(e);
    }

    setSections(
      [...byDay.entries()].map(([key, items]) => ({
        title: format(new Date(key), 'EEEE, dd. MMMM yyyy', { locale: de }),
        data: items,
      }))
    );
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Mein Verlauf</Text>
            <HelpButton pageKey="employeeHistory" />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const mins = item.actual_start && item.actual_end
            ? minutesBetween(item.actual_start, item.actual_end)
            : 0;
          return (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.clientName}>{item.client_name}</Text>
                <Text style={styles.category}>{item.service_category?.name}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.times}>
                  {item.actual_start ? formatTime(item.actual_start) : '–'} – {item.actual_end ? formatTime(item.actual_end) : '–'}
                </Text>
                <Text style={styles.duration}>{formatDurationHHMM(mins)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Noch keine abgeschlossenen Termine</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingVertical: 8,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end' },
  clientName: { fontSize: 15, fontWeight: '600', color: colors.text },
  category: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  times: { fontSize: 13, color: colors.textLight },
  duration: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});

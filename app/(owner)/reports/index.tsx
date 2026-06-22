import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Appointment, Profile } from '@/lib/types';
import { generateAndShareReport } from '@/utils/pdf';
import { colors } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  format, subDays, subWeeks, subMonths,
} from 'date-fns';
import { de } from 'date-fns/locale';

type Period = 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Heute' },
  { key: 'this_week', label: 'Diese Woche' },
  { key: 'last_week', label: 'Letzte Woche' },
  { key: 'this_month', label: 'Dieser Monat' },
  { key: 'last_month', label: 'Letzter Monat' },
];

function getRange(period: Period): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now), label: format(now, 'dd. MMMM yyyy', { locale: de }) };
    case 'this_week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), label: `KW ${format(now, 'w', { locale: de })} – ${format(now, 'MMMM yyyy', { locale: de })}` };
    case 'last_week': {
      const lw = subWeeks(now, 1);
      return { start: startOfWeek(lw, { weekStartsOn: 1 }), end: endOfWeek(lw, { weekStartsOn: 1 }), label: `KW ${format(lw, 'w', { locale: de })} – ${format(lw, 'MMMM yyyy', { locale: de })}` };
    }
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: de }) };
    case 'last_month': {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm), label: format(lm, 'MMMM yyyy', { locale: de }) };
    }
  }
}

export default function ReportsScreen() {
  const { profile, salon } = useAuthStore();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('this_month');
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => { loadEmployees(); }, []);

  async function loadEmployees() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('salon_id', profile?.salon_id)
      .eq('is_active', true);
    setEmployees((data as Profile[]) ?? []);
  }

  async function generate(employee: Profile) {
    if (!salon) return;
    setGenerating(employee.id);
    try {
      const { start, end, label } = getRange(selectedPeriod);
      const { data } = await supabase
        .from('appointments')
        .select('*, service_category:service_categories(*)')
        .eq('assigned_to', employee.id)
        .gte('actual_start', start.toISOString())
        .lte('actual_start', end.toISOString())
        .order('actual_start', { ascending: true });

      await generateAndShareReport(
        (data as Appointment[]) ?? [],
        employee,
        salon,
        label
      );
    } catch (e: any) {
      Alert.alert('Fehler', e.message ?? 'PDF konnte nicht erstellt werden.');
    } finally {
      setGenerating(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Berichte</Text>

        <Text style={styles.sectionLabel}>Zeitraum</Text>
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodChip, selectedPeriod === p.key && styles.periodChipActive]}
              onPress={() => setSelectedPeriod(p.key)}
            >
              <Text style={[styles.periodText, selectedPeriod === p.key && styles.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Mitarbeiter</Text>
        {employees.map((emp) => (
          <TouchableOpacity
            key={emp.id}
            style={styles.empRow}
            onPress={() => generate(emp)}
            disabled={!!generating}
          >
            <View style={[styles.empDot, { backgroundColor: emp.color }]} />
            <Text style={styles.empName}>{emp.full_name}</Text>
            {generating === emp.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}

        <Text style={styles.hint}>
          Der Bericht wird als PDF im Arbeitszeitnachweis-Format (Finanzamt-konform) erstellt und zum Teilen/Speichern freigegeben.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  periodChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodChipActive: { borderColor: colors.primary, backgroundColor: '#2a0a18' },
  periodText: { color: colors.textLight, fontSize: 14 },
  periodTextActive: { color: colors.primary, fontWeight: '700' },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  empDot: { width: 14, height: 14, borderRadius: 7 },
  empName: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 24,
    lineHeight: 20,
    textAlign: 'center',
  },
});

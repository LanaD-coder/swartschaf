import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, SectionList,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { GeneratedReport } from '@/lib/types';
import { listVaultReports, shareVaultReport } from '@/utils/reportsVault';
import HelpButton from '@/components/HelpButton';
import { colors, layout } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Section { title: string; data: GeneratedReport[] }

export default function ReportsVaultScreen() {
  const { salon } = useAuthStore();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!salon) return;
    const reports = await listVaultReports(salon.id);
    const byMonth = new Map<string, GeneratedReport[]>();
    for (const r of reports) {
      const key = format(new Date(r.created_at), 'MMMM yyyy', { locale: de });
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(r);
    }
    setSections([...byMonth.entries()].map(([title, data]) => ({ title, data })));
    setLoading(false);
  }, [salon]);

  useEffect(() => { load(); }, [load]);

  async function share(report: GeneratedReport) {
    setSharing(report.id);
    try {
      await shareVaultReport(report);
    } catch (e: any) {
      Alert.alert('Fehler', e.message ?? 'Bericht konnte nicht geöffnet werden.');
    } finally {
      setSharing(null);
    }
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
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Berichtsarchiv</Text>
        <HelpButton pageKey="reportsVault" />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.empDot, { backgroundColor: item.employee?.color ?? colors.primary }]} />
            <View style={styles.rowLeft}>
              <Text style={styles.empName}>{item.employee?.full_name ?? 'Unbekannt'}</Text>
              <Text style={styles.periodLabel}>{item.period_label}</Text>
            </View>
            <Text style={styles.date}>{format(new Date(item.created_at), 'dd.MM.yyyy')}</Text>
            {sharing === item.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity onPress={() => share(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="share-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="archive-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Noch keine Berichte archiviert</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  content: { padding: 16, ...layout.contentWidth },
  sectionHeader: { backgroundColor: colors.background, paddingVertical: 8, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  empDot: { width: 12, height: 12, borderRadius: 6 },
  rowLeft: { flex: 1 },
  empName: { fontSize: 15, fontWeight: '600', color: colors.text },
  periodLabel: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  date: { fontSize: 13, color: colors.textLight },
  empty: { alignItems: 'center', gap: 12, marginTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});

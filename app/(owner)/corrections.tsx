import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { CorrectionRequest } from '@/lib/types';
import { formatDate, formatTime } from '@/utils/dateFormat';
import { colors } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import HelpButton from '@/components/HelpButton';

export default function CorrectionsScreen() {
  const { profile } = useAuthStore();
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('correction_requests')
      .select(`
        *,
        appointment:appointments(*, service_category:service_categories(*)),
        requester:profiles!requested_by(full_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setRequests((data as CorrectionRequest[]) ?? []);
    setLoading(false);
  }

  async function resolve(id: string, approve: boolean) {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    setResolving(id);
    setConfirming(null);

    if (approve) {
      const rd = req.requested_data as any;
      await supabase
        .from('appointments')
        .update({
          actual_start: rd.actual_start ?? req.appointment?.actual_start,
          actual_end: rd.actual_end ?? req.appointment?.actual_end,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.appointment_id);
    }

    await supabase
      .from('correction_requests')
      .update({
        status: approve ? 'approved' : 'rejected',
        approved_by: profile?.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id);

    setResolving(null);
    load();
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.heading}>
              Korrekturanfragen {requests.length > 0 ? `(${requests.length})` : ''}
            </Text>
            <HelpButton pageKey="corrections" />
          </View>
        }
        renderItem={({ item }) => {
          const od = item.original_data as any;
          const rd = item.requested_data as any;
          const isConfirming = confirming?.id === item.id;
          const isResolving = resolving === item.id;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.employeeName}>{(item.requester as any)?.full_name}</Text>
                <Text style={styles.apptDate}>
                  {item.appointment?.actual_start
                    ? formatDate(item.appointment.actual_start)
                    : '–'}
                </Text>
              </View>
              <Text style={styles.apptClient}>
                {item.appointment?.client_name} · {item.appointment?.service_category?.name}
              </Text>

              <View style={styles.changeRow}>
                <View style={styles.changeBox}>
                  <Text style={styles.changeLabel}>Vorher</Text>
                  <Text style={styles.changeTime}>
                    {od?.actual_start ? formatTime(od.actual_start) : '–'} – {od?.actual_end ? formatTime(od.actual_end) : '–'}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                <View style={styles.changeBox}>
                  <Text style={styles.changeLabel}>Nachher</Text>
                  <Text style={[styles.changeTime, { color: colors.primary }]}>
                    {rd?.actual_start ?? '–'} – {rd?.actual_end ?? '–'}
                  </Text>
                </View>
              </View>

              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Begründung:</Text>
                <Text style={styles.reasonText}>{item.reason}</Text>
              </View>

              {/* Inline confirmation prompt */}
              {isConfirming && (
                <View style={[styles.confirmBox, confirming.action === 'approve' ? styles.confirmBoxApprove : styles.confirmBoxReject]}>
                  <Text style={styles.confirmText}>
                    {confirming.action === 'approve'
                      ? 'Korrektur genehmigen und Zeitdaten aktualisieren?'
                      : 'Korrekturanfrage ablehnen?'}
                  </Text>
                  <View style={styles.confirmBtns}>
                    <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirming(null)}>
                      <Text style={styles.confirmCancelText}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={confirming.action === 'approve' ? styles.confirmApprove : styles.confirmReject}
                      onPress={() => resolve(item.id, confirming.action === 'approve')}
                    >
                      <Text style={styles.confirmActionText}>
                        {confirming.action === 'approve' ? 'Ja, genehmigen' : 'Ja, ablehnen'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!isConfirming && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    disabled={isResolving}
                    onPress={() => setConfirming({ id: item.id, action: 'reject' })}
                  >
                    <Text style={styles.rejectText}>Ablehnen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approveBtn, isResolving && { opacity: 0.5 }]}
                    disabled={isResolving}
                    onPress={() => setConfirming({ id: item.id, action: 'approve' })}
                  >
                    {isResolving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.approveText}>Genehmigen</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
            <Text style={styles.emptyText}>Keine offenen Anfragen</Text>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  employeeName: { fontSize: 16, fontWeight: '700', color: colors.text },
  apptDate: { fontSize: 13, color: colors.textMuted },
  apptClient: { fontSize: 14, color: colors.textMuted },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 12,
  },
  changeBox: { flex: 1 },
  changeLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  changeTime: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
  reasonBox: { backgroundColor: colors.inputBg, borderRadius: 8, padding: 10 },
  reasonLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  reasonText: { fontSize: 14, color: colors.textLight },

  confirmBox: {
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderWidth: 1,
  },
  confirmBoxApprove: { backgroundColor: colors.success + '18', borderColor: colors.success + '55' },
  confirmBoxReject: { backgroundColor: colors.danger + '18', borderColor: colors.danger + '55' },
  confirmText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  confirmBtns: { flexDirection: 'row', gap: 8 },
  confirmCancel: {
    flex: 1, borderRadius: 8, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  confirmCancelText: { color: colors.textMuted, fontWeight: '600' },
  confirmApprove: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: colors.success },
  confirmReject: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: colors.danger },
  confirmActionText: { color: '#fff', fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1, borderRadius: 10, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.danger,
  },
  rejectText: { color: colors.danger, fontWeight: '600' },
  approveBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', backgroundColor: colors.success },
  approveText: { color: '#fff', fontWeight: '700' },
  empty: { alignItems: 'center', gap: 12, marginTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});

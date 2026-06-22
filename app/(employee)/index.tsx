import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, FlatList, SafeAreaView, RefreshControl, Alert,
} from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useActiveAppointments } from '@/hooks/useActiveAppointments';
import AppointmentCard from '@/components/AppointmentCard';
import ComplianceAlerts from '@/components/ComplianceAlert';
import { checkDailyCompliance } from '@/utils/compliance';
import { formatDayName } from '@/utils/dateFormat';
import { colors } from '@/utils/theme';
import { supabase } from '@/lib/supabase';
import { ServiceCategory } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';

export default function EmployeeHome() {
  const { profile, salon } = useAuthStore();
  const { active, upcoming, completed, loading, startTimer, stopTimer, startWalkIn, reload } =
    useActiveAppointments();

  const [walkinModal, setWalkinModal] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  const complianceAlerts = checkDailyCompliance(completed, active.length);

  async function openWalkInModal() {
    const { data } = await supabase
      .from('service_categories')
      .select('*')
      .eq('salon_id', profile?.salon_id)
      .eq('is_active', true);
    setCategories((data as ServiceCategory[]) ?? []);
    setWalkinModal(true);
  }

  async function handleWalkIn(category: ServiceCategory) {
    setWalkinModal(false);
    await startWalkIn(category.id, category.name);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Guten Morgen';
    if (h < 18) return 'Guten Tag';
    return 'Guten Abend';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {profile?.full_name?.split(' ')[0]}</Text>
            <Text style={styles.date}>{formatDayName(new Date())}</Text>
          </View>
          <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Compliance alerts */}
        <ComplianceAlerts alerts={complianceAlerts} />

        {/* Active appointments */}
        {active.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aktiv</Text>
            {active.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                onStart={() => startTimer(a.id)}
                onStop={() => stopTimer(a.id)}
              />
            ))}
          </View>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Heute</Text>
            {upcoming.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                onStart={() => startTimer(a.id)}
                onStop={() => stopTimer(a.id)}
              />
            ))}
          </View>
        )}

        {/* Completed today */}
        {completed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Abgeschlossen</Text>
            {completed.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                onStart={() => {}}
                onStop={() => {}}
              />
            ))}
          </View>
        )}

        {active.length === 0 && upcoming.length === 0 && !loading && (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Keine Termine für heute</Text>
          </View>
        )}

        {/* Bottom spacing for FAB */}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Walk-in FAB */}
      <TouchableOpacity style={styles.fab} onPress={openWalkInModal}>
        <Ionicons name="person-add-outline" size={22} color="#fff" />
        <Text style={styles.fabText}>Laufkunde</Text>
      </TouchableOpacity>

      {/* Walk-in category modal */}
      <Modal visible={walkinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Welche Leistung?</Text>
            <FlatList
              data={categories}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryRow}
                  onPress={() => handleWalkIn(item)}
                >
                  <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                  <Text style={styles.categoryName}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setWalkinModal(false)}>
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
  scroll: { flex: 1 },
  content: { padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: colors.text },
  date: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  logoutBtn: { padding: 6 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  empty: {
    alignItems: 'center',
    gap: 12,
    marginTop: 60,
  },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '70%',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryDot: { width: 14, height: 14, borderRadius: 7 },
  categoryName: { fontSize: 17, color: colors.text },
  cancelBtn: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: { color: colors.textMuted, fontSize: 15 },
});

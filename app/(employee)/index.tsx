import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useActiveAppointments } from "@/hooks/useActiveAppointments";
import AppointmentCard from "@/components/AppointmentCard";
import ComplianceAlerts from "@/components/ComplianceAlert";
import AvatarPicker from "@/components/AvatarPicker";
import HelpButton from "@/components/HelpButton";
import { checkDailyCompliance } from "@/utils/compliance";
import { formatDayName, formatElapsed } from "@/utils/dateFormat";
import { colors } from "@/utils/theme";
import { supabase } from "@/lib/supabase";
import { ServiceCategory, Break, BreakType, Appointment, Service } from "@/lib/types";
import { formatTime } from "@/utils/dateFormat";
import { Ionicons } from "@expo/vector-icons";

const BREAK_OPTIONS: { type: BreakType; label: string; icon: string; color: string }[] = [
  { type: "lunch",   label: "Mittagspause",  icon: "restaurant-outline", color: "#F39C12" },
  { type: "coffee",  label: "Kaffeepause",   icon: "cafe-outline",        color: colors.textMuted },
  { type: "sick",    label: "Krank",          icon: "medical-outline",     color: colors.danger },
  { type: "day_off", label: "Frei / Urlaub", icon: "sunny-outline",       color: colors.success },
];

function breakLabel(type: BreakType) {
  return BREAK_OPTIONS.find((b) => b.type === type)?.label ?? type;
}
function breakColor(type: BreakType) {
  return BREAK_OPTIONS.find((b) => b.type === type)?.color ?? colors.primary;
}

export default function EmployeeHome() {
  const { profile } = useAuthStore();
  const { active, upcoming, completed, loading, startTimer, stopTimer, startWalkIn, reload } =
    useActiveAppointments();

  const [walkinModal, setWalkinModal] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [activeBreak, setActiveBreak] = useState<Break | null>(null);
  const [breakElapsed, setBreakElapsed] = useState("");

  // Stop-timer -> "which services did you actually do" confirmation. Optional:
  // stopping with nothing selected still works, so this never blocks a salon
  // that hasn't set up `services` yet.
  const [completeAppt, setCompleteAppt] = useState<Appointment | null>(null);
  const [completeServices, setCompleteServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [completing, setCompleting] = useState(false);

  const [correctionAppt, setCorrectionAppt] = useState<Appointment | null>(null);
  const [correctionStart, setCorrectionStart] = useState("");
  const [correctionEnd, setCorrectionEnd] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionDone, setCorrectionDone] = useState(false);

  const complianceAlerts = checkDailyCompliance(completed, active.length);

  // Load active break on mount
  useEffect(() => {
    loadBreak();
  }, []);

  // Live break timer
  useEffect(() => {
    if (!activeBreak) return;
    const tick = () => setBreakElapsed(formatElapsed(activeBreak.started_at));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeBreak]);

  async function loadBreak() {
    if (!profile) return;
    const { data } = await supabase
      .from("breaks")
      .select("*")
      .eq("profile_id", profile.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveBreak((data as Break) ?? null);
  }

  async function startBreak(type: BreakType) {
    if (!profile) return;
    const { data } = await supabase
      .from("breaks")
      .insert({
        profile_id: profile.id,
        salon_id: profile.salon_id,
        break_type: type,
      })
      .select()
      .single();
    setActiveBreak((data as Break) ?? null);
  }

  async function stopBreak() {
    if (!activeBreak) return;
    await supabase
      .from("breaks")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", activeBreak.id);
    setActiveBreak(null);
    setBreakElapsed("");
  }

  function openCorrectionModal(a: Appointment) {
    setCorrectionAppt(a);
    setCorrectionStart(a.actual_start ? formatTime(a.actual_start) : "");
    setCorrectionEnd(a.actual_end ? formatTime(a.actual_end) : "");
    setCorrectionReason("");
    setCorrectionDone(false);
  }

  async function submitCorrection() {
    if (!correctionAppt || !correctionReason.trim()) return;
    setCorrectionSubmitting(true);
    await supabase.from("correction_requests").insert({
      appointment_id: correctionAppt.id,
      requested_by: profile?.id,
      original_data: {
        actual_start: correctionAppt.actual_start,
        actual_end: correctionAppt.actual_end,
      },
      requested_data: {
        actual_start: correctionStart,
        actual_end: correctionEnd,
      },
      reason: correctionReason.trim(),
      status: "pending",
    });
    setCorrectionSubmitting(false);
    setCorrectionDone(true);
  }

  async function openWalkInModal() {
    const { data } = await supabase
      .from("service_categories")
      .select("*")
      .eq("salon_id", profile?.salon_id)
      .eq("is_active", true);
    setCategories((data as ServiceCategory[]) ?? []);
    setWalkinModal(true);
  }

  async function handleWalkIn(category: ServiceCategory) {
    setWalkinModal(false);
    await startWalkIn(category.id, category.name);
  }

  async function openCompleteModal(a: Appointment) {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("salon_id", profile?.salon_id)
      .eq("is_active", true)
      .order("name");
    setCompleteServices((data as Service[]) ?? []);
    setSelectedServiceIds([]);
    setCompleteAppt(a);
  }

  function toggleCompleteService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function confirmComplete() {
    if (!completeAppt) return;
    setCompleting(true);
    await stopTimer(completeAppt.id, selectedServiceIds);
    setCompleting(false);
    setCompleteAppt(null);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Guten Morgen";
    if (h < 18) return "Guten Tag";
    return "Guten Abend";
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => { reload(); loadBreak(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <AvatarPicker size={48} />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              {greeting()}, {profile?.full_name?.split(" ")[0]}
            </Text>
            <Text style={styles.date}>{formatDayName(new Date())}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/onboarding?replay=1' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="school-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <HelpButton pageKey="employeeHome" />
            <TouchableOpacity
              onPress={() => supabase.auth.signOut()}
              style={styles.logoutBtn}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Compliance alerts */}
        <ComplianceAlerts alerts={complianceAlerts} />

        {/* Pause card */}
        <View
          style={[
            styles.pauseCard,
            activeBreak && {
              borderColor: breakColor(activeBreak.break_type) + "66",
              backgroundColor: breakColor(activeBreak.break_type) + "11",
            },
          ]}
        >
          <View style={styles.pauseCardHeader}>
            <Ionicons
              name="pause-circle-outline"
              size={18}
              color={activeBreak ? breakColor(activeBreak.break_type) : colors.textMuted}
            />
            <Text
              style={[
                styles.pauseCardTitle,
                activeBreak && { color: breakColor(activeBreak.break_type) },
              ]}
            >
              {activeBreak ? breakLabel(activeBreak.break_type) : "Pause"}
            </Text>
            {activeBreak && (
              <Text
                style={[
                  styles.pauseTimer,
                  { color: breakColor(activeBreak.break_type) },
                ]}
              >
                {breakElapsed}
              </Text>
            )}
          </View>

          {!activeBreak ? (
            <View style={styles.breakChips}>
              {BREAK_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={[styles.breakChip, { borderColor: opt.color + "55" }]}
                  onPress={() => startBreak(opt.type)}
                >
                  <Ionicons name={opt.icon as any} size={15} color={opt.color} />
                  <Text style={[styles.breakChipText, { color: opt.color }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={styles.pauseStopBtn} onPress={stopBreak}>
              <Text style={styles.pauseStopBtnText}>Pause beenden</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Active appointments */}
        {active.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aktiv</Text>
            {active.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                onStart={() => startTimer(a.id)}
                onStop={() => openCompleteModal(a)}
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
                onStop={() => openCompleteModal(a)}
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
                onCorrection={() => openCorrectionModal(a)}
              />
            ))}
          </View>
        )}

        {active.length === 0 && upcoming.length === 0 && !loading && (
          <View style={styles.empty}>
            <Ionicons
              name="calendar-outline"
              size={48}
              color={colors.textMuted}
            />
            <Text style={styles.emptyText}>Keine Termine für heute</Text>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Laufkunde bottom button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.laufkundeBtn} onPress={openWalkInModal}>
          <Ionicons name="person-add-outline" size={22} color="#fff" />
          <Text style={styles.laufkundeBtnText}>Laufkunde</Text>
        </TouchableOpacity>
      </View>

      {/* Correction request modal */}
      <Modal visible={!!correctionAppt} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {correctionDone ? (
              <>
                <Ionicons name="checkmark-circle" size={48} color={colors.success} style={{ alignSelf: "center" }} />
                <Text style={[styles.modalTitle, { textAlign: "center" }]}>Anfrage eingereicht</Text>
                <Text style={[styles.cancelText, { textAlign: "center" }]}>
                  Der Inhaber wird Ihre Korrektur prüfen.
                </Text>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCorrectionAppt(null)}>
                  <Text style={styles.cancelText}>Schließen</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>
                  Zeitkorrektur: {correctionAppt?.client_name}
                </Text>
                <Text style={[styles.cancelText, { marginBottom: 4 }]}>
                  Tatsächlicher Beginn (HH:MM)
                </Text>
                <TextInput
                  style={styles.correctionInput}
                  value={correctionStart}
                  onChangeText={setCorrectionStart}
                  placeholder="09:00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={[styles.cancelText, { marginBottom: 4 }]}>
                  Tatsächliches Ende (HH:MM)
                </Text>
                <TextInput
                  style={styles.correctionInput}
                  value={correctionEnd}
                  onChangeText={setCorrectionEnd}
                  placeholder="10:30"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={[styles.cancelText, { marginBottom: 4 }]}>
                  Begründung *
                </Text>
                <TextInput
                  style={[styles.correctionInput, { height: 72, textAlignVertical: "top" }]}
                  value={correctionReason}
                  onChangeText={setCorrectionReason}
                  placeholder="z.B. Timer vergessen zu stoppen…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.laufkundeBtn, { marginTop: 8, opacity: correctionSubmitting || !correctionReason.trim() ? 0.5 : 1 }]}
                  onPress={submitCorrection}
                  disabled={correctionSubmitting || !correctionReason.trim()}
                >
                  <Text style={styles.laufkundeBtnText}>
                    {correctionSubmitting ? "Einreichen…" : "Anfrage einreichen"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCorrectionAppt(null)}>
                  <Text style={styles.cancelText}>Abbrechen</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

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
                  <View
                    style={[styles.categoryDot, { backgroundColor: item.color }]}
                  />
                  <Text style={styles.categoryName}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setWalkinModal(false)}
            >
              <Text style={styles.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!completeAppt} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Welche Leistungen wurden erbracht?</Text>
            {completeServices.length === 0 ? (
              <Text style={styles.modalHint}>
                Noch keine Leistungen mit Preisen hinterlegt (Einstellungen → Leistungen). Sie können
                trotzdem ohne Auswahl abschließen.
              </Text>
            ) : (
              <FlatList
                data={completeServices}
                keyExtractor={(s) => s.id}
                renderItem={({ item }) => {
                  const selected = selectedServiceIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={styles.categoryRow}
                      onPress={() => toggleCompleteService(item.id)}
                    >
                      <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={20}
                        color={selected ? colors.primary : colors.textMuted}
                      />
                      <Text style={styles.categoryName}>
                        {item.name} · €{item.price.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity
              style={[styles.confirmBtn, completing && { opacity: 0.6 }]}
              onPress={confirmComplete}
              disabled={completing}
            >
              <Text style={styles.confirmBtnText}>
                {completing ? "Abschließen..." : "Fertig"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCompleteAppt(null)}>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  headerText: { flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  greeting: { fontSize: 18, fontWeight: "700", color: colors.text },
  date: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  logoutBtn: { padding: 6 },

  breakBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  pauseCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  pauseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pauseCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    flex: 1,
  },
  pauseTimer: {
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  breakChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  breakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  breakChipText: { fontSize: 13, fontWeight: "600" },
  pauseStopBtn: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  pauseStopBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },

  empty: { alignItems: "center", gap: 12, marginTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: 16 },

  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  laufkundeBtn: {
    backgroundColor: colors.success,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  laufkundeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "70%",
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },

  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryDot: { width: 14, height: 14, borderRadius: 7 },
  categoryName: { fontSize: 17, color: colors.text },

  cancelBtn: { padding: 14, alignItems: "center", marginTop: 8 },
  cancelText: { color: colors.textMuted, fontSize: 15 },
  modalHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, paddingVertical: 8 },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 10,
  },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  correctionInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

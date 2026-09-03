import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { Appointment, Service } from "@/lib/types";
import {
  formatDate,
  formatTime,
  formatDurationHHMM,
  formatElapsed,
  minutesBetween,
} from "@/utils/dateFormat";
import { colors } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import HelpButton from "@/components/HelpButton";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Geplant",
  in_progress: "Läuft",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
  no_show: "Nicht erschienen",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: colors.textMuted,
  in_progress: colors.success,
  completed: colors.primary,
  cancelled: colors.danger,
  no_show: colors.warning,
};

export default function AppointmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [completeModal, setCompleteModal] = useState(false);
  const [completeServices, setCompleteServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [completing, setCompleting] = useState(false);

  const [correctionModal, setCorrectionModal] = useState(false);
  const [correctionStart, setCorrectionStart] = useState("");
  const [correctionEnd, setCorrectionEnd] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionDone, setCorrectionDone] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  // Live timer for in_progress appointments
  useEffect(() => {
    if (appointment?.status !== "in_progress" || !appointment.actual_start)
      return;
    const tick = () => setElapsed(formatElapsed(appointment.actual_start!));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [appointment?.status, appointment?.actual_start]);

  async function load() {
    const { data } = await supabase
      .from("appointments")
      .select(
        "*, service_category:service_categories(*), assigned_profile:profiles!assigned_to(*)"
      )
      .eq("id", id)
      .single<Appointment>();
    setAppointment(data);
    setLoading(false);
  }

  async function startTimer() {
    const now = new Date().toISOString();
    await supabase
      .from("appointments")
      .update({ actual_start: now, status: "in_progress" })
      .eq("id", id);
    load();
  }

  // "Which services were rendered" step before completion — same reasoning as the
  // employee homepage's stop-timer flow: appointment_services rows have to exist
  // before the status flip, since the inventory-decrement trigger fires on that
  // same UPDATE. Optional, so a salon without `services` set up isn't blocked.
  async function openCompleteModal() {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("salon_id", profile?.salon_id)
      .eq("is_active", true)
      .order("name");
    setCompleteServices((data as Service[]) ?? []);
    setSelectedServiceIds([]);
    setCompleteModal(true);
  }

  function toggleCompleteService(serviceId: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((x) => x !== serviceId) : [...prev, serviceId]
    );
  }

  async function confirmComplete() {
    setCompleting(true);
    if (selectedServiceIds.length > 0) {
      await supabase.from("appointment_services").insert(
        selectedServiceIds.map((service_id) => ({ appointment_id: id, service_id }))
      );
    }
    const now = new Date().toISOString();
    await supabase
      .from("appointments")
      .update({ actual_end: now, status: "completed" })
      .eq("id", id);
    setCompleting(false);
    setCompleteModal(false);
    load();
  }

  async function markNoShow() {
    await supabase
      .from("appointments")
      .update({ status: "no_show" })
      .eq("id", id);
    load();
  }

  async function cancelAppointment() {
    await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);
    router.back();
  }

  function openCorrectionModal() {
    setCorrectionStart(appointment?.actual_start ? formatTime(appointment.actual_start) : "");
    setCorrectionEnd(appointment?.actual_end ? formatTime(appointment.actual_end) : "");
    setCorrectionReason("");
    setCorrectionDone(false);
    setCorrectionModal(true);
  }

  async function submitCorrection() {
    if (!appointment || !correctionReason.trim()) return;
    setCorrectionSubmitting(true);
    await supabase.from("correction_requests").insert({
      appointment_id: appointment.id,
      requested_by: profile?.id,
      original_data: {
        actual_start: appointment.actual_start,
        actual_end: appointment.actual_end,
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

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (!appointment)
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Termin nicht gefunden.</Text>
      </View>
    );

  const isScheduled = appointment.status === "scheduled";
  const isActive = appointment.status === "in_progress";
  const isDone = ["completed", "cancelled", "no_show"].includes(
    appointment.status
  );

  const mins =
    appointment.actual_start && appointment.actual_end
      ? minutesBetween(appointment.actual_start, appointment.actual_end)
      : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Termindetails</Text>
        <View style={styles.topBarActions}>
          {!isDone && (
            <TouchableOpacity onPress={() => setConfirmDelete(!confirmDelete)}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </TouchableOpacity>
          )}
          <HelpButton pageKey="appointmentDetail" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Stornieren confirmation */}
        {confirmDelete && (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              Termin stornieren? Zeitdaten bleiben erhalten (GoBD).
            </Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmDelete(false)}
              >
                <Text style={styles.confirmCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDelete}
                onPress={cancelAppointment}
              >
                <Text style={styles.confirmDeleteText}>Ja, stornieren</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Client + status */}
        <View style={styles.card}>
          <Text style={styles.clientName}>{appointment.client_name}</Text>
          <Text style={styles.category}>
            {(appointment.service_category as any)?.name}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusChip,
                {
                  borderColor:
                    STATUS_COLORS[appointment.status] + "55",
                  backgroundColor:
                    STATUS_COLORS[appointment.status] + "22",
                },
              ]}
            >
              {isActive && (
                <View style={styles.activeDot} />
              )}
              <Text
                style={[
                  styles.statusText,
                  { color: STATUS_COLORS[appointment.status] },
                ]}
              >
                {STATUS_LABELS[appointment.status]}
              </Text>
            </View>
            {appointment.customer_type === "walkin" && (
              <View style={styles.walkinChip}>
                <Text style={styles.walkinText}>Laufkunde</Text>
              </View>
            )}
          </View>
        </View>

        {/* Live timer when active */}
        {isActive && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Laufzeit</Text>
            <Text style={styles.timerValue}>{elapsed}</Text>
          </View>
        )}

        {/* Assigned employee */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Mitarbeiter</Text>
          <Text style={styles.value}>
            {(appointment.assigned_profile as any)?.full_name ?? "–"}
          </Text>
        </View>

        {/* Scheduled time */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Geplante Zeit</Text>
          <Text style={styles.value}>
            {formatDate(appointment.scheduled_start)} ·{" "}
            {formatTime(appointment.scheduled_start)} –{" "}
            {formatTime(appointment.scheduled_end)}
          </Text>
        </View>

        {/* Actual time */}
        {(appointment.actual_start || appointment.actual_end) && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Tatsächliche Zeit</Text>
            <Text style={styles.value}>
              {appointment.actual_start
                ? formatTime(appointment.actual_start)
                : "–"}{" "}
              –{" "}
              {appointment.actual_end
                ? formatTime(appointment.actual_end)
                : "läuft noch"}
            </Text>
            {mins !== null && (
              <Text style={styles.duration}>{formatDurationHHMM(mins)}</Text>
            )}
          </View>
        )}

        {/* Notes */}
        {appointment.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Notizen</Text>
            <Text style={styles.value}>{appointment.notes}</Text>
          </View>
        )}

        {/* Action buttons */}
        {isScheduled && (
          <>
            <TouchableOpacity style={styles.startBtn} onPress={startTimer}>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.startBtnText}>Timer starten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.noShowBtn} onPress={markNoShow}>
              <Text style={styles.noShowText}>
                Als "Nicht erschienen" markieren
              </Text>
            </TouchableOpacity>
          </>
        )}

        {isActive && (
          <TouchableOpacity style={styles.stopBtn} onPress={openCompleteModal}>
            <Ionicons name="stop" size={18} color="#fff" />
            <Text style={styles.stopBtnText}>Timer beenden</Text>
          </TouchableOpacity>
        )}

        {appointment.status === "completed" && (
          <TouchableOpacity style={styles.correctionBtn} onPress={openCorrectionModal}>
            <Ionicons name="create-outline" size={18} color={colors.warning} />
            <Text style={styles.correctionBtnText}>Zeitkorrektur beantragen</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={correctionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {correctionDone ? (
              <>
                <Ionicons name="checkmark-circle" size={48} color={colors.success} style={{ alignSelf: "center" }} />
                <Text style={styles.modalTitle}>Anfrage eingereicht</Text>
                <Text style={styles.modalHint}>Der Inhaber wird die Korrektur prüfen.</Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCorrectionModal(false)}>
                  <Text style={styles.modalCloseBtnText}>Schließen</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Zeitkorrektur: {appointment?.client_name}</Text>
                <Text style={styles.modalHint}>Tatsächlicher Beginn (HH:MM)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={correctionStart}
                  onChangeText={setCorrectionStart}
                  placeholder="09:00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={styles.modalHint}>Tatsächliches Ende (HH:MM)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={correctionEnd}
                  onChangeText={setCorrectionEnd}
                  placeholder="10:30"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={styles.modalHint}>Begründung *</Text>
                <TextInput
                  style={[styles.modalInput, { height: 80, textAlignVertical: "top" }]}
                  value={correctionReason}
                  onChangeText={setCorrectionReason}
                  placeholder="z.B. Timer vergessen zu stoppen…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, (!correctionReason.trim() || correctionSubmitting) && { opacity: 0.5 }]}
                  onPress={submitCorrection}
                  disabled={!correctionReason.trim() || correctionSubmitting}
                >
                  <Text style={styles.modalSubmitText}>
                    {correctionSubmitting ? "Einreichen…" : "Anfrage einreichen"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCorrectionModal(false)}>
                  <Text style={styles.modalCancelText}>Abbrechen</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={completeModal} transparent animationType="slide">
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
                      style={styles.serviceRow}
                      onPress={() => toggleCompleteService(item.id)}
                    >
                      <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={20}
                        color={selected ? colors.primary : colors.textMuted}
                      />
                      <Text style={styles.serviceRowText}>
                        {item.name} · €{item.price.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity
              style={[styles.modalSubmitBtn, completing && { opacity: 0.5 }]}
              onPress={confirmComplete}
              disabled={completing}
            >
              <Text style={styles.modalSubmitText}>{completing ? "Abschließen…" : "Fertig"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCompleteModal(false)}>
              <Text style={styles.modalCancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  errorText: { color: colors.textMuted, fontSize: 15 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  topBarActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  content: { padding: 16, gap: 10 },

  confirmBox: {
    backgroundColor: "#3d0000",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: 12,
  },
  confirmText: { color: colors.textLight, fontSize: 14, lineHeight: 20 },
  confirmRow: { flexDirection: "row", gap: 10 },
  confirmCancel: {
    flex: 1,
    borderRadius: 8,
    padding: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmCancelText: { color: colors.textMuted, fontWeight: "600" },
  confirmDelete: {
    flex: 1,
    borderRadius: 8,
    padding: 11,
    alignItems: "center",
    backgroundColor: colors.danger,
  },
  confirmDeleteText: { color: "#fff", fontWeight: "700" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clientName: { fontSize: 22, fontWeight: "700", color: colors.text },
  category: { fontSize: 15, color: colors.textMuted },
  statusRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusText: { fontSize: 13, fontWeight: "600" },
  walkinChip: {
    backgroundColor: colors.walkin,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  walkinText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  timerCard: {
    backgroundColor: colors.timerBg,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.success + "55",
    gap: 4,
  },
  timerLabel: { fontSize: 12, color: colors.success, textTransform: "uppercase", letterSpacing: 1 },
  timerValue: {
    fontSize: 42,
    fontWeight: "800",
    color: colors.success,
    fontVariant: ["tabular-nums"],
  },

  sectionLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: { fontSize: 16, color: colors.text },
  duration: { fontSize: 18, fontWeight: "700", color: colors.primary },

  startBtn: {
    backgroundColor: colors.success,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  stopBtn: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  stopBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  noShowBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: 4,
  },
  noShowText: { color: colors.warning, fontWeight: "600", fontSize: 15 },

  correctionBtn: {
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: 4,
  },
  correctionBtnText: { color: colors.warning, fontWeight: "600", fontSize: 15 },

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
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
  modalHint: { fontSize: 13, color: colors.textMuted },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  serviceRowText: { fontSize: 15, color: colors.text },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  modalSubmitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalCloseBtn: { padding: 14, alignItems: "center" },
  modalCloseBtnText: { color: colors.textMuted, fontSize: 15 },
  modalCancelText: { color: colors.textMuted, textAlign: "center", padding: 12 },
});

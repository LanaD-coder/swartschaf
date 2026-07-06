import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { format, startOfDay, addDays } from "date-fns";
import { de } from "date-fns/locale";
import AvatarPicker from "@/components/AvatarPicker";
import { Break, BreakType, Appointment } from "@/lib/types";
import { formatElapsed, formatTime } from "@/utils/dateFormat";

const STATUS_COLORS: Record<string, string> = {
  scheduled: colors.textMuted,
  in_progress: colors.success,
  completed: colors.primary,
  cancelled: colors.danger,
  no_show: colors.warning,
};

const BREAK_OPTIONS: { type: BreakType; label: string; icon: string; color: string }[] = [
  { type: "lunch",   label: "Mittagspause",  icon: "restaurant-outline", color: "#F39C12" },
  { type: "coffee",  label: "Kaffeepause",   icon: "cafe-outline",        color: "#AB8476" },
  { type: "sick",    label: "Krank",          icon: "medical-outline",     color: "#C45C6A" },
  { type: "day_off", label: "Frei / Urlaub", icon: "sunny-outline",       color: "#5DB88A" },
];

function breakLabel(type: BreakType) {
  return BREAK_OPTIONS.find((b) => b.type === type)?.label ?? type;
}
function breakColor(type: BreakType) {
  return BREAK_OPTIONS.find((b) => b.type === type)?.color ?? colors.primary;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
};

interface NavCard {
  id: string;
  icon: string;
  label: string;
  subtitle: string;
  description: string;
  route: string;
  accent: string;
  badge?: number;
}

export default function OwnerDashboard() {
  const { profile, salon } = useAuthStore();
  const [todayCount, setTodayCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [pendingCorrections, setPendingCorrections] = useState(0);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [activeBreak, setActiveBreak] = useState<Break | null>(null);
  const [breakElapsed, setBreakElapsed] = useState("");

  useEffect(() => {
    loadStats();
    loadBreak();
  }, []);

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
      .insert({ profile_id: profile.id, salon_id: profile.salon_id, break_type: type })
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

  async function loadStats() {
    const start = startOfDay(new Date()).toISOString();
    const end = startOfDay(addDays(new Date(), 1)).toISOString();

    const [appts, apptList, emps, corrections] = await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", profile?.salon_id)
        .gte("scheduled_start", start)
        .lt("scheduled_start", end),
      supabase
        .from("appointments")
        .select("*, service_category:service_categories(*), assigned_profile:profiles!assigned_to(*)")
        .eq("salon_id", profile?.salon_id)
        .gte("scheduled_start", start)
        .lt("scheduled_start", end)
        .order("scheduled_start", { ascending: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", profile?.salon_id)
        .eq("is_active", true)
        .eq("role", "employee"),
      supabase
        .from("correction_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    setTodayCount(appts.count ?? 0);
    setTodayAppointments((apptList.data as Appointment[]) ?? []);
    setEmployeeCount(emps.count ?? 0);
    setPendingCorrections(corrections.count ?? 0);
  }

  const cards: NavCard[] = [
    {
      id: "calendar",
      icon: "calendar",
      label: "Kalender",
      subtitle: `${todayCount} Termine heute`,
      description:
        "Tagesansicht aller Termine. Navigieren Sie durch Tage und sehen Sie den Status jedes Termins in Echtzeit.",
      route: "/(owner)/calendar",
      accent: colors.primary,
    },
    {
      id: "employees",
      icon: "people",
      label: "Mitarbeiter",
      subtitle: `${employeeCount} aktiv`,
      description:
        "Mitarbeiter hinzufügen und verwalten. Jeder Mitarbeiter erhält einen 4-stelligen PIN für die Anmeldung.",
      route: "/(owner)/employees",
      accent: "#5DB88A",
    },
    {
      id: "corrections",
      icon: "create",
      label: "Zeitkorrekturen",
      subtitle:
        pendingCorrections > 0
          ? `${pendingCorrections} ausstehend`
          : "Keine offenen",
      description:
        "GoBD-konforme Zeitkorrekturen: Mitarbeiter stellen Änderungsanträge, Sie genehmigen oder lehnen ab. Ursprungsdaten bleiben erhalten.",
      route: "/(owner)/corrections",
      accent: colors.warning,
      badge: pendingCorrections > 0 ? pendingCorrections : undefined,
    },
    {
      id: "reports",
      icon: "document-text",
      label: "Berichte",
      subtitle: "PDF exportieren",
      description:
        "Arbeitszeitnachweise als PDF für das Finanzamt. Täglich, wöchentlich oder monatlich – GoBD-konform mit Unterschriftszeilen.",
      route: "/(owner)/reports",
      accent: "#AB8476",
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <AvatarPicker size={56} />
          <View style={styles.headerText}>
            <Text style={styles.greetingText}>{greeting()},</Text>
            <Text style={styles.ownerName}>{profile?.full_name}</Text>
            <Text style={styles.salonName}>{salon?.name}</Text>
          </View>
          <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Date */}
        <Text style={styles.dateText}>
          {format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de })}
        </Text>

        {/* Nav cards — 2 columns */}
        <Text style={styles.sectionLabel}>Schnellzugriff</Text>
        <View style={styles.grid}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.route}
              style={styles.card}
              onPress={() => router.push(card.route as any)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: card.accent + "22" },
                ]}
              >
                <Ionicons
                  name={card.icon as any}
                  size={28}
                  color={card.accent}
                />
              </View>
              <Text style={styles.cardLabel}>{card.label}</Text>
              <Text style={styles.cardSub}>{card.subtitle}</Text>

              {activeInfo === card.id && (
                <Text style={styles.cardDesc}>{card.description}</Text>
              )}

              {/* Info toggle button */}
              <TouchableOpacity
                style={styles.infoBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  setActiveInfo(activeInfo === card.id ? null : card.id);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={
                    activeInfo === card.id
                      ? "close-circle"
                      : "information-circle-outline"
                  }
                  size={18}
                  color={
                    activeInfo === card.id ? colors.textMuted : colors.border
                  }
                />
              </TouchableOpacity>

              {card.badge != null && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{card.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Today's appointments */}
        {todayAppointments.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Termine heute</Text>
            {todayAppointments.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.apptCard}
                onPress={() => router.push(`/(owner)/appointments/${a.id}` as any)}
              >
                <View style={[styles.apptStatusBar, { backgroundColor: STATUS_COLORS[a.status] ?? colors.border }]} />
                <View style={styles.apptBody}>
                  <View style={styles.apptRow}>
                    <Text style={styles.apptClient}>{a.client_name}</Text>
                    <Text style={styles.apptTime}>{formatTime(a.scheduled_start)}</Text>
                  </View>
                  <Text style={styles.apptSub}>
                    {(a.assigned_profile as any)?.full_name ?? "–"} · {(a.service_category as any)?.name ?? "–"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* New appointment CTA */}
        <TouchableOpacity
          style={styles.newApptBtn}
          onPress={() => router.push("/(owner)/appointments/new")}
        >
          <Ionicons name="add-circle-outline" size={22} color="#fff" />
          <Text style={styles.newApptText}>Neuen Termin anlegen</Text>
        </TouchableOpacity>

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
              <Text style={[styles.pauseTimer, { color: breakColor(activeBreak.break_type) }]}>
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

        {/* Branding */}
        <View style={styles.brandWrap}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.brandIcon}
            resizeMode="contain"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 0 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 8,
  },
  headerText: { flex: 1 },
  logoutBtn: { padding: 6 },
  greetingText: { fontSize: 14, color: colors.textMuted },
  ownerName: { fontSize: 20, fontWeight: "800", color: colors.text },
  salonName: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 2,
  },

  dateText: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  card: {
    width: "47.5%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  cardDesc: {
    fontSize: 12,
    color: colors.textLight,
    lineHeight: 17,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
  },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: colors.warning,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  newApptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  newApptText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  apptCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  apptStatusBar: { width: 4 },
  apptBody: { flex: 1, padding: 14, gap: 4 },
  apptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  apptClient: { fontSize: 15, fontWeight: "600", color: colors.text },
  apptTime: { fontSize: 13, color: colors.textMuted },
  apptSub: { fontSize: 13, color: colors.textMuted },

  pauseCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  pauseCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  breakChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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

  brandWrap: {
    width: "100%",
    height: 180,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 20,
    overflow: "hidden",
    opacity: 0.5,
  },
  brandIcon: {
    width: "100%",
    height: "100%",
  },
});

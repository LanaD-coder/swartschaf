import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { Profile } from "@/lib/types";
import { colors } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import HelpButton from "@/components/HelpButton";

const EMPLOYEE_COLORS = [
  "#e94560",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#e74c3c",
];

export default function EmployeesScreen() {
  const { profile } = useAuthStore();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [selectedColor, setSelectedColor] = useState(EMPLOYEE_COLORS[1]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("salon_id", profile?.salon_id)
      .eq("role", "employee")
      .order("full_name");
    setEmployees((data as Profile[]) ?? []);
    setLoading(false);
  }

  async function addEmployee() {
    setErrorMsg(null);
    if (!name.trim() || pin.length !== 4) {
      setErrorMsg("Bitte Name und 4-stelligen PIN eingeben.");
      return;
    }
    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    let res: Response;
    try {
      res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-employee`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            full_name: name.trim(),
            pin,
            color: selectedColor,
            salon_id: profile?.salon_id,
          }),
        }
      );
    } catch {
      setSaving(false);
      setErrorMsg(
        "Edge Function nicht erreichbar. Bitte erst deployen: supabase functions deploy create-employee"
      );
      return;
    }

    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setErrorMsg(json.error ?? "Mitarbeiter konnte nicht angelegt werden.");
      return;
    }

    setAddModal(false);
    setName("");
    setPin("");
    setErrorMsg(null);
    load();
  }

  async function toggleActive(emp: Profile) {
    await supabase
      .from("profiles")
      .update({ is_active: !emp.is_active })
      .eq("id", emp.id);
    load();
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={employees}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Mitarbeiter</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <HelpButton pageKey="employeesList" />
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => {
                  setErrorMsg(null);
                  setAddModal(true);
                }}
              >
                <Ionicons name="person-add-outline" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Hinzufügen</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.is_active && styles.cardInactive]}
            onPress={() => router.push(`/(owner)/employees/${item.id}` as any)}
          >
            <View style={[styles.avatar, { backgroundColor: item.color }]}>
              <Text style={styles.avatarText}>
                {item.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.empName}>{item.full_name}</Text>
              <View style={styles.empRoleRow}>
                <Text style={styles.empRole}>Mitarbeiter · PIN: ••••</Text>
                {!item.sofortmeldung_confirmed_at && (
                  <Ionicons name="alert-circle" size={14} color={colors.warning} />
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => toggleActive(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons
                name={
                  item.is_active
                    ? "pause-circle-outline"
                    : "play-circle-outline"
                }
                size={26}
                color={item.is_active ? colors.textMuted : colors.success}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Noch keine Mitarbeiter angelegt</Text>
          </View>
        }
      />

      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>Mitarbeiter hinzufügen</Text>

            <View style={styles.noticeBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
              <Text style={styles.noticeText}>
                Das Friseurhandwerk unterliegt der Sofortmeldepflicht: Melden Sie neue Mitarbeiter
                vor deren erstem Arbeitstag beim Zoll (sv.net) und informieren Sie sie über die
                Ausweispflicht am Arbeitsplatz. Sie können beides nach dem Anlegen im Mitarbeiter-Profil bestätigen.
              </Text>
            </View>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Vor- und Nachname"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.fieldLabel}>4-stelliger PIN</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))}
              placeholder="z.B. 1234"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              secureTextEntry
            />

            <Text style={styles.fieldLabel}>Farbe im Kalender</Text>
            <View style={styles.colorRow}>
              {EMPLOYEE_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    selectedColor === c && styles.colorDotSelected,
                  ]}
                  onPress={() => setSelectedColor(c)}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={addEmployee}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? "Anlegen..." : "Mitarbeiter anlegen"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setAddModal(false);
                setErrorMsg(null);
              }}
            >
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  content: { padding: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heading: { fontSize: 22, fontWeight: "700", color: colors.text },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInactive: { opacity: 0.5 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  info: { flex: 1 },
  empName: { fontSize: 16, fontWeight: "600", color: colors.text },
  empRoleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  empRole: { fontSize: 13, color: colors.textMuted },
  empty: { alignItems: "center", gap: 12, marginTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  noticeBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.warning + "18",
    borderWidth: 1,
    borderColor: colors.warning + "55",
    borderRadius: 10,
    padding: 12,
  },
  noticeText: { flex: 1, fontSize: 12, color: colors.textLight, lineHeight: 17 },
  fieldLabel: { fontSize: 13, color: colors.textMuted },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: "transparent",
  },
  colorDotSelected: { borderColor: "#fff" },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelText: { color: colors.textMuted, textAlign: "center", padding: 12 },
  errorBox: {
    backgroundColor: "#3d0000",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ff4444",
  },
  errorText: { color: "#ff6666", fontSize: 13 },
});

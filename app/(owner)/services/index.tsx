import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { colors, layout } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import HelpButton from "@/components/HelpButton";
import { Service, ServiceCategory } from "@/lib/types";

export default function ServicesScreen() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [svcRes, catRes] = await Promise.all([
      supabase
        .from("services")
        .select("*, service_category:service_categories(*)")
        .eq("salon_id", profile?.salon_id)
        .order("name"),
      supabase
        .from("service_categories")
        .select("*")
        .eq("salon_id", profile?.salon_id)
        .eq("is_active", true)
        .order("name"),
    ]);
    setServices((svcRes.data as Service[]) ?? []);
    setCategories((catRes.data as ServiceCategory[]) ?? []);
    setLoading(false);
  }

  function openModal(service?: Service) {
    setEditing(service ?? null);
    setName(service?.name ?? "");
    setCategoryId(service?.service_category_id ?? categories[0]?.id ?? null);
    setPrice(service ? String(service.price) : "");
    setDuration(service?.duration_minutes != null ? String(service.duration_minutes) : "");
    setModal(true);
  }

  async function save() {
    if (!name.trim() || !price) return;
    setSaving(true);
    const payload = {
      salon_id: profile?.salon_id,
      service_category_id: categoryId,
      name: name.trim(),
      price: Number(price),
      duration_minutes: duration ? Number(duration) : null,
    };
    if (editing) {
      await supabase.from("services").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("services").insert(payload);
    }
    setSaving(false);
    setModal(false);
    load();
  }

  function remove(service: Service) {
    Alert.alert("Löschen?", `"${service.name}" wirklich löschen?`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          await supabase.from("services").delete().eq("id", service.id);
          load();
        },
      },
    ]);
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Leistungen</Text>
          <HelpButton pageKey="services" />
        </View>
        <Text style={styles.hint}>
          Preisvarianten je Leistung, z.B. "Schneiden Kurz Damen" und "Schneiden Lang Herren" separat
          mit eigenem Preis — die Kategorie (Farbe im Kalender) bleibt wie gewohnt darüber.
        </Text>

        <TouchableOpacity
          style={[styles.addBtn, !categories.length && { opacity: 0.5 }]}
          onPress={() => openModal()}
          disabled={!categories.length}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Leistung hinzufügen</Text>
        </TouchableOpacity>
        {!categories.length && (
          <Text style={styles.hint}>
            Es sind noch keine Leistungskategorien vorhanden. Diese werden bei der Registrierung
            angelegt.
          </Text>
        )}

        {services.length === 0 && categories.length > 0 && (
          <View style={styles.empty}>
            <Ionicons name="cut-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>Noch keine Leistungen angelegt</Text>
          </View>
        )}

        {services.map((s) => (
          <TouchableOpacity key={s.id} style={styles.card} onPress={() => openModal(s)}>
            <View style={[styles.colorDot, { backgroundColor: s.service_category?.color ?? colors.textMuted }]} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{s.name}</Text>
              <Text style={styles.cardSubtitle}>
                €{s.price.toFixed(2)}
                {s.duration_minutes ? ` · ${s.duration_minutes} Min.` : ""}
                {s.service_category ? ` · ${s.service_category.name}` : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={() => remove(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editing ? "Leistung bearbeiten" : "Leistung hinzufügen"}
              </Text>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="z.B. Schneiden Kurz Damen"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Kategorie</Text>
              <View style={styles.chipRow}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, categoryId === c.id && styles.chipActive]}
                    onPress={() => setCategoryId(c.id)}
                  >
                    <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Preis (€)</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Dauer in Minuten (optional)</Text>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholder="z.B. 45"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={save}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? "Speichern..." : "Speichern"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Text style={styles.cancelText}>Abbrechen</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  content: { padding: 16, ...layout.contentWidth },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  heading: { fontSize: 22, fontWeight: "700", color: colors.text },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { alignItems: "center", gap: 12, marginTop: 40, marginBottom: 20 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 10,
    maxHeight: "85%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
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
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelText: { color: colors.textMuted, textAlign: "center", padding: 12 },
});

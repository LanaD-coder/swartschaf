import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { Profile, ServiceCategory, Customer } from "@/lib/types";
import { colors, layout } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import HelpButton from "@/components/HelpButton";

export default function NewAppointment() {
  const { profile } = useAuthStore();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [clientName, setClientName] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [saveAsStammkunde, setSaveAsStammkunde] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(
    null
  );
  const [selectedCategories, setSelectedCategories] = useState<ServiceCategory[]>([]);
  const [date, setDate] = useState(format(new Date(), "dd.MM.yyyy"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [empRes, catRes, custRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("salon_id", profile?.salon_id)
        .eq("is_active", true),
      supabase
        .from("service_categories")
        .select("*")
        .eq("salon_id", profile?.salon_id)
        .eq("is_active", true),
      supabase
        .from("customers")
        .select("*")
        .eq("salon_id", profile?.salon_id)
        .order("full_name"),
    ]);
    setEmployees((empRes.data as Profile[]) ?? []);
    setCategories((catRes.data as ServiceCategory[]) ?? []);
    setCustomers((custRes.data as Customer[]) ?? []);
  }

  function parseDateTime(dateStr: string, timeStr: string): string | null {
    const [d, m, y] = dateStr.split(".");
    const [h, min] = timeStr.split(":");
    if (!d || !m || !y || !h || !min) return null;
    return new Date(+y, +m - 1, +d, +h, +min).toISOString();
  }

  const filteredCustomers = customers.filter((c) =>
    c.full_name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const isNewName =
    customerSearch.trim().length > 0 &&
    !selectedCustomer &&
    !customers.some(
      (c) => c.full_name.toLowerCase() === customerSearch.trim().toLowerCase()
    );

  function selectCustomer(c: Customer) {
    setCustomerSearch(c.full_name);
    setClientName(c.full_name);
    setSelectedCustomer(c);
    setShowDropdown(false);
    setSaveAsStammkunde(false);
  }

  function toggleCategory(c: ServiceCategory) {
    setSelectedCategories((prev) =>
      prev.find((x) => x.id === c.id)
        ? prev.filter((x) => x.id !== c.id)
        : [...prev, c]
    );
  }

  async function save() {
    setErrorMsg(null);
    if (
      !clientName.trim() ||
      !selectedEmployee ||
      selectedCategories.length === 0 ||
      !startTime ||
      !endTime
    ) {
      setErrorMsg("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    const scheduledStart = parseDateTime(date, startTime);
    const scheduledEnd = parseDateTime(date, endTime);
    if (!scheduledStart || !scheduledEnd) {
      setErrorMsg("Ungültige Datum- oder Zeitangabe. Format: TT.MM.JJJJ und HH:MM");
      return;
    }
    setSaving(true);

    if (saveAsStammkunde && isNewName) {
      await supabase.from("customers").insert({
        salon_id: profile?.salon_id,
        full_name: clientName.trim(),
      });
    }

    const { error } = await supabase.from("appointments").insert({
      salon_id: profile?.salon_id,
      assigned_to: selectedEmployee.id,
      client_name: clientName.trim(),
      service_category_id: selectedCategories[0].id,
      service_category_ids: selectedCategories.map((c) => c.id),
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      customer_type: "appointment",
      notes: notes.trim() || null,
      status: "scheduled",
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Neuer Termin</Text>
        <View style={styles.topBarActions}>
          <HelpButton pageKey="appointmentNew" />
          <TouchableOpacity onPress={save} disabled={saving}>
            <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? "..." : "Speichern"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Customer picker */}
        <Text style={styles.label}>Kundenname *</Text>
        <View>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, styles.searchInput]}
              value={customerSearch}
              onChangeText={(t) => {
                setCustomerSearch(t);
                setClientName(t);
                setSelectedCustomer(null);
                setShowDropdown(true);
                setSaveAsStammkunde(false);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Name suchen oder eingeben…"
              placeholderTextColor={colors.textMuted}
            />
            {selectedCustomer && (
              <View style={styles.stammkundeBadge}>
                <Ionicons name="star" size={12} color={colors.primary} />
                <Text style={styles.stammkundeLabel}>Stammkunde</Text>
              </View>
            )}
          </View>

          {/* Dropdown — show all on focus, filter while typing */}
          {showDropdown && !selectedCustomer && (() => {
            const list = customerSearch.length === 0
              ? customers.slice(0, 8)
              : filteredCustomers.slice(0, 8);
            if (list.length === 0) return null;
            return (
              <View style={styles.dropdown}>
                {list.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.dropdownItem}
                    onPress={() => selectCustomer(c)}
                  >
                    <Ionicons name="person" size={14} color={colors.primary} />
                    <Text style={styles.dropdownText}>{c.full_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}

          {/* Save as Stammkunde */}
          {isNewName && (
            <TouchableOpacity
              style={styles.stammkundeRow}
              onPress={() => setSaveAsStammkunde(!saveAsStammkunde)}
            >
              <Ionicons
                name={saveAsStammkunde ? "checkbox" : "square-outline"}
                size={20}
                color={saveAsStammkunde ? colors.primary : colors.textMuted}
              />
              <Text style={styles.stammkundeToggleText}>
                Als Stammkunde merken
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.label}>Datum *</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="TT.MM.JJJJ"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Von *</Text>
            <TextInput
              style={styles.input}
              value={startTime}
              onChangeText={setStartTime}
              placeholder="09:00"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Bis *</Text>
            <TextInput
              style={styles.input}
              value={endTime}
              onChangeText={setEndTime}
              placeholder="10:30"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        <Text style={styles.label}>Mitarbeiter *</Text>
        <View style={styles.chips}>
          {employees.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={[
                styles.chip,
                selectedEmployee?.id === e.id && styles.chipSelected,
              ]}
              onPress={() => setSelectedEmployee(e)}
            >
              <View style={[styles.chipDot, { backgroundColor: e.color }]} />
              <Text
                style={[
                  styles.chipText,
                  selectedEmployee?.id === e.id && styles.chipTextSelected,
                ]}
              >
                {e.full_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Leistung * (Mehrfachauswahl)</Text>
        <View style={styles.chips}>
          {categories.map((c) => {
            const isSelected = selectedCategories.some((x) => x.id === c.id);
            return (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => toggleCategory(c)}
            >
              <View style={[styles.chipDot, { backgroundColor: c.color }]} />
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          );
          })}
        </View>

        <Text style={styles.label}>Notizen</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optionale Hinweise..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
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
  saveBtn: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  content: { padding: 16, gap: 6, ...layout.contentWidth },
  label: { fontSize: 13, color: colors.textMuted, marginTop: 10, marginBottom: 4 },

  errorBox: {
    backgroundColor: "#FDE8E8",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f3b4b4",
  },
  errorText: { color: colors.danger, fontSize: 14 },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },

  dropdown: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownText: { fontSize: 15, color: colors.text },

  stammkundeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary + "22",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.primary + "55",
  },
  stammkundeLabel: { fontSize: 11, color: colors.primary, fontWeight: "600" },

  stammkundeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingLeft: 2,
  },
  stammkundeToggleText: { fontSize: 14, color: colors.textMuted },

  textarea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: "#FCE4E8" },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  chipText: { color: colors.textLight, fontSize: 14 },
  chipTextSelected: { color: colors.primary, fontWeight: "600" },
});

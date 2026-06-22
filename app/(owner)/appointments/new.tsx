import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput,
  TouchableOpacity, Alert, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Profile, ServiceCategory } from '@/lib/types';
import { colors } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function NewAppointment() {
  const { profile } = useAuthStore();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  const [clientName, setClientName] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [date, setDate] = useState(format(new Date(), 'dd.MM.yyyy'));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [empRes, catRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('salon_id', profile?.salon_id).eq('is_active', true),
      supabase.from('service_categories').select('*').eq('salon_id', profile?.salon_id).eq('is_active', true),
    ]);
    setEmployees((empRes.data as Profile[]) ?? []);
    setCategories((catRes.data as ServiceCategory[]) ?? []);
  }

  function parseDateTime(dateStr: string, timeStr: string): string | null {
    const [d, m, y] = dateStr.split('.');
    const [h, min] = timeStr.split(':');
    if (!d || !m || !y || !h || !min) return null;
    return new Date(+y, +m - 1, +d, +h, +min).toISOString();
  }

  async function save() {
    if (!clientName.trim() || !selectedEmployee || !selectedCategory || !startTime || !endTime) {
      Alert.alert('Fehler', 'Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    const scheduledStart = parseDateTime(date, startTime);
    const scheduledEnd = parseDateTime(date, endTime);
    if (!scheduledStart || !scheduledEnd) {
      Alert.alert('Fehler', 'Ungültige Datum- oder Zeitangabe. Format: TT.MM.JJJJ und HH:MM');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('appointments').insert({
      salon_id: profile?.salon_id,
      assigned_to: selectedEmployee.id,
      client_name: clientName.trim(),
      service_category_id: selectedCategory.id,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      customer_type: 'appointment',
      notes: notes.trim() || null,
      status: 'scheduled',
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Fehler', error.message);
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
        <TouchableOpacity onPress={save} disabled={saving}>
          <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? '...' : 'Speichern'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Kundenname *</Text>
        <TextInput style={styles.input} value={clientName} onChangeText={setClientName} placeholder="z.B. Frau Müller" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Datum *</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="TT.MM.JJJJ" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Von *</Text>
            <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="09:00" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Bis *</Text>
            <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="10:30" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" />
          </View>
        </View>

        <Text style={styles.label}>Mitarbeiter *</Text>
        <View style={styles.chips}>
          {employees.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={[styles.chip, selectedEmployee?.id === e.id && styles.chipSelected]}
              onPress={() => setSelectedEmployee(e)}
            >
              <View style={[styles.chipDot, { backgroundColor: e.color }]} />
              <Text style={[styles.chipText, selectedEmployee?.id === e.id && styles.chipTextSelected]}>
                {e.full_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Leistung *</Text>
        <View style={styles.chips}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, selectedCategory?.id === c.id && styles.chipSelected]}
              onPress={() => setSelectedCategory(c)}
            >
              <View style={[styles.chipDot, { backgroundColor: c.color }]} />
              <Text style={[styles.chipText, selectedCategory?.id === c.id && styles.chipTextSelected]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  saveBtn: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  content: { padding: 16, gap: 6 },
  label: { fontSize: 13, color: colors.textMuted, marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: '#2a0a18' },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  chipText: { color: colors.textLight, fontSize: 14 },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
});

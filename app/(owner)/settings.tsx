import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { colors, layout } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AvatarPicker from '@/components/AvatarPicker';
import HelpButton from '@/components/HelpButton';

export default function SettingsScreen() {
  const { profile, salon, setSalon } = useAuthStore();
  const [salonName, setSalonName] = useState(salon?.name ?? '');
  const [steuernummer, setSteuernummer] = useState(salon?.steuernummer ?? '');
  const [address, setAddress] = useState(salon?.address ?? '');
  const [saving, setSaving] = useState(false);
  const [saloncodeInfo, setSaloncodeInfo] = useState(false);

  async function saveSalon() {
    if (!salon) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('salons')
      .update({ name: salonName, steuernummer, address })
      .eq('id', salon.id)
      .select()
      .single();
    setSaving(false);
    if (error) { Alert.alert('Fehler', error.message); return; }
    setSalon(data);
    Alert.alert('Gespeichert', 'Salondetails wurden aktualisiert.');
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  const planLabels: Record<string, string> = {
    starter: 'Starter (bis 3 Mitarbeiter)',
    pro: 'Pro (unbegrenzt)',
  };
  const statusLabels: Record<string, string> = {
    active: 'Aktiv',
    trialing: 'Testphase (14 Tage)',
    past_due: 'Zahlung überfällig',
    canceled: 'Gekündigt',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Einstellungen</Text>
          <HelpButton pageKey="settings" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mein Profil</Text>
          <View style={styles.profileRow}>
            <AvatarPicker size={80} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile?.full_name}</Text>
              <Text style={styles.profileRole}>Inhaber</Text>
              <Text style={styles.profileHint}>Tippen Sie auf das Bild zum Ändern</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Salon</Text>
          <Text style={styles.label}>Salonname</Text>
          <TextInput style={styles.input} value={salonName} onChangeText={setSalonName} placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Steuernummer</Text>
          <TextInput style={styles.input} value={steuernummer} onChangeText={setSteuernummer} placeholder="123/456/78901" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" />
          <Text style={styles.label}>Adresse</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Straße Nr., PLZ Stadt" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={saveSalon} disabled={saving}>
            <Text style={styles.btnText}>{saving ? 'Speichern...' : 'Speichern'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Abonnement</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plan</Text>
            <Text style={styles.infoValue}>{planLabels[salon?.plan ?? ''] ?? '–'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.infoValue, salon?.subscription_status === 'active' && { color: colors.success }]}>
              {statusLabels[salon?.subscription_status ?? ''] ?? '–'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoLabelRow}>
              <Text style={styles.infoLabel}>Saloncode</Text>
              <TouchableOpacity
                onPress={() => setSaloncodeInfo((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={saloncodeInfo ? 'close-circle' : 'information-circle-outline'}
                  size={16}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.infoValue, { color: colors.primary, fontWeight: '700' }]}>
              {(salon as any)?.salon_code ?? '–'}
            </Text>
          </View>
          {saloncodeInfo && (
            <Text style={styles.hint}>
              Die Mitarbeiter-Anmeldung läuft in zwei Schritten: zuerst geben sie diesen Saloncode ein,
              danach ihren eigenen 6-stelligen PIN. Beide Schritte sind nötig — der Saloncode allein
              genügt nicht.
            </Text>
          )}
          <Text style={styles.hint}>
            Mit dem Saloncode können sich Ihre Mitarbeiter in der App anmelden.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rechtliches</Text>
          {[
            { label: 'Impressum', path: '/legal/impressum' },
            { label: 'Datenschutzerklärung', path: '/legal/datenschutz' },
            { label: 'Nutzungsbedingungen (AGB)', path: '/legal/agb' },
          ].map((item) => (
            <TouchableOpacity
              key={item.path}
              style={styles.legalRow}
              onPress={() => router.push(item.path as any)}
            >
              <Text style={styles.legalLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hilfe</Text>
          <TouchableOpacity
            style={styles.legalRow}
            onPress={() => router.push('/onboarding?replay=1' as any)}
          >
            <Text style={styles.legalLabel}>Tutorial erneut ansehen</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Konto</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.dangerText}>Abmelden</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, ...layout.contentWidth },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  label: { fontSize: 13, color: colors.textMuted },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: { backgroundColor: colors.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { fontSize: 14, color: colors.textMuted },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  legalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  legalLabel: { fontSize: 15, color: colors.textLight },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 4 },
  dangerText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { fontSize: 17, fontWeight: '700', color: colors.text },
  profileRole: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  profileHint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});

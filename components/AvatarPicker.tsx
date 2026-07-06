import { useState } from 'react';
import {
  View, Image, TouchableOpacity, Text,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/utils/theme';

interface Props {
  size?: number;
  userId?: string;
  avatarUrl?: string | null;
  fullName?: string;
  readOnly?: boolean;
  onUploaded?: (url: string) => void;
}

export default function AvatarPicker({
  size = 72,
  userId,
  avatarUrl,
  fullName,
  readOnly = false,
  onUploaded,
}: Props) {
  const { profile, setProfile } = useAuthStore();
  const [uploading, setUploading] = useState(false);

  const resolvedUserId = userId ?? profile?.id;
  const resolvedUrl = avatarUrl !== undefined ? avatarUrl : profile?.avatar_url;
  const resolvedName = fullName ?? profile?.full_name ?? '';

  const initials = resolvedName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  async function pickAndUpload() {
    if (readOnly || !resolvedUserId) return;

    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const fileName = `${resolvedUserId}.jpg`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const url = `${publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: url }).eq('id', resolvedUserId);

      if (!userId && profile) {
        setProfile({ ...profile, avatar_url: url });
      }
      onUploaded?.(url);
    } catch (e) {
      console.error('Avatar upload error:', e);
    } finally {
      setUploading(false);
    }
  }

  const radius = size / 2;

  return (
    <TouchableOpacity
      onPress={pickAndUpload}
      disabled={readOnly || uploading}
      activeOpacity={readOnly ? 1 : 0.8}
      style={[styles.wrap, { width: size, height: size, borderRadius: radius }]}
    >
      {resolvedUrl ? (
        <Image
          source={{ uri: resolvedUrl }}
          style={{ width: size, height: size, borderRadius: radius }}
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius }]}>
          <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
        </View>
      )}

      {uploading && (
        <View style={[styles.overlay, { borderRadius: radius }]}>
          <ActivityIndicator color="#fff" size="small" />
        </View>
      )}

      {!readOnly && !uploading && (
        <View style={styles.badge}>
          <Ionicons name="camera" size={10} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  placeholder: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.primary,
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
});

import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/utils/theme';
import { OWNER_ONBOARDING_SLIDES, EMPLOYEE_ONBOARDING_SLIDES } from '@/utils/onboardingContent';

export default function OnboardingScreen() {
  const { profile } = useAuthStore();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === '1';
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const slides = profile?.role === 'owner' ? OWNER_ONBOARDING_SLIDES : EMPLOYEE_ONBOARDING_SLIDES;
  const isLast = index === slides.length - 1;

  function goTo(i: number) {
    setIndex(i);
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  }

  async function finish() {
    if (isReplay) {
      router.back();
      return;
    }
    if (profile) {
      await supabase.from('profiles').update({ has_seen_onboarding: true }).eq('id', profile.id);
      useAuthStore.getState().setProfile({ ...profile, has_seen_onboarding: true });
    }
    router.replace(profile?.role === 'owner' ? '/(owner)' : '/(employee)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={finish} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.skipText}>Überspringen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      >
        {slides.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.iconWrap}>
              <Ionicons name={slide.icon as any} size={56} color={colors.primary} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => goTo(index - 1)}
          disabled={index === 0}
          style={[styles.navBtn, index === 0 && styles.navBtnHidden]}
        >
          <Text style={styles.navBtnText}>Zurück</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => (isLast ? finish() : goTo(index + 1))}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>{isLast ? 'Fertig' : 'Weiter'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topRow: { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8 },
  skipText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: colors.textLight, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  navBtn: { padding: 12 },
  navBtnHidden: { opacity: 0 },
  navBtnText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

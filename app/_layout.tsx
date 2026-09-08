import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Profile, Salon } from '@/lib/types';

export default function RootLayout() {
  const { setSession, setProfile, setSalon, setReady, clear } = useAuthStore();

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount — no need to also call getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session) {
          await loadProfile(session.user.id);
        } else {
          clear();
        }
        setReady(true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<Profile>();

    if (!profile) {
      // Don't sign out here — would race with a concurrent registration flow.
      // Just clear Zustand state; index.tsx will redirect to login.
      clear();
      return;
    }
    setProfile(profile);

    const { data: salon } = await supabase
      .from('salons')
      .select('*')
      .eq('id', profile.salon_id)
      .single<Salon>();

    if (salon) setSalon(salon);
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}

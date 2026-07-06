import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const { session, profile, ready } = useAuthStore();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1423', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#96705B" size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (profile && !profile.has_seen_onboarding) return <Redirect href={'/onboarding' as any} />;
  if (profile?.role === 'owner') return <Redirect href="/(owner)" />;
  return <Redirect href="/(employee)" />;
}

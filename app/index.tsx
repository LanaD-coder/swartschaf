import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/utils/theme';

export default function Index() {
  const { session, profile, ready } = useAuthStore();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  // Security-critical gate first: an employee logging in with the owner-set initial PIN
  // must set their own before reaching anything else — even before onboarding.
  if (profile?.role === 'employee' && profile.must_reset_pin) return <Redirect href={'/reset-pin' as any} />;
  if (profile && !profile.has_seen_onboarding) return <Redirect href={'/onboarding' as any} />;
  if (profile?.role === 'owner') return <Redirect href="/(owner)" />;
  return <Redirect href="/(employee)" />;
}

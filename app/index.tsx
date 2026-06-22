import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const { session, profile } = useAuthStore();

  if (!session) return <Redirect href="/(auth)/login" />;
  if (profile?.role === 'owner') return <Redirect href="/(owner)" />;
  return <Redirect href="/(employee)" />;
}

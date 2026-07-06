import { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/utils/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin() {
    setErrorMsg(null);
    if (!email || !password) {
      setErrorMsg('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
        setErrorMsg('E-Mail oder Passwort ist falsch.');
      } else if (error.message.includes('Email not confirmed')) {
        setErrorMsg('Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.');
      } else {
        setErrorMsg(error.message);
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Image
          source={require('../../assets/logo512x512.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.logo}>SwartSchaf</Text>
        <Text style={styles.slogan}>Zeit für das schwarze Schaf.</Text>
        <Text style={styles.subtitle}>Salonverwaltung & Zeiterfassung</Text>

        <TextInput
          style={styles.input}
          placeholder="E-Mail"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Passwort"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Anmelden...' : 'Anmelden'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/employee-pin')}>
          <Text style={styles.link}>Mitarbeiter-Anmeldung (PIN)</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.link}>Noch kein Konto? Jetzt registrieren</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 28,
    gap: 14,
  },
  logoImage: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 4,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: -1,
  },
  slogan: {
    fontSize: 18,
    fontWeight: '300',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    color: colors.primary,
    textAlign: 'center',
    fontSize: 14,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: '#3D1A1A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
});

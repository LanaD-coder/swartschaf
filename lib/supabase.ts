import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Was `Platform.OS === 'web'`. This makes GoTrueClient parse the URL on load for
    // OAuth/magic-link/password-reset tokens and call setSession() with whatever it
    // finds — replacing the current session. Nothing in this app uses that flow (no
    // OAuth, no password-reset screen, email confirmation is off), so it was dead
    // weight that added a whole class of URL-parsing-triggered session replacement
    // for no benefit. Disabled 2026-09-08 while investigating the owner-session-
    // invalidation bug (see CLAUDE.md's Known Issues) — a plausible contributing
    // factor, not a confirmed root cause; needs live verification.
    detectSessionInUrl: false,
  },
});

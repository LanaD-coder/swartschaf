import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { Profile, Salon } from '@/lib/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  salon: Salon | null;
  ready: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setSalon: (salon: Salon | null) => void;
  setReady: (ready: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  salon: null,
  ready: false,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setSalon: (salon) => set({ salon }),
  setReady: (ready) => set({ ready }),
  clear: () => set({ session: null, profile: null, salon: null, ready: true }),
}));

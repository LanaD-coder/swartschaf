import { create } from 'zustand';
import { Appointment } from '@/lib/types';

interface AppointmentState {
  appointments: Appointment[];
  setAppointments: (appointments: Appointment[]) => void;
  upsertAppointment: (appointment: Appointment) => void;
  removeAppointment: (id: string) => void;
}

export const useAppointmentStore = create<AppointmentState>((set) => ({
  appointments: [],
  setAppointments: (appointments) => set({ appointments }),
  upsertAppointment: (appointment) =>
    set((state) => {
      const idx = state.appointments.findIndex((a) => a.id === appointment.id);
      if (idx === -1) return { appointments: [...state.appointments, appointment] };
      const updated = [...state.appointments];
      updated[idx] = appointment;
      return { appointments: updated };
    }),
  removeAppointment: (id) =>
    set((state) => ({
      appointments: state.appointments.filter((a) => a.id !== id),
    })),
}));

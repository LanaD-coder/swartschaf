import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/lib/types';
import { useAuthStore } from '@/store/authStore';

export function useActiveAppointments() {
  const { profile } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('appointments')
      .select('*, service_category:service_categories(*)')
      .eq('assigned_to', profile.id)
      .gte('scheduled_start', today.toISOString())
      .lt('scheduled_start', new Date(today.getTime() + 86400000).toISOString())
      .order('scheduled_start', { ascending: true });

    setAppointments((data as Appointment[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('appointments-employee')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function startTimer(appointmentId: string) {
    const now = new Date().toISOString();
    await supabase
      .from('appointments')
      .update({ actual_start: now, status: 'in_progress' })
      .eq('id', appointmentId);
    await load();
  }

  async function stopTimer(appointmentId: string) {
    const now = new Date().toISOString();
    await supabase
      .from('appointments')
      .update({ actual_end: now, status: 'completed' })
      .eq('id', appointmentId);
    await load();
  }

  async function startWalkIn(categoryId: string, categoryName: string) {
    if (!profile) return;
    const now = new Date().toISOString();
    const end = new Date(Date.now() + 3600000).toISOString(); // +1h placeholder
    await supabase.from('appointments').insert({
      salon_id: profile.salon_id,
      assigned_to: profile.id,
      client_name: 'Laufkunde',
      service_category_id: categoryId,
      scheduled_start: now,
      scheduled_end: end,
      actual_start: now,
      customer_type: 'walkin',
      status: 'in_progress',
      created_by: profile.id,
    });
    await load();
  }

  const active = appointments.filter((a) => a.status === 'in_progress');
  const upcoming = appointments.filter((a) => a.status === 'scheduled');
  const completed = appointments.filter((a) => a.status === 'completed');

  return { appointments, active, upcoming, completed, loading, startTimer, stopTimer, startWalkIn, reload: load };
}

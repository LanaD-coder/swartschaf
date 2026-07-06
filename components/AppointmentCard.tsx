import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Appointment } from '@/lib/types';
import { formatTime, formatElapsed } from '@/utils/dateFormat';
import { colors } from '@/utils/theme';

interface Props {
  appointment: Appointment;
  onStart: () => void;
  onStop: () => void;
  onCorrection?: () => void;
}

export default function AppointmentCard({ appointment, onStart, onStop, onCorrection }: Props) {
  const isActive = appointment.status === 'in_progress';
  const isDone = appointment.status === 'completed';
  const isWalkin = appointment.customer_type === 'walkin';

  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!isActive || !appointment.actual_start) return;
    const interval = setInterval(() => {
      setElapsed(formatElapsed(appointment.actual_start!));
    }, 1000);
    setElapsed(formatElapsed(appointment.actual_start));
    return () => clearInterval(interval);
  }, [isActive, appointment.actual_start]);

  return (
    <View style={[
      styles.card,
      isActive && styles.cardActive,
      isWalkin && styles.cardWalkin,
      isDone && styles.cardDone,
    ]}>
      <View style={styles.header}>
        <View style={styles.clientRow}>
          {isWalkin && <View style={styles.walkinBadge}><Text style={styles.walkinBadgeText}>Laufkunde</Text></View>}
          <Text style={styles.clientName}>{appointment.client_name}</Text>
        </View>
        {!isActive && !isDone && (
          <Text style={styles.scheduledTime}>{formatTime(appointment.scheduled_start)}</Text>
        )}
        {isActive && (
          <Text style={styles.timer}>{elapsed}</Text>
        )}
        {isDone && appointment.actual_start && appointment.actual_end && (
          <Text style={styles.doneTime}>
            {formatTime(appointment.actual_start)} – {formatTime(appointment.actual_end)}
          </Text>
        )}
      </View>

      <Text style={styles.category}>
        {appointment.service_category?.name ?? 'Leistung unbekannt'}
      </Text>

      {!isDone && (
        <TouchableOpacity
          style={[styles.button, isActive ? styles.stopButton : styles.startButton]}
          onPress={isActive ? onStop : onStart}
        >
          <Text style={styles.buttonText}>
            {isActive ? 'Beenden' : 'Starten'}
          </Text>
        </TouchableOpacity>
      )}

      {isDone && (
        <View style={styles.doneRow}>
          <Text style={styles.doneLabel}>✓ Abgeschlossen</Text>
        </View>
      )}
      {isDone && onCorrection && (
        <TouchableOpacity style={styles.correctionBtn} onPress={onCorrection}>
          <Text style={styles.correctionBtnText}>Zeitkorrektur beantragen</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardActive: {
    borderColor: colors.success,
    backgroundColor: colors.timerBg,
  },
  cardWalkin: {
    borderColor: colors.walkin,
    backgroundColor: colors.walkinBg,
  },
  cardDone: {
    borderColor: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  clientName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  walkinBadge: {
    backgroundColor: colors.walkin,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  walkinBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  scheduledTime: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500',
  },
  timer: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  doneTime: {
    fontSize: 13,
    color: colors.textMuted,
  },
  category: {
    fontSize: 13,
    color: colors.textMuted,
  },
  button: {
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  startButton: {
    backgroundColor: colors.primary,
  },
  stopButton: {
    backgroundColor: colors.success,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  doneRow: {
    paddingVertical: 2,
  },
  doneLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  correctionBtn: {
    borderRadius: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: 'center',
  },
  correctionBtnText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
  },
});

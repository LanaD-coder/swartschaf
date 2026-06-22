import { Appointment } from '@/lib/types';
import { minutesBetween } from './dateFormat';

export type ComplianceLevel = 'ok' | 'warning' | 'critical';

export interface ComplianceAlert {
  level: ComplianceLevel;
  message: string;
}

// AZG §3: max 8h/day, extendable to 10h
// AZG §4: 30-min break after 6h, 45-min after 9h
// AZG §5: min 11h rest between shifts

export function checkDailyCompliance(
  completedToday: Appointment[],
  activeCount: number
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];

  const totalMinutes = completedToday.reduce((sum, a) => {
    if (!a.actual_start || !a.actual_end) return sum;
    return sum + minutesBetween(a.actual_start, a.actual_end);
  }, 0);

  const totalHours = totalMinutes / 60;

  if (totalHours >= 9) {
    alerts.push({
      level: 'critical',
      message: 'Über 9 Stunden Arbeitszeit – 45 Minuten Pause vorgeschrieben (AZG §4)',
    });
  } else if (totalHours >= 6) {
    alerts.push({
      level: 'warning',
      message: 'Über 6 Stunden Arbeitszeit – 30 Minuten Pause vorgeschrieben (AZG §4)',
    });
  }

  if (totalHours >= 10) {
    alerts.push({
      level: 'critical',
      message: 'Maximale Tagesarbeitszeit von 10 Stunden erreicht (AZG §3)',
    });
  }

  return alerts;
}

export function checkRestPeriod(lastEndTime: string | null): ComplianceAlert | null {
  if (!lastEndTime) return null;
  const hoursSinceLast =
    (new Date().getTime() - new Date(lastEndTime).getTime()) / 3600000;
  if (hoursSinceLast < 11) {
    const remaining = Math.ceil(11 - hoursSinceLast);
    return {
      level: 'warning',
      message: `Ruhezeit nicht eingehalten – letzte Schicht endete vor weniger als 11 Stunden (noch ${remaining}h Ruhezeit erforderlich, AZG §5)`,
    };
  }
  return null;
}

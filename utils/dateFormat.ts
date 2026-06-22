import { format, formatDuration, intervalToDuration } from 'date-fns';
import { de } from 'date-fns/locale';

export const formatDate = (date: string | Date) =>
  format(new Date(date), 'dd.MM.yyyy', { locale: de });

export const formatTime = (date: string | Date) =>
  format(new Date(date), 'HH:mm', { locale: de });

export const formatDateTime = (date: string | Date) =>
  format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: de });

export const formatDayName = (date: string | Date) =>
  format(new Date(date), 'EEEE, dd. MMMM yyyy', { locale: de });

export const formatMonthYear = (date: string | Date) =>
  format(new Date(date), 'MMMM yyyy', { locale: de });

export function formatDurationHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')} h`;
}

export function formatElapsed(startIso: string): string {
  const start = new Date(startIso);
  const now = new Date();
  const totalSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

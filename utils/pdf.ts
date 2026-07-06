import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Appointment, Profile, Salon } from '@/lib/types';
import { formatDate, formatTime, formatDurationHHMM, minutesBetween } from './dateFormat';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export interface ApprovedCorrection {
  resolved_at: string;
  reason: string;
  original_data: { actual_start?: string; actual_end?: string };
  requested_data: { actual_start?: string; actual_end?: string };
  appointment: { client_name: string; service_category?: { name: string } };
}

export interface ReportBreak {
  break_type: 'lunch' | 'coffee' | 'sick' | 'day_off';
  started_at: string;
  ended_at: string | null;
}

const BREAK_LABELS: Record<string, string> = {
  lunch:   'Mittagspause',
  coffee:  'Kaffeepause',
  sick:    'Krank',
  day_off: 'Frei / Urlaub',
};

export async function generateAndShareReport(
  appointments: Appointment[],
  employee: Profile,
  salon: Salon,
  periodLabel: string,
  corrections: ApprovedCorrection[] = [],
  breaks: ReportBreak[] = []
) {
  const completed = appointments.filter(
    (a) => a.status === 'completed' && a.actual_start && a.actual_end
  );

  const totalMinutes = completed.reduce((sum, a) => {
    return sum + minutesBetween(a.actual_start!, a.actual_end!);
  }, 0);

  // Split breaks into working breaks vs absence days
  const workBreaks = breaks.filter((b) => (b.break_type === 'lunch' || b.break_type === 'coffee') && b.ended_at);
  const absences   = breaks.filter((b) => b.break_type === 'sick' || b.break_type === 'day_off');

  const breakMinutes = workBreaks.reduce((sum, b) => {
    return sum + minutesBetween(b.started_at, b.ended_at!);
  }, 0);

  const sickDays  = new Set(absences.filter((b) => b.break_type === 'sick').map((b) => b.started_at.slice(0, 10))).size;
  const offDays   = new Set(absences.filter((b) => b.break_type === 'day_off').map((b) => b.started_at.slice(0, 10))).size;

  const apptRows = completed.map((a) => {
    const mins = minutesBetween(a.actual_start!, a.actual_end!);
    return `
    <tr>
      <td>${formatDate(a.actual_start!)}</td>
      <td>${a.client_name}${a.customer_type === 'walkin' ? ' <span class="badge">Laufkunde</span>' : ''}</td>
      <td>${formatTime(a.actual_start!)}</td>
      <td>${formatTime(a.actual_end!)}</td>
      <td>${formatDurationHHMM(mins)}</td>
      <td>${(a.service_category as any)?.name ?? '–'}</td>
      <td>${a.notes ?? ''}</td>
    </tr>`;
  }).join('');

  const breakRows = workBreaks.map((b) => {
    const mins = minutesBetween(b.started_at, b.ended_at!);
    return `
    <tr>
      <td>${formatDate(b.started_at)}</td>
      <td>${BREAK_LABELS[b.break_type]}</td>
      <td>${formatTime(b.started_at)}</td>
      <td>${formatTime(b.ended_at!)}</td>
      <td>${formatDurationHHMM(mins)}</td>
    </tr>`;
  }).join('');

  const absenceRows = absences.map((b) => `
    <tr>
      <td>${formatDate(b.started_at)}</td>
      <td>${BREAK_LABELS[b.break_type]}</td>
      <td>${b.ended_at ? `${formatTime(b.started_at)} – ${formatTime(b.ended_at)}` : 'Ganzer Tag'}</td>
    </tr>`).join('');

  const correctionRows = corrections.map((c) => `
    <tr>
      <td>${c.resolved_at ? formatDate(c.resolved_at) : '–'}</td>
      <td>${c.appointment?.client_name ?? '–'}</td>
      <td>${(c.appointment?.service_category as any)?.name ?? '–'}</td>
      <td>${c.original_data?.actual_start ? formatTime(c.original_data.actual_start) : '–'} – ${c.original_data?.actual_end ? formatTime(c.original_data.actual_end) : '–'}</td>
      <td><span class="corr-badge">✓</span> ${c.requested_data?.actual_start ?? '–'} – ${c.requested_data?.actual_end ?? '–'}</td>
      <td>${c.reason ?? ''}</td>
    </tr>`).join('');

  const now = new Date();

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 40px; }
    h1 { font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 2px; margin-bottom: 4px; }
    .meta { display: flex; justify-content: space-between; margin: 16px 0; }
    .meta-block { line-height: 1.8; }
    .meta-block strong { display: inline-block; width: 130px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #1a1a2e; color: #fff; padding: 8px 6px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 7px 6px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .badge    { background: #9b59b6; color: #fff; border-radius: 3px; padding: 1px 4px; font-size: 9px; }
    .corr-badge { background: #c9a96a; color: #fff; border-radius: 3px; padding: 1px 5px; font-size: 9px; }
    .total-row td { font-weight: bold; border-top: 2px solid #111; background: #f0f0f0; }
    .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-top: 32px; margin-bottom: 4px; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .summary-box { margin-top: 28px; border: 1px solid #ccc; border-radius: 6px; padding: 14px 18px; background: #f8f8f8; }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
    .summary-row.total { font-weight: bold; font-size: 13px; border-top: 1px solid #bbb; margin-top: 6px; padding-top: 8px; }
    .summary-label { color: #555; }
    .summary-value { font-weight: 600; }
    .absence-note { font-size: 10px; color: #888; margin-top: 4px; font-style: italic; }
    .signatures { display: flex; gap: 60px; margin-top: 50px; }
    .sig-block { flex: 1; }
    .sig-line { border-top: 1px solid #111; margin-top: 40px; padding-top: 6px; font-size: 10px; color: #555; }
    .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #888; }
  </style>
</head>
<body>
  <h1>ARBEITSZEITNACHWEIS</h1>

  <div class="meta">
    <div class="meta-block">
      <div><strong>Betrieb:</strong> ${salon.name}</div>
      <div><strong>Steuernummer:</strong> ${salon.steuernummer || '–'}</div>
      <div><strong>Adresse:</strong> ${salon.address || '–'}</div>
    </div>
    <div class="meta-block">
      <div><strong>Mitarbeiter:</strong> ${employee.full_name}</div>
      <div><strong>Zeitraum:</strong> ${periodLabel}</div>
    </div>
  </div>

  <!-- Appointments -->
  <div class="section-title">Termine &amp; Dienstleistungen</div>
  <table>
    <thead>
      <tr>
        <th>Datum</th><th>Kunde</th><th>Beginn</th><th>Ende</th>
        <th>Dauer</th><th>Leistung</th><th>Notiz</th>
      </tr>
    </thead>
    <tbody>
      ${apptRows || '<tr><td colspan="7" style="color:#888;text-align:center">Keine Termine</td></tr>'}
      <tr class="total-row">
        <td colspan="4">Terminzeit gesamt</td>
        <td>${formatDurationHHMM(totalMinutes)}</td>
        <td colspan="2">${completed.length} Termin${completed.length !== 1 ? 'e' : ''}</td>
      </tr>
    </tbody>
  </table>

  <!-- Working breaks -->
  ${workBreaks.length > 0 ? `
  <div class="section-title">Pausen</div>
  <table>
    <thead>
      <tr><th>Datum</th><th>Art</th><th>Beginn</th><th>Ende</th><th>Dauer</th></tr>
    </thead>
    <tbody>
      ${breakRows}
      <tr class="total-row">
        <td colspan="4">Pausenzeit gesamt</td>
        <td>${formatDurationHHMM(breakMinutes)}</td>
      </tr>
    </tbody>
  </table>` : ''}

  <!-- Absences (sick / day off) -->
  ${absences.length > 0 ? `
  <div class="section-title">Abwesenheiten (Krank / Urlaub)</div>
  <table>
    <thead>
      <tr><th>Datum</th><th>Art</th><th>Zeitraum</th></tr>
    </thead>
    <tbody>
      ${absenceRows}
    </tbody>
  </table>
  <p class="absence-note">Abwesenheitstage sind nicht in der Terminzeit enthalten.</p>` : ''}

  <!-- Approved corrections -->
  ${corrections.length > 0 ? `
  <div class="section-title">Genehmigte Korrekturen</div>
  <table>
    <thead>
      <tr><th>Datum</th><th>Kunde</th><th>Leistung</th><th>Original</th><th>Korrigiert</th><th>Begründung</th></tr>
    </thead>
    <tbody>${correctionRows}</tbody>
  </table>` : ''}

  <!-- Summary -->
  <div class="summary-box">
    <div class="summary-row"><span class="summary-label">Terminzeit (Dienstleistungen)</span><span class="summary-value">${formatDurationHHMM(totalMinutes)}</span></div>
    ${workBreaks.length > 0 ? `<div class="summary-row"><span class="summary-label">Pausenzeit (Mittagspause / Kaffeepause)</span><span class="summary-value">${formatDurationHHMM(breakMinutes)}</span></div>` : ''}
    ${sickDays  > 0 ? `<div class="summary-row"><span class="summary-label">Krankheitstage</span><span class="summary-value">${sickDays} Tag${sickDays !== 1 ? 'e' : ''}</span></div>` : ''}
    ${offDays   > 0 ? `<div class="summary-row"><span class="summary-label">Urlaubs- / Freitag${offDays !== 1 ? 'e' : ''}</span><span class="summary-value">${offDays} Tag${offDays !== 1 ? 'e' : ''}</span></div>` : ''}
    <div class="summary-row total"><span class="summary-label">Gesamte Dienstleistungszeit</span><span class="summary-value">${formatDurationHHMM(totalMinutes)}</span></div>
  </div>

  <div class="signatures">
    <div class="sig-block"><div class="sig-line">Unterschrift Arbeitgeber &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Datum</div></div>
    <div class="sig-block"><div class="sig-line">Unterschrift Arbeitnehmer &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Datum</div></div>
  </div>

  <div class="footer">
    Erstellt am ${format(now, 'dd.MM.yyyy HH:mm', { locale: de })} – GoBD-konform archiviert – swartschaf.de
  </div>
</body>
</html>`;

  if (Platform.OS === 'web') {
    const win = (window as any).open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  } else {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Arbeitszeitnachweis ${employee.full_name}`,
      });
    }
  }
}

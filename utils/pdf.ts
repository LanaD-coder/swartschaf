import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Appointment, Profile, Salon } from '@/lib/types';
import { formatDate, formatTime, formatDurationHHMM, minutesBetween } from './dateFormat';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export async function generateAndShareReport(
  appointments: Appointment[],
  employee: Profile,
  salon: Salon,
  periodLabel: string
) {
  const completed = appointments.filter(
    (a) => a.status === 'completed' && a.actual_start && a.actual_end
  );

  const totalMinutes = completed.reduce((sum, a) => {
    return sum + minutesBetween(a.actual_start!, a.actual_end!);
  }, 0);

  const rows = completed
    .map((a) => {
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
    })
    .join('');

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
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #1a1a2e; color: #fff; padding: 8px 6px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 7px 6px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .badge { background: #9b59b6; color: #fff; border-radius: 3px; padding: 1px 4px; font-size: 9px; }
    .total-row td { font-weight: bold; border-top: 2px solid #111; background: #f0f0f0; }
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
      <div><strong>Gesamtstunden:</strong> <strong>${formatDurationHHMM(totalMinutes)}</strong></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Datum</th>
        <th>Kunde</th>
        <th>Beginn</th>
        <th>Ende</th>
        <th>Dauer</th>
        <th>Leistung</th>
        <th>Notiz</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="4">Gesamt</td>
        <td>${formatDurationHHMM(totalMinutes)}</td>
        <td colspan="2">${completed.length} Termine</td>
      </tr>
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-line">Unterschrift Arbeitgeber &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Datum</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">Unterschrift Arbeitnehmer &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Datum</div>
    </div>
  </div>

  <div class="footer">
    Erstellt am ${format(now, 'dd.MM.yyyy HH:mm', { locale: de })} – GoBD-konform archiviert – swartschaf.de
  </div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Arbeitszeitnachweis ${employee.full_name}`,
    });
  }
}

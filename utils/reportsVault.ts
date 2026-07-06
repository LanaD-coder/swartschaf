import { Platform, Linking } from 'react-native';
// SDK 56 moved the classic path/download API behind a `/legacy` subpath
// (the new default export uses File/Directory classes instead).
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { GeneratedReport } from '@/lib/types';

interface ArchiveReportArgs {
  uri: string;
  salonId: string;
  employeeId: string;
  generatedBy: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
}

export async function archiveReport(args: ArchiveReportArgs): Promise<void> {
  try {
    const { uri, salonId, employeeId, generatedBy, periodLabel, periodStart, periodEnd } = args;
    const path = `${salonId}/${employeeId}/${Date.now()}.pdf`;

    const response = await fetch(uri);
    const blob = await response.blob();

    const { error: uploadErr } = await supabase.storage
      .from('reports')
      .upload(path, blob, { contentType: 'application/pdf' });
    if (uploadErr) throw uploadErr;

    const { error: insertErr } = await supabase.from('generated_reports').insert({
      salon_id: salonId,
      employee_id: employeeId,
      generated_by: generatedBy,
      period_label: periodLabel,
      period_start: periodStart,
      period_end: periodEnd,
      file_path: path,
      file_size_bytes: blob.size,
    });
    if (insertErr) throw insertErr;
  } catch (e) {
    // Archiving is a best-effort side effect — the owner's share/print already
    // succeeded, so a vault write failure shouldn't surface as a user-facing error.
    console.error('Report archiving failed:', e);
  }
}

export async function listVaultReports(salonId: string): Promise<GeneratedReport[]> {
  const { data } = await supabase
    .from('generated_reports')
    .select('*, employee:profiles!employee_id(full_name, color)')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false });
  return (data as GeneratedReport[]) ?? [];
}

export async function shareVaultReport(report: GeneratedReport): Promise<void> {
  const { data, error } = await supabase.storage
    .from('reports')
    .createSignedUrl(report.file_path, 300);
  if (error || !data?.signedUrl) throw error ?? new Error('Kein Link erhalten');

  if (Platform.OS === 'web') {
    await Linking.openURL(data.signedUrl);
    return;
  }

  const fileName = report.file_path.split('/').pop() ?? `bericht-${report.id}.pdf`;
  const localUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.downloadAsync(data.signedUrl, localUri);
  await Sharing.shareAsync(localUri, { mimeType: 'application/pdf' });
}

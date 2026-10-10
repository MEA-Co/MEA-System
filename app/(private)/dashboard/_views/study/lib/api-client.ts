import { createClient } from '@/lib/supabase/client';

import type { Activity } from './fields';
import { type ActivityRow, fromRow, REPORT_BUCKET } from './storage-model';

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      body?.error ?? '서버 요청에 실패했습니다. 다시 시도해 주세요.',
    );
  return body as T;
}
export async function loadActivities() {
  const { activities } = await request<{ activities: ActivityRow[] }>(
    '/api/study',
  );
  return activities.map(fromRow);
}
export async function confirmActivity(
  userId: string,
  activity: Activity,
  saveId: string,
) {
  const client = createClient();
  const reports = [];
  for (const report of activity.reports ?? []) {
    const { file, ...metadata } = report;
    if (report.path) {
      reports.push({ ...metadata, path: report.path });
      continue;
    }
    if (!file)
      throw new Error(
        `${report.name}: 임시저장한 파일을 찾을 수 없습니다. 삭제 후 다시 첨부해 주세요.`,
      );
    const extension = report.name.split('.').pop()!.toLowerCase();
    const path = `${userId}/${activity.clientKey}/${report.clientKey}.${extension}`;
    const { error } = await client.storage
      .from(REPORT_BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });
    if (error) {
      // A previous uncertain attempt may have uploaded this immutable path already.
      const existing = await client.storage.from(REPORT_BUCKET).info(path);
      if (existing.error || Number(existing.data.size) !== report.size)
        throw new Error(
          `${report.name} 업로드에 실패했습니다. 연결 상태와 파일 저장소 설정을 확인한 뒤 다시 시도해 주세요.`,
        );
    }
    reports.push({ ...metadata, path });
  }
  const { activity: row } = await request<{ activity: ActivityRow }>(
    `/api/study/${activity.clientKey}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        id: activity.clientKey,
        expectedRevision: activity.revision,
        saveId,
        values: activity.values,
        reports,
      }),
    },
  );
  return fromRow(row);
}
export async function deleteActivity(activity: Activity) {
  return request<{ ok: boolean; cleanupPending: boolean }>(
    `/api/study/${activity.clientKey}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ expectedRevision: activity.revision }),
    },
  );
}
export async function downloadReport(activityId: string, reportId: string) {
  const { url } = await request<{ url: string }>(
    `/api/study/${activityId}/files/${reportId}`,
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

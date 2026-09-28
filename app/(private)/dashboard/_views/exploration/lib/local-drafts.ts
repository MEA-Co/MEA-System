import type { Activity, ActivityReport } from './fields';
import { hasInput, localActivitySchema } from './storage-model';

const scope = (userId: string) =>
  `mea:exploration:v1:${process.env.NEXT_PUBLIC_SUPABASE_URL}:${userId}:`;
const blobKey = (userId: string, activityId: string, reportId: string) =>
  `${scope(userId)}${activityId}:${reportId}`;

function openFiles(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mea-exploration-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error('첨부 파일을 임시저장할 공간에 접근할 수 없습니다.'));
    request.onblocked = () =>
      reject(new Error('다른 탭을 닫은 뒤 다시 저장해 주세요.'));
  });
}
async function fileOperation<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openFiles();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const request = action(tx.objectStore('files'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            '첨부 파일 임시저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.',
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function restoreFiles(
  userId: string,
  activity: Activity,
): Promise<Activity> {
  const reports = await Promise.all(
    (activity.reports ?? []).map(async (report) => {
      if (report.path || report.file) return report;
      const file = await fileOperation<File | undefined>('readonly', (store) =>
        store.get(blobKey(userId, activity.clientKey, report.clientKey)),
      );
      return { ...report, file };
    }),
  );
  return { ...activity, reports };
}
export function readDrafts(userId: string): Activity[] {
  const prefix = scope(userId);
  const drafts: Activity[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const parsed = localActivitySchema.safeParse(
      JSON.parse(localStorage.getItem(key)!),
    );
    if (!parsed.success)
      throw new Error(
        '임시저장 데이터 형식을 읽을 수 없습니다. 브라우저 데이터를 지우지 말고 복구를 요청해 주세요.',
      );
    drafts.push(parsed.data);
  }
  return drafts;
}
async function withDraftLock<T>(
  userId: string,
  id: string,
  run: () => Promise<T>,
): Promise<T> {
  return navigator.locks
    ? navigator.locks.request(`${scope(userId)}${id}`, run)
    : run();
}
function checkVersion(userId: string, activity: Activity) {
  const raw = localStorage.getItem(`${scope(userId)}${activity.clientKey}`);
  const current = raw ? localActivitySchema.parse(JSON.parse(raw)) : null;
  if ((current?.localVersion ?? undefined) !== activity.localVersion)
    throw new Error(
      '다른 탭에서 임시저장이 변경되었습니다. 입력 내용은 유지됩니다. 목록에서 최신 임시저장을 확인해 주세요.',
    );
}
export async function saveDraft(
  userId: string,
  activity: Activity,
): Promise<Activity> {
  if (!hasInput(activity)) throw new Error('항목을 하나 이상 입력해 주세요.');
  return withDraftLock(userId, activity.clientKey, async () => {
    checkVersion(userId, activity);
    const reports = (activity.reports ?? []).map(
      ({ file: _file, ...report }) => report,
    );
    const saved = localActivitySchema.parse({
      ...activity,
      status: 'draft',
      reports,
      updatedAt: new Date().toISOString(),
      localVersion: crypto.randomUUID(),
    });
    for (const report of activity.reports ?? []) {
      if (report.file && !report.path)
        await fileOperation('readwrite', (store) =>
          store.put(
            report.file,
            blobKey(userId, activity.clientKey, report.clientKey),
          ),
        );
    }
    checkVersion(userId, activity);
    // Only publish the draft after all file transactions commit. Quota failures preserve the old draft.
    try {
      localStorage.setItem(
        `${scope(userId)}${activity.clientKey}`,
        JSON.stringify(saved),
      );
    } catch {
      throw new Error(
        '브라우저 임시저장 공간이 부족하거나 저장이 차단되었습니다. 입력 내용은 유지됩니다.',
      );
    }
    return { ...saved, reports: activity.reports ?? [] };
  });
}
export async function removeDraft(userId: string, activity: Activity) {
  return withDraftLock(userId, activity.clientKey, async () => {
    checkVersion(userId, activity);
    localStorage.removeItem(`${scope(userId)}${activity.clientKey}`);
    // Garbage collection is best effort; never report a successful DB confirmation as failed.
    await Promise.allSettled(
      (activity.reports ?? []).map((report: ActivityReport) =>
        fileOperation('readwrite', (store) =>
          store.delete(blobKey(userId, activity.clientKey, report.clientKey)),
        ),
      ),
    );
  });
}

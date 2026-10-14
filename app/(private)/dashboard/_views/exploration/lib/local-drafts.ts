import type { Exploration } from '@/lib/exploration/fields';
import {
  hasInput,
  localExplorationSchema,
} from '@/lib/exploration/storage-model';

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
// Sweep only under the same cross-tab lock used by every draft writer.
// Without Web Locks another tab may have written blobs but not its manifest yet.
async function pruneFiles(userId: string, id: string) {
  if (!navigator.locks) return;
  const raw = localStorage.getItem(`${scope(userId)}${id}`);
  const current = raw ? localExplorationSchema.parse(JSON.parse(raw)) : null;
  const keep = new Set(
    (current?.reports ?? [])
      .filter((r) => !r.path)
      .map((r) => blobKey(userId, id, r.clientKey)),
  );
  const prefix = `${scope(userId)}${id}:`;
  const db = await openFiles();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const cursor = tx
        .objectStore('files')
        .openKeyCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (!entry) return;
        if (!keep.has(String(entry.key)))
          tx.objectStore('files').delete(entry.key);
        entry.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(new Error('임시 첨부 정리를 완료하지 못했습니다.'));
    });
  } finally {
    db.close();
  }
}

export async function restoreFiles(
  userId: string,
  activity: Exploration,
): Promise<Exploration> {
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
export function readDrafts(userId: string): Exploration[] {
  const prefix = scope(userId);
  const drafts: Exploration[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const parsed = localExplorationSchema.safeParse(
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
function checkVersion(userId: string, activity: Exploration) {
  const raw = localStorage.getItem(`${scope(userId)}${activity.clientKey}`);
  const current = raw ? localExplorationSchema.parse(JSON.parse(raw)) : null;
  if ((current?.localVersion ?? undefined) !== activity.localVersion)
    throw new Error(
      '다른 탭에서 임시저장이 변경되었습니다. 입력 내용은 유지됩니다. 목록에서 최신 임시저장을 확인해 주세요.',
    );
}
export async function saveDraft(
  userId: string,
  activity: Exploration,
): Promise<Exploration> {
  if (!hasInput(activity)) throw new Error('항목을 하나 이상 입력해 주세요.');
  return withDraftLock(userId, activity.clientKey, async () => {
    checkVersion(userId, activity);
    const reports = (activity.reports ?? []).map(
      ({ file: _file, ...report }) => report,
    );
    const saved = localExplorationSchema.parse({
      ...activity,
      status: 'draft',
      reports,
      updatedAt: new Date().toISOString(),
      localVersion: crypto.randomUUID(),
    });
    try {
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
    } catch (error) {
      await pruneFiles(userId, activity.clientKey).catch(() => undefined);
      throw error;
    }
    // Includes orphaned files left by older app versions. Cleanup failure never
    // turns a committed save into an error; the next save/delete retries it.
    await pruneFiles(userId, activity.clientKey).catch(() => undefined);
    return { ...saved, reports: activity.reports ?? [] };
  });
}
export async function removeDraft(userId: string, activity: Exploration) {
  return withDraftLock(userId, activity.clientKey, async () => {
    checkVersion(userId, activity);
    localStorage.removeItem(`${scope(userId)}${activity.clientKey}`);
    // Sweep the whole activity prefix, including previously removed reports.
    await pruneFiles(userId, activity.clientKey).catch(() => undefined);
  });
}

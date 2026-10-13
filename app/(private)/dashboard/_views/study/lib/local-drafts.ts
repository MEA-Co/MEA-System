import type { ReportAttachment,Study } from '@/lib/study/fields';
import { hasInput, localStudySchema } from '@/lib/study/storage-model';

const scope = (userId: string) =>
  `mea:study:v1:${process.env.NEXT_PUBLIC_SUPABASE_URL}:${userId}:`;
const blobKey = (userId: string, studyId: string, reportId: string) =>
  `${scope(userId)}${studyId}:${reportId}`;

function openFiles(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mea-study-files', 1);
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
  study: Study,
): Promise<Study> {
  const reports = await Promise.all(
    (study.reports ?? []).map(async (report) => {
      if (report.path || report.file) return report;
      const file = await fileOperation<File | undefined>('readonly', (store) =>
        store.get(blobKey(userId, study.clientKey, report.clientKey)),
      );
      return { ...report, file };
    }),
  );
  return { ...study, reports };
}
export function readDrafts(userId: string): Study[] {
  const prefix = scope(userId);
  const drafts: Study[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const parsed = localStudySchema.safeParse(
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
function checkVersion(userId: string, study: Study) {
  const raw = localStorage.getItem(`${scope(userId)}${study.clientKey}`);
  const current = raw ? localStudySchema.parse(JSON.parse(raw)) : null;
  if ((current?.localVersion ?? undefined) !== study.localVersion)
    throw new Error(
      '다른 탭에서 임시저장이 변경되었습니다. 입력 내용은 유지됩니다. 목록에서 최신 임시저장을 확인해 주세요.',
    );
}
export async function saveDraft(userId: string, study: Study): Promise<Study> {
  if (!hasInput(study)) throw new Error('항목을 하나 이상 입력해 주세요.');
  return withDraftLock(userId, study.clientKey, async () => {
    checkVersion(userId, study);
    const reports = (study.reports ?? []).map(
      ({ file: _file, ...report }) => report,
    );
    const saved = localStudySchema.parse({
      ...study,
      status: 'draft',
      reports,
      updatedAt: new Date().toISOString(),
      localVersion: crypto.randomUUID(),
    });
    for (const report of study.reports ?? []) {
      if (report.file && !report.path)
        await fileOperation('readwrite', (store) =>
          store.put(
            report.file,
            blobKey(userId, study.clientKey, report.clientKey),
          ),
        );
    }
    checkVersion(userId, study);
    // Only publish the draft after all file transactions commit. Quota failures preserve the old draft.
    try {
      localStorage.setItem(
        `${scope(userId)}${study.clientKey}`,
        JSON.stringify(saved),
      );
    } catch {
      throw new Error(
        '브라우저 임시저장 공간이 부족하거나 저장이 차단되었습니다. 입력 내용은 유지됩니다.',
      );
    }
    return { ...saved, reports: study.reports ?? [] };
  });
}
export async function removeDraft(userId: string, study: Study) {
  return withDraftLock(userId, study.clientKey, async () => {
    checkVersion(userId, study);
    localStorage.removeItem(`${scope(userId)}${study.clientKey}`);
    // Garbage collection is best effort; never report a successful DB confirmation as failed.
    await Promise.allSettled(
      (study.reports ?? []).map((report: ReportAttachment) =>
        fileOperation('readwrite', (store) =>
          store.delete(blobKey(userId, study.clientKey, report.clientKey)),
        ),
      ),
    );
  });
}

const editorKey = (userId: string) => `mea:study-editor:${scope(userId)}`;
const editorSchema = localStudySchema.extend({
  localVersion: localStudySchema.shape.localVersion.optional(),
});
export function readEditor(userId: string) {
  const raw = sessionStorage.getItem(editorKey(userId));
  if (!raw) return null;
  const data = JSON.parse(raw);
  return {
    draft: editorSchema.parse(data.draft),
    baseline: editorSchema.parse(data.baseline),
  };
}
export function writeEditor(userId: string, draft: Study, baseline: Study) {
  const serialize = (study: Study) => ({
    ...study,
    reports: (study.reports ?? []).map(({ file: _file, ...report }) => report),
  });
  sessionStorage.setItem(
    editorKey(userId),
    JSON.stringify({
      draft: serialize(draft),
      baseline: serialize(baseline),
    }),
  );
}
export function clearEditor(userId: string) {
  sessionStorage.removeItem(editorKey(userId));
}

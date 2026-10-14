import type { Exploration } from '@/lib/exploration/fields';
import { localExplorationSchema } from '@/lib/exploration/storage-model';

const sessionKey = (userId: string) =>
  `mea:exploration-editor:v1:${process.env.NEXT_PUBLIC_SUPABASE_URL}:${userId}`;
const editorSchema = localExplorationSchema.extend({
  localVersion: localExplorationSchema.shape.localVersion.optional(),
});
type Snapshot = { draft: Exploration; baseline: Exploration; fileKey: string };
type Files = Record<string, File>;
// Serialize writes/deletion so closing or confirming cannot be undone by a late write.
let pendingFiles: Promise<unknown> = Promise.resolve();
const lastFiles = new Map<string, Files>();
const fileWrites = new Map<string, Promise<unknown>>();

async function filesOperation<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('mea-exploration-editor-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = request.onblocked = () =>
      reject(new Error('작성 중 첨부 파일 보관에 실패했습니다.'));
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const request = action(tx.objectStore('files'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () =>
        reject(new Error('작성 중 첨부 파일 보관에 실패했습니다.'));
    });
  } finally {
    db.close();
  }
}
function enqueue<T>(action: () => Promise<T>): Promise<T> {
  const next = pendingFiles.catch(() => undefined).then(action);
  pendingFiles = next;
  return next;
}
function parseSnapshot(userId: string): Snapshot | null {
  const raw = sessionStorage.getItem(sessionKey(userId));
  if (!raw) return null;
  const value = JSON.parse(raw);
  const draft = editorSchema.parse(value.draft);
  const baseline = editorSchema.parse(value.baseline);
  if (
    draft.revision !== 0 ||
    baseline.revision !== 0 ||
    draft.clientKey !== baseline.clientKey ||
    (draft.ownerId && draft.ownerId !== userId) ||
    (baseline.ownerId && baseline.ownerId !== userId) ||
    typeof value.fileKey !== 'string' ||
    !value.fileKey.startsWith(`${sessionKey(userId)}:`)
  ) {
    throw new Error('작성 내용의 복원 정보를 확인할 수 없습니다.');
  }
  return { draft, baseline, fileKey: value.fileKey };
}
export async function readEditor(userId: string) {
  const saved = parseSnapshot(userId);
  if (!saved) return null;
  const files = saved.draft.reports?.some((report) => !report.path)
    ? await enqueue(() =>
        filesOperation<Files | undefined>('readonly', (store) =>
          store.get(saved.fileKey),
        ),
      ).catch(() => undefined)
    : undefined;
  return {
    draft: {
      ...saved.draft,
      reports: (saved.draft.reports ?? []).map((report) => ({
        ...report,
        file: files?.[report.clientKey],
      })),
    },
    baseline: saved.baseline,
  };
}
export function writeEditor(
  userId: string,
  draft: Exploration,
  baseline: Exploration,
): Promise<unknown> {
  const previous = parseSnapshot(userId);
  const fileKey =
    previous?.fileKey ?? `${sessionKey(userId)}:${crypto.randomUUID()}`;
  const serialize = (activity: Exploration) => ({
    ...activity,
    reports: (activity.reports ?? []).map(
      ({ file: _file, ...report }) => report,
    ),
  });
  // Text is synchronous: even a reload immediately after typing retains the last render.
  sessionStorage.setItem(
    sessionKey(userId),
    JSON.stringify({
      draft: serialize(draft),
      baseline: serialize(baseline),
      fileKey,
    }),
  );
  const files = Object.fromEntries(
    (draft.reports ?? []).flatMap((report) =>
      report.file && !report.path ? [[report.clientKey, report.file]] : [],
    ),
  );
  const last = lastFiles.get(fileKey);
  if (
    (last &&
      Object.keys(files).length === Object.keys(last).length &&
      Object.entries(files).every(([key, file]) => last[key] === file)) ||
    (!last && !Object.keys(files).length)
  )
    return fileWrites.get(fileKey) ?? Promise.resolve();
  lastFiles.set(fileKey, files);
  const writing = enqueue(() =>
    filesOperation('readwrite', (store) => store.put(files, fileKey)),
  ).catch((error) => {
    if (lastFiles.get(fileKey) === files) lastFiles.delete(fileKey);
    throw error;
  });
  fileWrites.set(fileKey, writing);
  return writing;
}
export function clearEditor(userId: string): Promise<unknown> {
  const saved = parseSnapshot(userId);
  sessionStorage.removeItem(sessionKey(userId));
  if (!saved) return Promise.resolve();
  lastFiles.delete(saved.fileKey);
  fileWrites.delete(saved.fileKey);
  return enqueue(() =>
    filesOperation('readwrite', (store) => store.delete(saved.fileKey)),
  );
}

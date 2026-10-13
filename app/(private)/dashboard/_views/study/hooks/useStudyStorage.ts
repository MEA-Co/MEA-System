'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';

import { toast } from '@/components/ui/toast';
import { emptyValues,type Study } from '@/lib/study/fields';
import {
  MAX_STUDY_VALUES_BYTES,
  STUDY_SIZE_ERROR,
  studyValuesBytes,
} from '@/lib/study/payload-size';
import {
  hasInput,
  missingFields,
  REPORT_BUCKET,
  studyFingerprint,
} from '@/lib/study/storage-model';
import { createClient } from '@/lib/supabase/client';

import { confirmStudy, deleteStudy } from '../lib/api-client';
import {
  clearEditor,
  readDrafts,
  readEditor,
  removeDraft,
  restoreFiles,
  saveDraft,
  writeEditor,
} from '../lib/local-drafts';

export function useStudyStorage(userId: string, persistCreation = false) {
  const { mutate: mutateCache } = useSWRConfig();
  const refreshReferences = () =>
    mutateCache(
      (key) =>
        Array.isArray(key) &&
        ['study-list-v1', 'study-page', 'study-summary'].includes(key[0]),
    );
  const [local, setLocal] = useState<Study[]>([]);
  const [localError, setLocalError] = useState('');
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Study | null>(null);
  const [baseline, setBaseline] = useState<Study | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const creating = useRef(false);
  const attempt = useRef<{ fingerprint: string; saveId: string } | null>(null);
  const dirty =
    !!draft &&
    (!baseline
      ? hasInput(draft)
      : studyFingerprint(draft) !== studyFingerprint(baseline));
  const refreshLocal = useCallback(() => {
    try {
      setLocal(readDrafts(userId));
      setLocalError('');
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : '임시저장을 불러오지 못했습니다.',
      );
    }
    setReady(true);
  }, [userId]);
  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (
        persistCreation &&
        new URL(window.location.href).searchParams.get('studyEditor') === 'new'
      ) {
        try {
          const saved = readEditor(userId);
          if (!cancelled) {
            creating.current = true;
            if (saved) {
              setDraft(saved.draft);
              setBaseline(saved.baseline);
            } else {
              const study: Study = {
                clientKey: crypto.randomUUID(),
                revision: 0,
                status: 'draft',
                updatedAt: new Date().toISOString(),
                values: emptyValues(),
                reports: [],
              };
              setDraft(study);
              setBaseline(study);
            }
          }
        } catch {
          toast.add({
            title:
              '작성 내용을 복원하지 못했습니다. 브라우저 데이터를 지우지 말고 임시저장을 확인해 주세요.',
            type: 'error',
          });
        }
      }
      if (!cancelled) refreshLocal();
    }
    void initialize();
    window.addEventListener('storage', refreshLocal);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', refreshLocal);
    };
  }, [refreshLocal, persistCreation, userId]);

  useEffect(() => {
    if (!persistCreation || !ready || !creating.current) return;
    const url = new URL(window.location.href);
    try {
      if (draft && draft.revision === 0 && baseline) {
        writeEditor(userId, draft, baseline);
        url.searchParams.set('studyEditor', 'new');
      } else {
        clearEditor(userId);
        creating.current = false;
        url.searchParams.delete('studyEditor');
      }
      window.history.replaceState(null, '', url);
    } catch {
      toast.add({
        title:
          '새로고침 복원용 저장에 실패했습니다. 현재 화면을 유지하고 임시저장을 시도해 주세요.',
        type: 'error',
      });
    }
  }, [draft, baseline, persistCreation, ready, userId]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);

  async function run(operation: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      toast.add({
        title:
          error instanceof Error
            ? error.message
            : '저장에 실패했습니다. 입력 내용은 유지됩니다.',
        type: 'error',
      });
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  function create() {
    creating.current = persistCreation;
    const study: Study = {
      clientKey: crypto.randomUUID(),
      revision: 0,
      status: 'draft',
      updatedAt: new Date().toISOString(),
      values: emptyValues(),
      reports: [],
    };
    setDraft(study);
    setBaseline(study);
    attempt.current = null;
  }
  function open(study: Study) {
    void run(async () => {
      const restored =
        study.status === 'draft' ? await restoreFiles(userId, study) : study;
      setDraft(restored);
      setBaseline(restored);
      attempt.current = null;
      if (restored.reports?.some((r) => !r.path && !r.file))
        toast.add({
          title:
            '복원할 수 없는 첨부 파일이 있습니다. 다시 첨부한 뒤 확정해 주세요.',
          type: 'error',
        });
    });
  }
  function saveLocal() {
    if (
      !draft ||
      (draft.ownerId && draft.ownerId !== userId) ||
      !hasInput(draft)
    )
      return;
    void run(async () => {
      const saved = await saveDraft(userId, draft);
      setDraft(saved);
      setBaseline(saved);
      refreshLocal();
      toast.add({ title: '이 브라우저에 임시저장했습니다.', type: 'success' });
    });
  }
  function confirm() {
    if (!draft || (draft.ownerId && draft.ownerId !== userId)) return;
    if (studyValuesBytes(draft.values) > MAX_STUDY_VALUES_BYTES) {
      toast.add({ title: STUDY_SIZE_ERROR, type: 'error' });
      return;
    }
    const missing = missingFields(draft.values);
    if (missing.length) {
      toast.add({
        title: `${missing.map(([, label]) => label).join(', ')} 항목을 입력해 주세요.`,
        type: 'error',
      });
      return;
    }
    void run(async () => {
      const fingerprint = studyFingerprint(draft);
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, saveId: crypto.randomUUID() };
      const saved = await confirmStudy(userId, draft, attempt.current.saveId);
      let localCleanupFailed = false;
      try {
        await removeDraft(userId, draft);
      } catch {
        localCleanupFailed = true;
      }
      const oldPaths = (baseline?.reports ?? []).flatMap((r) =>
        r.path && !saved.reports?.some((next) => next.path === r.path)
          ? [r.path]
          : [],
      );
      // Deletion is restricted by Storage RLS to objects no active confirmed study references.
      if (oldPaths.length)
        await createClient()
          .storage.from(REPORT_BUCKET)
          .remove(oldPaths)
          .catch(() => undefined);
      setDraft(saved);
      setBaseline(saved);
      attempt.current = null;
      refreshLocal();
      void refreshReferences();
      toast.add({
        title: localCleanupFailed
          ? 'DB에 확정했습니다. 다른 탭의 임시저장은 보존했습니다. 목록에서 확인해 주세요.'
          : '학습법을 확정했습니다. 이후에도 수정할 수 있습니다.',
        type: 'success',
      });
    });
  }
  async function remove(study: Study) {
    if (study.ownerId && study.ownerId !== userId) return false;
    let success = false;
    await run(async () => {
      if (study.status === 'draft') {
        await removeDraft(userId, study);
        refreshLocal();
      } else {
        const result = await deleteStudy(study);
        void refreshReferences();
        if (result.cleanupPending)
          toast.add({
            title: '학습법은 삭제했지만 일부 파일 정리가 지연되고 있습니다.',
            type: 'error',
          });
      }
      success = true;
      toast.add({
        title:
          study.status === 'draft'
            ? '임시저장을 삭제했습니다.'
            : '학습법을 삭제했습니다.',
        type: 'success',
      });
    });
    return success;
  }
  const studies = [...local].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return {
    studies,
    draft,
    setDraft,
    busy,
    dirty,
    ready,
    localError,
    create,
    open,
    saveLocal,
    confirm,
    remove,
  };
}

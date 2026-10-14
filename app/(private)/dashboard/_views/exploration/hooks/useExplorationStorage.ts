'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';

import { toast } from '@/components/ui/toast';
import { emptyValues,type Exploration } from '@/lib/exploration/fields';
import {
  explorationFingerprint,
  type ExplorationRow,
  hasInput,
  missingFields,
  REPORT_BUCKET,
} from '@/lib/exploration/storage-model';
import { createClient } from '@/lib/supabase/client';

import {
  confirmExploration,
  deleteExploration,
  request,
} from '../lib/api-client';
import {
  readDrafts,
  removeDraft,
  restoreFiles,
  saveDraft,
} from '../lib/local-drafts';

export function useExplorationStorage(userId: string) {
  const { mutate } = useSWRConfig();
  const refreshReferences = () =>
    mutate(
      (key) =>
        Array.isArray(key) &&
        [
          'exploration-list-v1',
          'exploration-page',
          'exploration-summary',
        ].includes(key[0]),
    );
  const [local, setLocal] = useState<Exploration[]>([]);
  const [localError, setLocalError] = useState('');
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Exploration | null>(null);
  const [baseline, setBaseline] = useState<Exploration | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const attempt = useRef<{ fingerprint: string; saveId: string } | null>(null);
  const dirty =
    !!draft &&
    (!baseline
      ? hasInput(draft)
      : explorationFingerprint(draft) !== explorationFingerprint(baseline));
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
    Promise.resolve().then(refreshLocal);
    window.addEventListener('storage', refreshLocal);
    return () => window.removeEventListener('storage', refreshLocal);
  }, [refreshLocal]);
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
    const activity: Exploration = {
      clientKey: crypto.randomUUID(),
      revision: 0,
      status: 'draft',
      updatedAt: new Date().toISOString(),
      values: emptyValues(),
      reports: [],
    };
    setDraft(activity);
    setBaseline(activity);
    attempt.current = null;
  }
  function open(activity: Exploration) {
    void run(async () => {
      const restored =
        activity.status === 'draft'
          ? await restoreFiles(userId, activity)
          : activity;
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
    const missing = missingFields(draft.values);
    if (missing.length) {
      toast.add({
        title: `${missing.map(([, label]) => label).join(', ')} 항목을 입력해 주세요.`,
        type: 'error',
      });
      return;
    }
    void run(async () => {
      const fingerprint = explorationFingerprint(draft);
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, saveId: crypto.randomUUID() };
      // A saved local edit may already omit an old attachment; read only this
      // confirmed row so cleanup is not based on the local edit's baseline.
      const previous =
        draft.revision > 0
          ? await request<{ activities: ExplorationRow[] }>(
              `/api/exploration?scope=own&reference=${draft.clientKey}`,
            )
          : { activities: [] };
      const saved = await confirmExploration(
        userId,
        draft,
        attempt.current.saveId,
      );
      let localCleanupFailed = false;
      try {
        await removeDraft(userId, draft);
      } catch {
        localCleanupFailed = true;
      }
      const oldPaths = (previous.activities[0]?.reports ?? []).flatMap((r) =>
        r.path && !saved.reports?.some((next) => next.path === r.path)
          ? [r.path]
          : [],
      );
      // Deletion is restricted by Storage RLS to objects no active confirmed activity references.
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
          : '탐구활동을 확정했습니다. 이후에도 수정할 수 있습니다.',
        type: 'success',
      });
    });
  }
  async function remove(activity: Exploration) {
    if (activity.ownerId && activity.ownerId !== userId) return false;
    let success = false;
    await run(async () => {
      if (activity.status === 'draft') {
        await removeDraft(userId, activity);
        refreshLocal();
      } else {
        const result = await deleteExploration(activity);
        void refreshReferences();
        if (result.cleanupPending)
          toast.add({
            title: '탐구활동은 삭제했지만 일부 파일 정리가 지연되고 있습니다.',
            type: 'error',
          });
      }
      success = true;
      toast.add({
        title:
          activity.status === 'draft'
            ? '임시저장을 삭제했습니다.'
            : '탐구활동을 삭제했습니다.',
        type: 'success',
      });
    });
    return success;
  }
  return {
    local,
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

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import { toast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';

import {
  confirmActivity,
  deleteActivity,
  loadActivities,
} from '../lib/api-client';
import { type Activity, emptyValues } from '../lib/fields';
import {
  readDrafts,
  removeDraft,
  restoreFiles,
  saveDraft,
} from '../lib/local-drafts';
import {
  activityFingerprint,
  hasInput,
  missingFields,
  REPORT_BUCKET,
} from '../lib/storage-model';

export function useExplorationStorage(userId: string) {
  const {
    data: confirmed = [],
    error: remoteError,
    isLoading,
    mutate,
  } = useSWR(['exploration', userId], loadActivities);
  const [local, setLocal] = useState<Activity[]>([]);
  const [localError, setLocalError] = useState('');
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Activity | null>(null);
  const [baseline, setBaseline] = useState<Activity | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const attempt = useRef<{ fingerprint: string; saveId: string } | null>(null);
  const dirty =
    !!draft &&
    (!baseline
      ? hasInput(draft)
      : activityFingerprint(draft) !== activityFingerprint(baseline));
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
    const activity: Activity = {
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
  function open(activity: Activity) {
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
      const fingerprint = activityFingerprint(draft);
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, saveId: crypto.randomUUID() };
      const saved = await confirmActivity(
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
      const oldPaths = (
        confirmed.find((a) => a.clientKey === draft.clientKey)?.reports ?? []
      ).flatMap((r) =>
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
      await mutate(
        (current = []) => [
          saved,
          ...current.filter((a) => a.clientKey !== saved.clientKey),
        ],
        { revalidate: false },
      );
      toast.add({
        title: localCleanupFailed
          ? 'DB에 확정했습니다. 다른 탭의 임시저장은 보존했습니다. 목록에서 확인해 주세요.'
          : '탐구활동을 확정했습니다. 이후에도 수정할 수 있습니다.',
        type: 'success',
      });
    });
  }
  async function remove(activity: Activity) {
    if (activity.ownerId && activity.ownerId !== userId) return false;
    let success = false;
    await run(async () => {
      if (activity.status === 'draft') {
        await removeDraft(userId, activity);
        refreshLocal();
      } else {
        const result = await deleteActivity(activity);
        await mutate(
          (current = []) =>
            current.filter((a) => a.clientKey !== activity.clientKey),
          { revalidate: false },
        );
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
  const activities = [
    ...local,
    ...confirmed.filter(
      (activity) => !local.some((d) => d.clientKey === activity.clientKey),
    ),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    activities,
    draft,
    setDraft,
    busy,
    dirty,
    ready,
    localError,
    remoteError,
    isLoading,
    refresh: mutate,
    create,
    open,
    saveLocal,
    confirm,
    remove,
  };
}

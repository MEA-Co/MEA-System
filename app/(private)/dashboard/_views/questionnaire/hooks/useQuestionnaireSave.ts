'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { QuestionnaireSaveSession } from '@/app/(private)/dashboard/_views/questionnaire/lib/save-session';
import type {
  QuestionnaireDocument,
  QuestionnaireDraft,
} from '@/app/(private)/dashboard/_views/questionnaire/lib/types';
import { toast } from '@/components/ui/toast';

import { useQuestionnaireApi } from '../lib/api-client';

export function useQuestionnaireSave(
  document: QuestionnaireDocument,
  initialDraft: QuestionnaireDraft,
  onRemoteDocument?: (draft: QuestionnaireDraft) => void,
  remoteUnavailable = false,
) {
  const { saveQuestionnaire, refresh } = useQuestionnaireApi();
  const [session] = useState(
    () => new QuestionnaireSaveSession(document, initialDraft.revision),
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(initialDraft.savedAt);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const dirty = session.hasChanges(document);

  const applyRemote = useEffectEvent(() => {
    if (remoteUnavailable) {
      session.block();
      setError(
        '다른 곳에서 삭제·배포되었거나 편집 권한이 변경되었어요. 작성 내용은 유지되지만 저장할 수 없어요.',
      );
      return;
    }
    const { questionnaireId, versionId, title, sections } = initialDraft;
    const result = session.reconcileRemote(
      { questionnaireId, versionId, title, sections },
      initialDraft.revision,
      document,
    );
    if (result === 'applied') {
      onRemoteDocument?.(initialDraft);
      setSavedAt(initialDraft.savedAt);
      setError(null);
    }
    if (result === 'conflict')
      setError(
        '다른 창에서 질문지가 수정되었어요. 작성 중인 내용은 유지했습니다. 내용을 복사한 뒤 다시 열어 주세요.',
      );
  });
  useEffect(() => {
    // SWR supplies an external server snapshot; reconcile it without replacing unsaved input.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyRemote();
  }, [initialDraft.revision, remoteUnavailable, saving]);

  async function save(manual = true) {
    if (session.pending || session.blocked || remoteUnavailable) return false;
    if (!session.hasChanges(document) && session.revision > 0) return true;
    setSaving(true);
    const toastId = toast.add({
      type: 'loading',
      title: manual
        ? '질문지를 저장하고 있어요.'
        : '질문지를 자동 저장하고 있어요.',
      timeout: 0,
    });
    try {
      let result = await session.save(document, saveQuestionnaire, () =>
        crypto.randomUUID(),
      );
      if (result?.ok && session.hasChanges(document) && mounted.current) {
        result = await session.save(document, saveQuestionnaire, () =>
          crypto.randomUUID(),
        );
      }
      if (!mounted.current) {
        toast.close(toastId);
        return false;
      }
      if (!result) {
        toast.close(toastId);
        return false;
      }
      if (!result.ok) {
        setError(result.error);
        toast.update(toastId, {
          type: 'error',
          title: '저장하지 못했어요.',
          description: result.error,
          timeout: 8000,
        });
        return false;
      }
      void refresh().catch(() => {});
      setSavedAt(result.savedAt);
      setError(null);
      toast.update(toastId, {
        type: 'success',
        title: manual ? '질문지를 저장했어요.' : '질문지를 자동 저장했어요.',
        timeout: 2000,
      });
      const url = new URL(window.location.href);
      if (url.searchParams.get('draft') !== document.versionId) {
        url.searchParams.set('draft', document.versionId);
        // Passing Next's internal history state skips its URL synchronization.
        // Update the URL without refetching/remounting the actively edited draft.
        window.history.replaceState(null, '', url);
      }
      return !session.hasChanges(document);
    } catch {
      if (!mounted.current) {
        toast.close(toastId);
        return false;
      }
      const message =
        '저장 결과를 확인하지 못했어요. 연결을 확인한 뒤 다시 저장해 주세요.';
      setError(message);
      toast.update(toastId, {
        type: 'error',
        title: '저장 결과 확인 실패',
        description: message,
        timeout: 8000,
      });
      return false;
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  const autoSave = useEffectEvent(() => {
    if (session.hasChanges(document) && !session.blocked) void save(false);
  });
  useEffect(() => {
    const timer = window.setInterval(autoSave, 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    // Cover dashboard/sidebar links as well as page reloads without discarding drafts silently.
    const beforeNavigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === '_blank' ||
        link.hasAttribute('download') ||
        link.href === window.location.href
      )
        return;
      if (
        !window.confirm(
          '아직 저장되지 않은 내용이 있어요. 저장하지 않고 이동할까요?',
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.document.addEventListener('click', beforeNavigate, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.document.removeEventListener('click', beforeNavigate, true);
    };
  }, [dirty, saving]);

  return {
    save,
    saving,
    dirty,
    savedAt,
    error,
    blocked: session.blocked || remoteUnavailable,
  };
}

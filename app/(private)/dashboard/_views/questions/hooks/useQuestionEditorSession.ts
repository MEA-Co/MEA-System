'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { richTextPlainText } from '@/app/(private)/dashboard/_views/questions/lib/rich-text';
import { toast } from '@/components/ui/toast';

import { useQuestionEditorData } from '../hooks/useQuestionEditorData';
import {
  documentFromRow,
  emptyQuestionBlock,
  type QuestionBlockDocument,
  type QuestionBlockField,
  type QuestionBlockRow,
  questionBlockSchema,
} from '../lib/question-blocks';
import { copyQuestionContent } from '../lib/question-copy';
import {
  clearLocalDraft,
  localDraftKey,
  type LocalQuestionBlockDraft,
  readError,
  readLocalDraft,
  stableDocument,
} from '../lib/question-editor-draft';
import type { QuestionLibraryProps } from '../lib/question-editor-types';
import { questionValidationFailure } from '../lib/question-validation-errors';

import { useQuestionLibraryList } from './useQuestionLibraryList';
export function useQuestionEditorSession({
  embedded,
}: QuestionLibraryProps = {}) {
  const routeId = useSearchParams().get('question');
  const [inlineId, setInlineId] = useState<string | null>(
    embedded?.questionId ?? 'new',
  );
  const requestedId = embedded ? inlineId : routeId;
  const {
    blocks,
    userId,
    role,
    query,
    setQuery,
    search,
    total,
    page,
    setPage,
    listMode,
    setListMode,
    fetching,
    loadError,
    loading,
    loadBlocks,
    filtered,
    currentPage,
    pageCount,
    pageQuestions,
  } = useQuestionLibraryList();
  const [savedRow, setSavedRow] = useState<QuestionBlockRow | null>(null);
  const activeId = useRef<string | null>(null);
  const sessions = useRef(
    new Map<
      string,
      LocalQuestionBlockDraft & {
        conflicted?: boolean;
        saveError?: string | null;
      }
    >(),
  );
  const pendingSaves = useRef(
    new Map<
      string,
      {
        document: QuestionBlockDocument;
        expectedRevision: number;
        saveId: string;
        confirmedGuideAnswerFields?: string[];
      }
    >(),
  );
  const savingRef = useRef(false);

  const [draft, setDraft] = useState<QuestionBlockDocument | null>(null);
  const [savedDocument, setSavedDocument] =
    useState<QuestionBlockDocument | null>(null);
  const [initialDocument, setInitialDocument] =
    useState<QuestionBlockDocument | null>(null);
  const [revision, setRevision] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);

  const [busy, setBusy] = useState(false);

  const [pendingArchive, setPendingArchive] = useState<QuestionBlockRow | null>(
    null,
  );
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const continueWritingRef = useRef<HTMLButtonElement>(null);
  const [guideDialog, setGuideDialog] = useState({ open: false, message: '' });
  const guideResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const guideCancelRef = useRef<HTMLButtonElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const editorBlocked = confirmDiscard || guideDialog.open || importOpen;
  const [closingId, setClosingId] = useState<string | null>(null);

  const localSession =
    requestedId && userId ? readLocalDraft(userId, requestedId) : null;
  const unsaved =
    (draft?.id === requestedId && revision === 0) ||
    (!!localSession && localSession.revision === 0);
  const editorData = useQuestionEditorData(
    // Resolve the user-scoped local draft before treating a URL ID as persisted.
    !userId || requestedId === closingId ? null : requestedId,
    unsaved,
    embedded?.allowSharedEdit ? embedded.questionnaireId : undefined,
  );
  const relatedQuestions = [
    ...new Map(
      [
        ...(embedded?.sharedSources ?? []),
        ...(editorData.relationships.data ?? []),
      ].map((q) => [q.id, q]),
    ).values(),
  ];
  const candidates = relatedQuestions.filter(
    (block) => block.id !== draft?.id && block.purpose !== 'study_registration',
  );
  const opener = useRef<HTMLElement | null>(null);
  const listHeading = useRef<HTMLHeadingElement | null>(null);
  const openedFromList = useRef(false);
  const pendingRoute = useRef<string | null>(null);
  const baseline = savedDocument ?? initialDocument;
  const dirty =
    !!draft &&
    (!baseline || stableDocument(draft) !== stableDocument(baseline));
  const valid = draft ? questionBlockSchema.safeParse(draft).success : false;
  const reportEditorState = useEffectEvent(() =>
    embedded?.onStateChange?.({ dirty, saving: busy }),
  );
  useEffect(() => {
    reportEditorState();
  }, [dirty, busy]);

  function storeSession(
    snapshot: LocalQuestionBlockDraft & {
      conflicted?: boolean;
      saveError?: string | null;
    },
  ) {
    sessions.current.set(snapshot.document.id, snapshot);
    if (!userId) return;
    try {
      if (
        snapshot.savedDocument &&
        stableDocument(snapshot.document) ===
          stableDocument(snapshot.savedDocument)
      ) {
        clearLocalDraft(userId, snapshot.document.id);
      } else {
        window.localStorage.setItem(
          localDraftKey(userId, snapshot.document.id),
          JSON.stringify(snapshot),
        );
      }
    } catch {
      /* In-memory drafts and server saves remain available. */
    }
  }
  const rememberDraft = useEffectEvent(() => {
    if (draft)
      storeSession({
        document: draft,
        savedDocument,
        initialDocument,
        revision,
        savedAt,
        conflicted,
        saveError,
      });
  });
  useEffect(() => {
    rememberDraft();
  }, [
    userId,
    draft,
    savedDocument,
    initialDocument,
    revision,
    savedAt,
    conflicted,
    saveError,
  ]);

  function navigateQuestion(id: string | null, replace = false) {
    if (embedded) {
      setInlineId(id);
      return;
    }
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('question', id);
    else url.searchParams.delete('question');
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }

  const syncQuestionRoute = useEffectEvent(() => {
    if (!userId) return;
    // history.back() finishes asynchronously; do not reopen or fetch a discarded draft.
    if (closingId && requestedId === closingId) return;
    if (closingId) setClosingId(null);
    if (
      activeId.current &&
      requestedId !== activeId.current &&
      guideResolver.current
    ) {
      // A pending guide confirmation owns the interaction, including Back.
      navigateQuestion(activeId.current);
      return;
    }
    if (
      activeId.current &&
      draft &&
      requestedId !== activeId.current &&
      (dirty || savingRef.current)
    ) {
      rememberDraft();
      pendingRoute.current = requestedId;
      // Recreate the editor history entry after Back so cancel keeps the
      // drawer open and a confirmed close can still return to the list.
      navigateQuestion(activeId.current);
      if (savingRef.current) {
        toast.add({ type: 'info', title: '저장이 끝난 뒤 닫아 주세요.' });
        return;
      }
      setConfirmDiscard(true);
      return;
    }
    if (
      requestedId &&
      requestedId !== 'new' &&
      !unsaved &&
      (editorData.detail.isLoading ||
        editorData.detail.error ||
        editorData.detail.data === undefined)
    )
      return;
    if (
      requestedId === activeId.current &&
      (requestedId === null || draft?.id === requestedId)
    )
      return;
    rememberDraft();
    activeId.current = requestedId;
    setConfirmDiscard(false);
    if (!requestedId) {
      setDraft(null);
      setSavedDocument(null);
      setSaveError(null);
      setConflicted(false);
      return;
    }
    if (requestedId === 'new') {
      const document = emptyQuestionBlock();
      storeSession({
        document,
        savedDocument: null,
        initialDocument: document,
        revision: 0,
        savedAt: null,
      });
      navigateQuestion(document.id, true);
      return;
    }
    const remote = unsaved ? null : editorData.detail.data;
    const local =
      sessions.current.get(requestedId) ?? readLocalDraft(userId, requestedId);
    if (
      (remote &&
        role !== 'admin' &&
        remote.created_by !== userId &&
        !embedded?.allowSharedEdit) ||
      (!remote && !local)
    ) {
      toast.add({
        title: remote
          ? '이 질문을 수정할 권한이 없어요.'
          : '질문을 찾을 수 없어요.',
        type: 'error',
      });
      navigateQuestion(null, true);
      return;
    }
    const remoteDocument = remote ? documentFromRow(remote) : null;
    const localDirty =
      local &&
      (!local.savedDocument ||
        stableDocument(local.document) !== stableDocument(local.savedDocument));
    const useLocal = local && (localDirty || !remote);
    const isConflict = !!(
      useLocal &&
      ((remote &&
        remote.revision > local.revision &&
        stableDocument(remoteDocument!) !== stableDocument(local.document)) ||
        (!remote && local.revision > 0))
    );
    const sameSaved =
      remoteDocument &&
      local &&
      stableDocument(remoteDocument) === stableDocument(local.document);
    setSavedRow(remote ?? null);
    setInitialDocument(local?.initialDocument ?? null);
    setDraft(useLocal ? local.document : remoteDocument);
    setSavedDocument(
      sameSaved || !useLocal ? remoteDocument : local.savedDocument,
    );
    setRevision(sameSaved || !useLocal ? remote!.revision : local.revision);
    setSavedAt(sameSaved || !useLocal ? remote!.updated_at : local.savedAt);
    setConflicted(isConflict);
    setSaveError(
      isConflict ? '다른 곳에서 수정됐어요. 작성 내용은 유지됩니다.' : null,
    );
  });
  useEffect(() => {
    // Browser history is the external source of truth for the active editor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncQuestionRoute();
  }, [
    requestedId,
    userId,
    closingId,
    unsaved,
    editorData.detail.isLoading,
    editorData.detail.error,
    editorData.detail.data,
  ]);

  const guideConfirmations = useRef(new Map<string, Set<string>>());
  const checkingGuide = useRef(false);
  const guideSavePaused = useRef(false);

  function resolveGuideConfirmation(confirmed: boolean) {
    const resolve = guideResolver.current;
    guideResolver.current = null;
    // Keep the message during the closing animation.
    setGuideDialog((current) => ({ ...current, open: false }));
    resolve?.(confirmed);
  }

  function confirmGuideChange(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      guideResolver.current = resolve;
      setGuideDialog({ open: true, message });
    });
  }

  useEffect(() => {
    return () => {
      // Navigation/unmount must never leave a pending destructive change approved.
      if (guideResolver.current) {
        guideResolver.current(false);
        guideResolver.current = null;
        setGuideDialog((current) => ({ ...current, open: false }));
      }
    };
  }, [draft?.id]);

  async function changeAnswerField(
    field: QuestionBlockField,
    updated?: QuestionBlockField,
  ) {
    if (!draft || checkingGuide.current || savingRef.current) return;
    const questionId = draft.id;
    checkingGuide.current = true;
    try {
      if (revision > 0) {
        const response = await fetch(
          `/api/questions/${questionId}/guide-answer-fields`,
          { cache: 'no-store' },
        );
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.fieldIds)) throw new Error();
        if (activeId.current !== questionId) return;
        if (data.fieldIds.includes(field.id)) {
          if (
            !(await confirmGuideChange(
              '이 답변 항목에 저장된 가이드 응답이 있습니다. 계속하면 해당 가이드 응답이 삭제됩니다. 계속하시겠습니까?',
            ))
          )
            return;
          if (activeId.current !== questionId) return;
          const confirmed =
            guideConfirmations.current.get(questionId) ?? new Set<string>();
          confirmed.add(field.id);
          guideConfirmations.current.set(questionId, confirmed);
        }
      }
      guideSavePaused.current = false;
      setDraft((current) =>
        current?.id === questionId
          ? {
              ...current,
              fields: updated
                ? current.fields.map((item) =>
                    item.id === field.id ? updated : item,
                  )
                : current.fields.filter((item) => item.id !== field.id),
            }
          : current,
      );
    } catch {
      toast.add({
        title: '가이드 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
        type: 'error',
      });
    } finally {
      checkingGuide.current = false;
    }
  }

  function updateDraft(changes: Partial<QuestionBlockDocument>) {
    setDraft((current) => (current ? { ...current, ...changes } : null));
  }

  function changeAnswerLayout(
    answerLayout: QuestionBlockDocument['answerLayout'],
  ) {
    if (
      !draft ||
      !answerLayout ||
      answerLayout === (draft.answerLayout ?? 'cards')
    )
      return;
    if (
      answerLayout === 'table' &&
      (draft.answerLayout ?? 'cards') === 'cards' &&
      draft.rowMode === 'single'
    ) {
      updateDraft({
        answerLayout,
        flowInsertAfter: [],
        rowMode: 'repeatable',
        maxRows: 20,
        minRows: 1,
        initialRows: 5,
      });
    } else if (answerLayout === 'flow' && draft.rowMode === 'single') {
      updateDraft({
        answerLayout,
        flowInsertAfter: [],
        rowMode: 'repeatable',
        maxRows: 6,
        minRows: 1,
        initialRows: 6,
        rowLabels: [
          '고1 1학기',
          '고1 2학기',
          '고2 1학기',
          '고2 2학기',
          '고3 1학기',
          '고3 2학기',
        ],
      });
    } else {
      updateDraft({
        answerLayout,
        flowInsertAfter:
          answerLayout === 'flow' ? (draft.flowInsertAfter ?? []) : [],
      });
    }
  }

  function changeFlowInsertAfter(position: number, allowed: boolean) {
    setDraft((current) => {
      if (!current || current.answerLayout !== 'flow') return current;
      const basePeriodCount =
        current.rowMode === 'repeatable' ? (current.maxRows ?? 1) : 1;
      if (
        position < 1 ||
        position > basePeriodCount ||
        (allowed && basePeriodCount >= 20)
      )
        return current;
      const positions = new Set(current.flowInsertAfter ?? []);
      if (allowed) positions.add(position);
      else positions.delete(position);
      return {
        ...current,
        flowInsertAfter: [...positions].sort((left, right) => left - right),
      };
    });
  }

  function updateField(fieldId: string, updated: QuestionBlockField) {
    const previous = draft?.fields.find((field) => field.id === fieldId);
    if (previous && previous.kind !== updated.kind) {
      void changeAnswerField(previous, updated);
      return;
    }
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.id === fieldId ? updated : field,
            ),
          }
        : null,
    );
  }

  function returnToList() {
    if (embedded) {
      embedded.onCancel();
      return;
    }
    if (openedFromList.current) {
      openedFromList.current = false;
      window.history.back();
    } else navigateQuestion(null, true);
  }
  function leaveEditor() {
    if (
      savingRef.current ||
      confirmDiscard ||
      guideResolver.current ||
      importOpen
    )
      return;
    if (dirty) {
      pendingRoute.current = null;
      setConfirmDiscard(true);
    } else if (draft && revision === 0) {
      discardDraft();
    } else returnToList();
  }

  function discardDraft() {
    setClosingId(requestedId);
    if (draft) {
      clearLocalDraft(userId, draft.id);
      sessions.current.delete(draft.id);
      pendingSaves.current.delete(draft.id);
    }
    activeId.current = null;
    setDraft(null);
    setConfirmDiscard(false);
    if (pendingRoute.current) navigateQuestion(pendingRoute.current, true);
    else returnToList();
  }

  function openEditor(block?: QuestionBlockRow) {
    opener.current =
      window.document.activeElement instanceof HTMLElement
        ? window.document.activeElement
        : null;
    openedFromList.current = true;
    pendingRoute.current = null;
    if (!block) {
      const document = emptyQuestionBlock();
      storeSession({
        document,
        savedDocument: null,
        initialDocument: document,
        revision: 0,
        savedAt: null,
      });
      navigateQuestion(document.id);
    } else navigateQuestion(block.id);
  }

  async function save(manual = true) {
    if (editorData.detail.data?.publication_locked_at) return;
    if (
      !draft ||
      importOpen ||
      checkingGuide.current ||
      (!manual && guideSavePaused.current) ||
      savingRef.current ||
      conflicted ||
      (!dirty && !pendingSaves.current.has(draft.id))
    )
      return;
    if (!richTextPlainText(draft.prompt).trim()) {
      if (manual)
        toast.add({
          title:
            draft.purpose === 'study_registration'
              ? '안내 내용이 비어 있어 저장할 수 없어요. 내용을 입력해 주세요.'
              : '질문 본문이 비어 있어 저장할 수 없어요. 질문을 입력해 주세요.',
          type: 'error',
        });
      return;
    }
    let attempt = pendingSaves.current.get(draft.id);
    if (!attempt) {
      const parsed = questionBlockSchema.safeParse(draft);
      if (!parsed.success) {
        if (manual)
          toast.add({
            title: questionValidationFailure(parsed.error.issues).error,
            type: 'error',
          });
        return;
      }
      attempt = {
        document: parsed.data,
        expectedRevision: revision,
        saveId: crypto.randomUUID(),
        confirmedGuideAnswerFields: [
          ...(guideConfirmations.current.get(draft.id) ?? []),
        ],
      };
      pendingSaves.current.set(draft.id, attempt);
    }
    savingRef.current = true;
    setBusy(true);
    setSaveError(null);
    const attemptId = attempt.document.id;
    const isCurrentQuestion = () =>
      activeId.current === attemptId &&
      (embedded ||
        new URL(window.location.href).searchParams.get('question') ===
          attemptId);
    const recordError = (message: string, conflict = false) => {
      const session = sessions.current.get(attemptId);
      if (session)
        storeSession({
          ...session,
          saveError: message,
          conflicted: conflict || session.conflicted,
        });
      if (isCurrentQuestion()) {
        if (conflict) setConflicted(true);
        setSaveError(message);
      }
    };
    try {
      const response = await fetch(
        attempt.expectedRevision > 0
          ? `/api/questions/${attempt.document.id}`
          : '/api/questions',
        {
          method: attempt.expectedRevision > 0 ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document: attempt.document,
            expectedRevision: attempt.expectedRevision,
            saveId: attempt.saveId,
            confirmedGuideAnswerFields: attempt.confirmedGuideAnswerFields,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        if (
          data.code === 'guide_answer_confirmation_required' &&
          Array.isArray(data.fieldIds)
        ) {
          if (
            isCurrentQuestion() &&
            (await confirmGuideChange(
              '새로 저장된 가이드 응답이 있습니다. 계속하면 변경한 항목의 가이드 응답이 삭제됩니다. 계속하시겠습니까?',
            )) &&
            isCurrentQuestion()
          ) {
            attempt.confirmedGuideAnswerFields = data.fieldIds;
            window.setTimeout(() => void save(manual), 0);
          } else {
            guideSavePaused.current = true;
            recordError(
              '가이드 응답을 보호하기 위해 저장을 멈췄어요. 변경을 취소하거나 저장 버튼으로 다시 확인해 주세요.',
            );
          }
          return;
        }
        const message = readError(data);
        if (response.status < 500) pendingSaves.current.delete(attemptId);
        recordError(
          message,
          response.status === 409 &&
            (data.code === 'revision_conflict' || data.code === undefined),
        );
        if (manual || saveError !== message)
          toast.add({ title: message, type: 'error' });
        return;
      }
      const saved = data.block as QuestionBlockRow;
      setSavedRow(saved);
      embedded?.onSaved?.(saved);
      void loadBlocks();
      void editorData.detail.mutate(saved, { revalidate: false });
      void editorData.relationships.mutate(
        (current) =>
          current
            ? [saved, ...current.filter((block) => block.id !== saved.id)]
            : undefined,
        { revalidate: false },
      );
      const session = sessions.current.get(attemptId);
      if (session)
        storeSession({
          ...session,
          savedDocument: attempt.document,
          revision: saved.revision,
          savedAt: saved.updated_at,
          conflicted: false,
          saveError: null,
        });
      if (isCurrentQuestion()) {
        setRevision(saved.revision);
        setSavedAt(saved.updated_at);
        setSavedDocument(attempt.document);
        setSaveError(null);
      }
      pendingSaves.current.delete(attemptId);
      guideConfirmations.current.delete(attemptId);
      guideSavePaused.current = false;
      if (manual)
        toast.add({
          title:
            attempt.document.purpose === 'study_registration'
              ? '안내 카드를 저장했어요.'
              : '질문을 저장했어요.',
          type: 'success',
        });
    } catch {
      const message = '저장 결과를 확인하지 못했어요. 연결을 확인해 주세요.';
      recordError(message);
      if (manual || saveError !== message)
        toast.add({ title: message, type: 'error' });
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  const autoSave = useEffectEvent(() => {
    if (
      draft?.id === requestedId &&
      dirty &&
      valid &&
      !conflicted &&
      !confirmDiscard &&
      !embedded?.paused
    )
      void save(false);
  });
  useEffect(() => {
    const timer = window.setInterval(autoSave, 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (embedded || (!dirty && !busy)) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
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
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank')
        return;
      if (!window.confirm('저장되지 않은 질문 내용이 있어요. 이동할까요?')) {
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
  }, [dirty, busy, embedded]);

  async function archive() {
    if (!pendingArchive || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/questions/${pendingArchive.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: pendingArchive.revision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(readError(data));
      setPendingArchive(null);
      await loadBlocks();
      toast.add({ title: '질문을 삭제했어요.', type: 'success' });
    } catch (error) {
      toast.add({
        title:
          error instanceof Error ? error.message : '질문을 삭제하지 못했어요.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  function openImport() {
    if (
      !draft ||
      revision !== 0 ||
      savingRef.current ||
      pendingSaves.current.has(draft.id)
    )
      return;
    setImportOpen(true);
  }
  function importQuestion(source: QuestionBlockRow) {
    if (
      !draft ||
      revision !== 0 ||
      savingRef.current ||
      pendingSaves.current.has(draft.id)
    )
      return;
    const imported = copyQuestionContent(source, draft.id);
    setDraft(imported);
    setInitialDocument(imported);
    setSaveError(null);
    setImportOpen(false);
  }

  return {
    unchangedImport:
      revision === 0 && !dirty && !!initialDocument?.prompt.trim(),
    importOpen,
    setImportOpen,
    openImport,
    importQuestion,
    requestedId,
    savedRow,
    userId,
    role,
    draft,
    revision,
    savedAt,
    saveError,
    conflicted,
    busy,
    loadError,
    confirmDiscard,
    setConfirmDiscard,
    continueWritingRef,
    guideDialog,
    guideCancelRef,
    editorBlocked,
    loadBlocks,
    unsaved,
    editorData,
    relatedQuestions,
    candidates,
    dirty,
    valid,
    resolveGuideConfirmation,
    changeAnswerField,
    updateDraft,
    changeAnswerLayout,
    changeFlowInsertAfter,
    updateField,
    leaveEditor,
    discardDraft,
    save,
    blocks,
    query,
    setQuery,
    search,
    total,
    page,
    setPage,
    listMode,
    setListMode,
    fetching,
    pendingArchive,
    setPendingArchive,
    loading,
    filtered,
    pageCount,
    currentPage,
    pageQuestions,
    opener,
    listHeading,
    openEditor,
    archive,
  };
}

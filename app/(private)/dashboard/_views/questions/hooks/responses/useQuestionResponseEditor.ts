'use client';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { useSWRConfig } from 'swr';

import { toast } from '@/components/ui/toast';

import type { QuestionnaireEditorState } from '../../components/questionnaire/QuestionnaireView';
import {
  hasIncompatibleFlowDraft,
  mergeGuideResponseRows,
  type QuestionResponseSave,
  type QuestionResponseSnapshot,
  snapshotRows,
} from '../../lib/question-responses';
import {
  QUESTIONNAIRE_API,
  QuestionnaireApiError,
} from '../../lib/questionnaire/api-client';
import type { PreviewAnswerRow } from '../../lib/reference-rows';
import {
  requestQuestionResponse,
  requestResponseVersion,
} from '../../lib/responses/api-client';
import { refreshResponseIfChanged } from '../../lib/responses/polling';
import { validateResponseSubmission } from '../../lib/responses/submission-validation';
import { richTextPlainText } from '../../lib/rich-text';
export function useQuestionResponseEditor({
  questionnaireId,
  initial,
  onEditorState,
  published = false,
}: {
  questionnaireId: string;
  published?: boolean;
  initial: QuestionResponseSnapshot;
  onEditorState?: (state: QuestionnaireEditorState) => void;
}) {
  const [submissionAttempted, setSubmissionAttempted] = useState(false);
  const [invalidSubmission, setInvalidSubmission] = useState<{
    questionId: string;
  } | null>(null);
  const { mutate } = useSWRConfig();
  const [rows, setRows] = useState(() => snapshotRows(initial));
  const [snapshot, setSnapshot] = useState(initial);
  const hasResponseQuestions = snapshot.questions.some(
    (question) => question.definition.purpose !== 'study_registration',
  );
  const [remoteAnswerVersion, setRemoteAnswerVersion] = useState(0);
  const [savedAt, setSavedAt] = useState(initial.savedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [saved, setSaved] = useState(() =>
    JSON.stringify(snapshotRows(initial)),
  );
  const mounted = useRef(false);
  const session = useRef({
    revision: initial.revision,
    busy: false,
    saveGeneration: 0,
    refreshing: false,
    retry: null as QuestionResponseSave | null,
  });
  const [pendingSave, setPendingSave] = useState<QuestionResponseSave | null>(
    null,
  );
  const latestRemoteHandler = useRef<
    ((next: QuestionResponseSnapshot) => void) | null
  >(null);
  const hasContent = (answers: Record<string, PreviewAnswerRow[]>) =>
    Object.values(answers).some((items) =>
      items.some(
        (row) =>
          row.flowAfter !== undefined ||
          !!row.label?.trim() ||
          Object.values(row.answers).some((value) =>
            richTextPlainText(value).trim(),
          ),
      ),
    );
  // Empty editor initialization is not an answer or a reason to autosave.
  const dirty =
    (JSON.stringify(rows) !== saved &&
      (hasContent(rows) || hasContent(JSON.parse(saved)))) ||
    !!pendingSave;
  const locked = blocked;
  const change = useCallback(
    (id: string, value: PreviewAnswerRow[]) => {
      if (locked || session.current.retry?.complete) return;
      if (
        snapshot.questions.some(
          (question) =>
            question.definition.id === id &&
            question.definition.purpose === 'study_registration',
        )
      )
        return;
      setRows((current) =>
        JSON.stringify(current[id]) === JSON.stringify(value)
          ? current
          : { ...current, [id]: value },
      );
    },
    [locked, snapshot.questions],
  );
  useEffect(() => {
    onEditorState?.({ dirty, saving, emptyTitle: false });
  }, [dirty, saving, onEditorState]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const anchor =
        e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (
        anchor instanceof HTMLAnchorElement &&
        anchor.target !== '_blank' &&
        anchor.href !== window.location.href &&
        !window.confirm('저장되지 않은 답변이 있어요. 이동할까요?')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
    };
  }, [dirty, saving]);
  async function save(complete = false) {
    if (!hasResponseQuestions) return;
    if (session.current.busy || locked || (!dirty && !complete)) return;
    if (complete && !session.current.retry) {
      setSubmissionAttempted(true);
      const issues = validateResponseSubmission(snapshot, rows);
      if (issues.length) {
        setInvalidSubmission({ questionId: issues[0].questionId });
        return;
      }
    }
    session.current.busy = true;
    session.current.saveGeneration++;
    session.current.retry ??= {
      answers: structuredClone(rows),
      revision: session.current.revision,
      saveId: crypto.randomUUID(),
      complete,
      definitionToken: snapshot.definitionToken,
    };
    const pending = session.current.retry;
    setPendingSave(pending);
    setSaving(true);
    try {
      const result = await requestQuestionResponse(
        questionnaireId,
        'PUT',
        pending,
        published,
      );
      session.current.revision = result.revision;
      setSnapshot(result);
      setSavedAt(result.savedAt);
      setSaved(JSON.stringify(pending.answers));
      session.current.retry = null;
      setPendingSave(null);
      setError('');
      if (published) {
        void mutate(`${QUESTIONNAIRE_API}/responses`);
        void mutate(`${QUESTIONNAIRE_API}/unread`);
      }
      if (complete || pending.complete)
        toast.add({
          type: 'success',
          title: pending.complete
            ? '답변을 제출했어요. 리드가 제출 내용을 확인할 수 있어요.'
            : '이전 저장을 확인했어요. 제출을 다시 눌러 주세요.',
        });
    } catch (error) {
      if (error instanceof QuestionnaireApiError && error.status < 500) {
        session.current.retry = null;
        setPendingSave(null);
        if ([401, 403, 404].includes(error.status)) setBlocked(true);
        if (error.status === 409) {
          try {
            const latest = await requestQuestionResponse(
              questionnaireId,
              'GET',
              undefined,
              published,
            );
            latestRemoteHandler.current?.(latest);
            if (latest.definitionToken !== snapshot.definitionToken) return;
          } catch {
            setBlocked(true);
          }
        }
      }
      const message =
        error instanceof Error
          ? error.message
          : '저장 결과를 확인하지 못했어요. 다시 저장해 주세요.';
      setError(message);
      toast.add({ type: 'error', title: message });
    } finally {
      session.current.busy = false;
      setSaving(false);
    }
  }
  const tick = useEffectEvent(() => {
    if (dirty && !error) void save();
  });
  function applyRemote(next: QuestionResponseSnapshot) {
    // A newer answer revision and a new definition may arrive together. Never
    // rebase stale input onto that revision and silently overwrite another tab.
    if (dirty && next.revision !== session.current.revision) {
      setBlocked(true);
      setError(
        '다른 곳에서 답변이 변경됐어요. 현재 입력을 보관한 뒤 다시 열어 주세요.',
      );
      return;
    }
    if (next.definitionToken !== snapshot.definitionToken) {
      if (hasIncompatibleFlowDraft(rows, snapshot, next)) {
        setBlocked(true);
        setError(
          '작성 중인 흐름표의 기본 시기나 표 형식이 변경됐어요. 현재 입력은 이 화면에 유지됩니다. 입력을 복사한 뒤 질문지를 다시 열어 주세요.',
        );
        return;
      }
      session.current.revision = next.revision;
      const remoteRows = snapshotRows(next);
      setSaved(JSON.stringify(remoteRows));
      setRows((current) =>
        dirty ? mergeGuideResponseRows(current, snapshot, next) : remoteRows,
      );
      setRemoteAnswerVersion((version) => version + 1);
      setSnapshot(next);
      setSavedAt(next.savedAt);
      setError('');
      return;
    }
    if (next.revision !== session.current.revision) {
      if (dirty) {
        setBlocked(true);
        setError(
          '다른 곳에서 답변이 변경됐어요. 현재 입력을 보관한 뒤 다시 열어 주세요.',
        );
        return;
      }
      session.current.revision = next.revision;
      // Reinitialize local row inputs only when adopting answers from elsewhere.
      // Saving our own answers must preserve expanded rows and editor focus.
      setRemoteAnswerVersion((version) => version + 1);
      setRows(snapshotRows(next));
      setSaved(JSON.stringify(snapshotRows(next)));
      setSavedAt(next.savedAt);
    }
    setSnapshot(next);
  }

  useEffect(() => {
    latestRemoteHandler.current = applyRemote;
  });
  const refresh = useEffectEvent(async () => {
    if (
      document.visibilityState !== 'visible' ||
      session.current.refreshing ||
      session.current.busy ||
      locked ||
      session.current.retry
    )
      return;
    session.current.refreshing = true;
    const generation = session.current.saveGeneration;
    try {
      await refreshResponseIfChanged({
        current: snapshot,
        readVersion: () => requestResponseVersion(questionnaireId, published),
        readSnapshot: () =>
          requestQuestionResponse(questionnaireId, 'GET', undefined, published),
        isCurrent: () =>
          mounted.current &&
          generation === session.current.saveGeneration &&
          !session.current.busy &&
          !session.current.retry &&
          document.visibilityState === 'visible',
        apply: (next) => {
          if (next.revision >= session.current.revision)
            latestRemoteHandler.current?.(next);
        },
      });
    } catch (error) {
      if (
        mounted.current &&
        generation === session.current.saveGeneration &&
        error instanceof QuestionnaireApiError &&
        [401, 403, 404].includes(error.status)
      ) {
        setBlocked(true);
        setError(error.message);
      }
    } finally {
      session.current.refreshing = false;
    }
  });
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(tick, 10000);
    const poll = setInterval(() => void refresh(), 30_000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      clearInterval(poll);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, []);
  return {
    submissionIssues: submissionAttempted
      ? validateResponseSubmission(snapshot, rows)
      : [],
    invalidSubmission,
    rows,
    snapshot,
    hasResponseQuestions,
    remoteAnswerVersion,
    savedAt,
    saving,
    error,
    dirty,
    locked,
    pendingSave,
    save,
    change,
  };
}

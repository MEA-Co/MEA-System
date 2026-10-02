'use client';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { useSWRConfig } from 'swr';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

import {
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
import { richTextPlainText } from '../../lib/rich-text';

import { QuestionnaireLoading } from './QuestionnaireLoading';
import { QuestionnairePreview } from './QuestionnairePreview';
import type { QuestionnaireEditorState } from './QuestionnaireView';

async function request(
  questionnaireId: string,
  method: string,
  body?: unknown,
  distributed = false,
): Promise<QuestionResponseSnapshot> {
  const response = await fetch(
    `${QUESTIONNAIRE_API}/${questionnaireId}/${distributed ? 'distributed-responses' : 'question-responses'}`,
    {
      method,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new QuestionnaireApiError(
      response.status,
      result.error ?? '답변을 처리하지 못했어요.',
    );
  return result;
}
export function QuestionResponseForm({
  questionnaireId,
  onEditorState,
  distributed = false,
}: {
  questionnaireId: string;
  distributed?: boolean;
  onEditorState?: (state: QuestionnaireEditorState) => void;
}) {
  const { mutate } = useSWRConfig();
  const [remote, setRemote] = useState<QuestionResponseSnapshot | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void request(questionnaireId, 'POST', {}, distributed)
      .then((data) => {
        if (!cancelled) {
          setRemote(data);
          if (distributed) void mutate(`${QUESTIONNAIRE_API}/unread`);
          setError('');
        }
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [questionnaireId, attempt, distributed, mutate]);
  if (!remote)
    return error ? (
      <div role="alert" className="space-y-3">
        <p>{error}</p>
        <Button onClick={() => setAttempt((v) => v + 1)}>다시 시도</Button>
      </div>
    ) : (
      <QuestionnaireLoading />
    );
  return (
    <ResponseEditor
      key={remote.id}
      questionnaireId={questionnaireId}
      initial={remote}
      distributed={distributed}
      onEditorState={onEditorState}
    />
  );
}
function ResponseEditor({
  questionnaireId,
  initial,
  onEditorState,
  distributed = false,
}: {
  questionnaireId: string;
  distributed?: boolean;
  initial: QuestionResponseSnapshot;
  onEditorState?: (state: QuestionnaireEditorState) => void;
}) {
  const { mutate } = useSWRConfig();
  const [rows, setRows] = useState(() => snapshotRows(initial));
  const [snapshot, setSnapshot] = useState(initial);
  const [remoteAnswerVersion, setRemoteAnswerVersion] = useState(0);
  const [savedAt, setSavedAt] = useState(initial.savedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [saved, setSaved] = useState(() =>
    JSON.stringify(snapshotRows(initial)),
  );
  const session = useRef({
    revision: initial.revision,
    busy: false,
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
      items.some((row) =>
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
      setRows((current) =>
        JSON.stringify(current[id]) === JSON.stringify(value)
          ? current
          : { ...current, [id]: value },
      );
    },
    [locked],
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
    if (session.current.busy || locked || (!dirty && !complete)) return;
    session.current.busy = true;
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
      const result = await request(
        questionnaireId,
        'PUT',
        pending,
        distributed,
      );
      session.current.revision = result.revision;
      setSnapshot(result);
      setSavedAt(result.savedAt);
      setSaved(JSON.stringify(pending.answers));
      session.current.retry = null;
      setPendingSave(null);
      setError('');
      if (distributed) {
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
            const latest = await request(
              questionnaireId,
              'GET',
              undefined,
              distributed,
            );
            latestRemoteHandler.current?.(latest);
            if (latest.definitionToken !== snapshot.definitionToken) {
              setError('');
              return;
            }
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
    if (next.definitionToken !== snapshot.definitionToken) {
      session.current.revision = next.revision;
      const remoteRows = snapshotRows(next);
      setSaved(JSON.stringify(remoteRows));
      setRows((current) => mergeGuideResponseRows(current, snapshot, next));
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
    if (session.current.busy || locked || session.current.retry) return;
    try {
      const next = await request(
        questionnaireId,
        'GET',
        undefined,
        distributed,
      );
      if (
        session.current.busy ||
        session.current.retry ||
        next.revision < session.current.revision
      )
        return;
      latestRemoteHandler.current?.(next);
    } catch (error) {
      if (
        error instanceof QuestionnaireApiError &&
        [401, 403, 404].includes(error.status)
      ) {
        setBlocked(true);
        setError(error.message);
      }
    }
  });
  useEffect(() => {
    const timer = setInterval(tick, 10000);
    const poll = setInterval(() => void refresh(), 5000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(timer);
      clearInterval(poll);
      window.removeEventListener('focus', focus);
    };
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4">
        <p role="status" className="text-sm text-muted-foreground">
          {saving
            ? '저장 중…'
            : dirty
              ? '작성 중 · 10초마다 자동 저장돼요.'
              : savedAt
                ? '저장 완료 · 언제든 수정할 수 있어요.'
                : '답변을 작성해 주세요.'}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={locked || saving || !dirty}
            onClick={() => void save()}
          >
            저장
          </Button>
          {distributed && (
            <Button
              disabled={locked || saving || !!pendingSave}
              onClick={() => void save(true)}
            >
              제출
            </Button>
          )}
        </div>
      </div>
      {distributed && (
        <p className="text-sm text-muted-foreground">
          저장한 답변은 본인만 볼 수 있습니다. 제출하면 리드에게 공개되며, 제출
          후에도 수정할 수 있습니다.
          {snapshot.submittedAt && (
            <span className="block mt-1">
              마지막 제출:{' '}
              {new Date(snapshot.submittedAt).toLocaleString('ko-KR')}
              {(dirty || snapshot.hasUnsubmittedChanges) &&
                ' · 수정 내용은 다시 제출해야 공개됩니다.'}
            </span>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {snapshot.sourceDeleted && (
        <p className="text-sm text-muted-foreground">
          원본 질문지가 삭제되었어요. 보관된 구성에서 내 답변을 계속 수정할 수
          있어요.
        </p>
      )}
      <QuestionnairePreview
        reviewQuestionnaireId={
          distributed || snapshot.sourceDeleted ? undefined : questionnaireId
        }
        key={remoteAnswerVersion}
        title={snapshot.title}
        sections={snapshot.sections}
        library={snapshot.questions.map((q) => q.definition)}
        showPrivateDetails={!distributed}
        response={{
          rows,
          onChange: change,
          disabled: locked || !!pendingSave?.complete,
        }}
      />
    </div>
  );
}

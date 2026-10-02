'use client';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

import {
  mergeLiveResponseRows,
  type QuestionResponseSave,
  type QuestionResponseSnapshot,
  snapshotRows,
} from '../../lib/question-responses';
import { choiceAnswerValue, scaleAnswer } from '../../lib/question-types';
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
): Promise<QuestionResponseSnapshot> {
  const response = await fetch(
    `${QUESTIONNAIRE_API}/${questionnaireId}/question-responses`,
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
}: {
  questionnaireId: string;
  onEditorState?: (state: QuestionnaireEditorState) => void;
}) {
  const [remote, setRemote] = useState<QuestionResponseSnapshot | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void request(questionnaireId, 'POST', {})
      .then((data) => {
        if (!cancelled) {
          setRemote(data);
          setError('');
        }
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [questionnaireId, attempt]);
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
      onEditorState={onEditorState}
    />
  );
}
function ResponseEditor({
  questionnaireId,
  initial,
  onEditorState,
}: {
  questionnaireId: string;
  initial: QuestionResponseSnapshot;
  onEditorState?: (state: QuestionnaireEditorState) => void;
}) {
  const [rows, setRows] = useState(() => snapshotRows(initial));
  const [snapshot, setSnapshot] = useState(initial);
  const [remoteAnswerVersion, setRemoteAnswerVersion] = useState(0);
  const [reviewRequired, setReviewRequired] = useState(
    initial.questions.some((q) => q.needsReview),
  );
  const [recovered, setRecovered] = useState<Record<string, string>>({});
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
  const dirty = JSON.stringify(rows) !== saved || !!pendingSave;
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
    if (
      session.current.busy ||
      locked ||
      reviewRequired ||
      (!dirty && !complete)
    )
      return;
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
      const result = await request(questionnaireId, 'PUT', pending);
      session.current.revision = result.revision;
      setSnapshot(result);
      setSavedAt(result.savedAt);
      setSaved(JSON.stringify(pending.answers));
      session.current.retry = null;
      setPendingSave(null);
      setError('');
      if (complete || pending.complete)
        toast.add({
          type: 'success',
          title: pending.complete
            ? '답변을 완료했어요.'
            : '이전 저장을 확인했어요. 답변 완료를 다시 눌러 주세요.',
        });
    } catch (error) {
      if (error instanceof QuestionnaireApiError && error.status < 500) {
        session.current.retry = null;
        setPendingSave(null);
        if ([401, 403, 404].includes(error.status)) setBlocked(true);
        if (error.status === 409) {
          try {
            latestRemoteHandler.current?.(
              await request(questionnaireId, 'GET'),
            );
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
    } else if (next.definitionToken !== snapshot.definitionToken) {
      const changed = next.questions.filter((q) => {
        const old = snapshot.questions.find(
          (item) => item.definition.id === q.definition.id,
        );
        return (
          old &&
          responseStructure(old.definition) !== responseStructure(q.definition)
        );
      });
      const removed = snapshot.questions.filter(
        (old) =>
          !next.questions.some((q) => q.definition.id === old.definition.id),
      );
      if (changed.length || removed.length) {
        setRecovered((current) => ({
          ...current,
          ...Object.fromEntries(
            [...changed, ...removed].map((q) => [
              q.definition.id,
              formatRows(
                snapshot.questions.find(
                  (item) => item.definition.id === q.definition.id,
                )!.definition,
                rows[q.definition.id] ?? [],
              ),
            ]),
          ),
        }));
        if (changed.length) setReviewRequired(true);
      }
      const remoteRows = snapshotRows(next);
      setSaved(JSON.stringify(remoteRows));
      setRows((current) =>
        mergeLiveResponseRows(
          current,
          remoteRows,
          changed.map((q) => q.definition.id),
        ),
      );
    }
    setSnapshot(next);
    if (
      next.questions.some((q) => q.needsReview) &&
      next.definitionToken !== snapshot.definitionToken
    )
      setReviewRequired(true);
  }
  useEffect(() => {
    latestRemoteHandler.current = applyRemote;
  });
  const refresh = useEffectEvent(async () => {
    if (session.current.busy || locked || session.current.retry) return;
    try {
      const next = await request(questionnaireId, 'GET');
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
        <Button
          variant="outline"
          disabled={locked || saving || reviewRequired || !dirty}
          onClick={() => void save()}
        >
          저장
        </Button>
      </div>
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
      {reviewRequired && (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
        >
          <p>
            질문의 답변 구조가 변경됐어요. 이전 답변을 확인한 뒤 새 구조로
            작성해 주세요. 이전 답변은 보관됩니다.
          </p>
          <Button
            onClick={() => {
              setReviewRequired(false);
              setError('');
            }}
          >
            확인하고 새 구조로 작성
          </Button>
        </div>
      )}
      {snapshot.questions
        .filter(
          (q) =>
            q.needsReview ||
            q.previousResponses.length ||
            recovered[q.definition.id],
        )
        .map((q) => (
          <details key={q.responseId} className="rounded-xl border p-4 text-sm">
            <summary>이전 답변 · {q.definition.title || '질문'}</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all">
              {[
                q.needsReview ? formatRows(q.previousDefinition, q.rows) : '',
                ...q.previousResponses.map((item) =>
                  formatRows(item.definition, item.rows),
                ),
                recovered[q.definition.id]
                  ? `구조 변경 전 작성 중인 입력:\n${recovered[q.definition.id]}`
                  : '',
              ]
                .filter(Boolean)
                .join('\n\n')}
            </pre>
          </details>
        ))}
      {Object.entries(recovered)
        .filter(
          ([id, value]) =>
            value && !snapshot.questions.some((q) => q.definition.id === id),
        )
        .map(([id, value]) => (
          <details key={id} className="rounded-xl border p-4 text-sm">
            <summary>질문지에서 제외된 질문의 작성 중인 답변</summary>
            <p className="mt-2 text-muted-foreground">
              필요한 내용을 복사할 수 있도록 이 화면에 보관했어요.
            </p>
            <pre className="mt-2 whitespace-pre-wrap break-all">{value}</pre>
          </details>
        ))}
      <QuestionnairePreview
        reviewQuestionnaireId={
          snapshot.sourceDeleted ? undefined : questionnaireId
        }
        key={remoteAnswerVersion}
        title={snapshot.title}
        sections={snapshot.sections}
        library={snapshot.questions.map((q) => q.definition)}
        showPrivateDetails
        response={{
          rows,
          onChange: change,
          disabled: locked || reviewRequired || !!pendingSave?.complete,
        }}
      />
    </div>
  );
}

function responseStructure(
  definition: QuestionResponseSnapshot['questions'][number]['definition'],
) {
  const {
    fields,
    row_mode,
    min_rows,
    max_rows,
    source_block_id,
    source_field_id,
    after_block_id,
    condition,
  } = definition;
  return JSON.stringify({
    fields: fields
      .map(({ label, choiceStyle, explorationRecommended, ...schema }) => {
        void label;
        void choiceStyle;
        void explorationRecommended;
        return schema;
      })
      .sort((a, b) => a.id.localeCompare(b.id)),
    row_mode,
    min_rows,
    max_rows,
    source_block_id,
    source_field_id,
    after_block_id,
    condition,
  });
}

function formatRows(
  definition: QuestionResponseSnapshot['questions'][number]['definition'],
  rows: PreviewAnswerRow[],
) {
  return rows
    .flatMap((row, index) =>
      definition.fields.map((field) => {
        const raw = row.answers[field.id] ?? '';
        let value = raw;
        if (field.kind === 'text') value = richTextPlainText(raw);
        else if (field.kind === 'scale') {
          const answer = scaleAnswer(raw);
          value = [answer.score == null ? '' : `${answer.score}점`, answer.text]
            .filter(Boolean)
            .join(' · ');
        } else if (field.kind === 'single' || field.kind === 'multiple') {
          const answer = choiceAnswerValue(raw, field.kind === 'multiple');
          value = [
            ...answer.choices.map((choice) =>
              typeof choice === 'string'
                ? (field.options?.find((option) => option.id === choice)
                    ?.label ?? '이전 선택지')
                : choice.text,
            ),
            answer.text,
          ]
            .filter(Boolean)
            .join(', ');
        }
        return `${index + 1} · ${field.label}: ${value || '미입력'}`;
      }),
    )
    .join('\n');
}

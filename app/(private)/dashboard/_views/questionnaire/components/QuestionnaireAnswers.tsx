'use client';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';

import {
  AnswerSessionState,
  type AnswerSnapshot as Snapshot,
} from '../lib/answer-session';
import {
  QUESTIONNAIRE_API,
  useQuestionnaireApi,
  useQuestionnaireResource,
} from '../lib/api-client';
import { richTextPlainText } from '../lib/rich-text';

import { QuestionnaireLoading } from './QuestionnaireLoading';

const AnswersContext = createContext<{
  answers: Record<string, string>;
  locked: boolean;
  change: (id: string, value: string) => void;
} | null>(null);
export function useAnswers() {
  const value = useContext(AnswersContext);
  if (!value) throw new Error('Answer provider missing');
  return value;
}
export function QuestionnaireAnswers({
  versionId,
  questionIds,
  children,
}: {
  versionId: string;
  questionIds: string[];
  children: ReactNode;
}) {
  const { data, error } = useQuestionnaireResource<Snapshot>(
    `/${versionId}/answers`,
  );
  if (!data)
    return error ? (
      <p role="alert">{error.message}</p>
    ) : (
      <QuestionnaireLoading />
    );
  return (
    <AnswerSession
      key={versionId}
      versionId={versionId}
      remote={{
        ...data,
        answers: Object.fromEntries(
          questionIds.map((id) => [id, data.answers[id] ?? '']),
        ),
      }}
      unavailable={!!error}
    >
      {children}
    </AnswerSession>
  );
}
function AnswerSession({
  versionId,
  remote,
  unavailable,
  children,
}: {
  versionId: string;
  remote: Snapshot;
  unavailable: boolean;
  children: ReactNode;
}) {
  const { refresh } = useQuestionnaireApi();
  const [answers, setAnswers] = useState(remote.answers);
  const [status, setStatus] = useState(remote.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [savedAt, setSavedAt] = useState(remote.savedAt);
  const [s] = useState(() => new AnswerSessionState(remote));
  const dirty = JSON.stringify(answers) !== s.saved || !!s.retry;
  const locked = status === 'submitted' || unavailable || s.blocked;
  const applyRemote = useEffectEvent(() => {
    if (s.busy || remote.revision <= s.revision) return;
    if (dirty) {
      s.block();
      setError(
        '다른 창에서 답변이 변경되거나 완료됐어요. 현재 입력은 보존했습니다. 내용을 복사한 뒤 다시 열어 주세요.',
      );
      if (remote.status === 'submitted') setStatus('submitted');
      return;
    }
    s.acceptRemote(remote);
    setAnswers(remote.answers);
    setStatus(remote.status);
    setSavedAt(remote.savedAt);
  });
  useEffect(() => {
    // Reconcile an external SWR snapshot without overwriting unsaved input.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyRemote();
  }, [remote.revision, saving]);
  async function save(complete = false, manual = true) {
    if (s.busy || locked) return;
    if (!complete && !dirty) return;
    if (
      complete &&
      (!Object.keys(answers).length ||
        Object.values(answers).some((v) => !richTextPlainText(v).trim()))
    ) {
      setError('모든 질문에 답변을 입력해 주세요.');
      return;
    }
    const request = s.begin(answers, complete, () => crypto.randomUUID());
    if (!request) return;
    setSaving(true);
    const id = toast.add({
      type: 'loading',
      title: request.complete
        ? '답변을 완료하고 있어요.'
        : manual
          ? '답변을 저장하고 있어요.'
          : '답변을 자동 저장하고 있어요.',
      timeout: 0,
    });
    try {
      const response = await fetch(
        `${QUESTIONNAIRE_API}/${versionId}/answers`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) {
          s.clearRetry();
          if ([401, 403, 404, 409].includes(response.status)) s.block();
        }
        throw new Error(result.error ?? '답변을 저장하지 못했어요.');
      }
      s.accept(result.revision, request);
      setSavedAt(result.savedAt);
      setStatus(result.status);
      setError('');
      if (request.complete) setOpen(false);
      else if (complete)
        setError(
          '이전 저장을 확인했어요. 최신 답변으로 답변 완료를 다시 눌러 주세요.',
        );
      toast.update(id, {
        type: 'success',
        title: request.complete ? '답변을 완료했어요.' : '답변을 저장했어요.',
        timeout: 2000,
      });
      void refresh().catch(() => {});
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : '저장 결과를 확인하지 못했어요. 다시 저장해 주세요.';
      setError(message);
      toast.update(id, { type: 'error', title: message, timeout: 6000 });
    } finally {
      s.finish();
      setSaving(false);
    }
  }
  const autoSave = useEffectEvent(() => {
    if (dirty && !locked) void save(false, false);
  });
  useEffect(() => {
    const timer = setInterval(autoSave, 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!dirty && !saving) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a =
        e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (
        a instanceof HTMLAnchorElement &&
        a.target !== '_blank' &&
        a.href !== window.location.href &&
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
  const change = (id: string, value: string) => {
    if (!locked) setAnswers((current) => ({ ...current, [id]: value }));
  };
  return (
    <AnswersContext.Provider
      value={{
        answers,
        locked: locked || !!s.retry?.complete || (saving && open),
        change,
      }}
    >
      <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4">
        <p className="text-sm text-muted-foreground">
          {status === 'submitted'
            ? '답변 완료 · 더 이상 수정할 수 없어요.'
            : saving
              ? '저장 중…'
              : dirty
                ? '작성 중 · 10초마다 자동 저장돼요.'
                : savedAt
                  ? '저장 완료'
                  : '답변을 작성해 주세요.'}
        </p>
        {status !== 'submitted' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={saving || locked || !dirty}
              onClick={() => void save()}
            >
              저장
            </Button>
            <Button disabled={saving || locked} onClick={() => setOpen(true)}>
              답변 완료
            </Button>
          </div>
        )}
      </div>
      {(error || unavailable) && (
        <p
          role="alert"
          className="mx-auto mb-4 max-w-4xl text-sm text-destructive"
        >
          {error || '질문지 상태를 확인하지 못했어요. 연결을 확인해 주세요.'}
        </p>
      )}
      {children}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!saving) setOpen(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>답변을 완료할까요?</DialogTitle>
            <DialogDescription>
              현재 답변을 저장하고 완료 처리합니다. 완료 후에는 답변을 수정할 수
              없어요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button disabled={saving || locked} onClick={() => void save(true)}>
              {saving ? '처리 중' : '답변 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AnswersContext.Provider>
  );
}

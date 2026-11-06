import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { type Draft, postRound, type Topic } from '../lib/rounds';

export function QuestionEditor({
  topic,
  onClose,
  onStart,
}: {
  topic?: Topic;
  onClose: () => void;
  onStart: (d: Draft) => void;
}) {
  const [raw, setRaw] = useState(topic?.question || ''),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const generate = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setError('고민을 입력해 주세요.');
        return;
      }
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      setBusy(true);
      setError('');
      try {
        const next = await postRound<Draft>(
          'question-draft',
          { raw: (topic ? topic.theme + '에 관한 고민: ' : '') + text.trim() },
          controller.signal,
        );
        if (!controller.signal.aborted) setDraft(next);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : '초안을 만들지 못했습니다.',
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    },
    [topic],
  );
  // Start a weekly draft once when this dialog opens. Cleanup cancels an obsolete request.
  useEffect(() => {
    const timer = topic
      ? setTimeout(() => generate(topic.question), 0)
      : undefined;
    return () => {
      clearTimeout(timer);
      pending.current?.abort();
    };
  }, [topic, generate]);
  function submit() {
    if (!draft) return;
    const q = draft.q.trim(),
      opts = draft.opts.map((o) => o.trim());
    if (!q || opts.some((o) => !o) || new Set(opts).size !== opts.length) {
      setError('질문과 서로 다른 선택지를 입력해 주세요.');
      return;
    }
    onStart({ q, opts });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>
            {draft ? '질문과 선택지를 확인해 주세요' : '멘토에게 질문하기'}
          </DialogTitle>
          <DialogDescription>
            {topic
              ? topic.week + ' · ' + topic.theme
              : draft
                ? '질문과 선택지는 자유롭게 수정할 수 있어요.'
                : '고민을 적으면 MEA가 비교하기 쉬운 질문과 선택지로 정리해 드려요.'}
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="round-question">멘토에게 물어볼 질문</Label>
              <Textarea
                id="round-question"
                maxLength={180}
                value={draft.q}
                onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>선택지</Label>
              {draft.opts.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-semibold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <Textarea
                    rows={2}
                    className="min-h-12 flex-1 resize-y"
                    aria-label={'선택지 ' + (i + 1)}
                    maxLength={65}
                    value={o}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        opts: draft.opts.map((v, j) =>
                          j === i ? e.target.value : v,
                        ),
                      })
                    }
                  />
                  {draft.opts.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={'선택지 ' + (i + 1) + ' 삭제'}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          opts: draft.opts.filter((_, j) => j !== i),
                        })
                      }
                    >
                      삭제
                    </Button>
                  )}
                </div>
              ))}
              {draft.opts.length < 5 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({ ...draft, opts: [...draft.opts, ''] })
                  }
                >
                  선택지 추가
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="round-raw">어떤 고민이 있나요?</Label>
            <Textarea
              id="round-raw"
              maxLength={1200}
              placeholder="예: 수학 개념은 이해되는데 문제를 풀 때 막혀요. 강의를 다시 들을지, 틀린 문제를 분석할지 고민이에요."
              className="min-h-32"
              readOnly={busy}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              학년, 목표, 지금 어려운 점을 함께 적으면 더 구체적으로 비교할 수
              있어요.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {busy && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm leading-6"
          >
            <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" />
            MEA의 전략을 적용하는 중입니다
          </p>
        )}
        <DialogFooter>
          {draft ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(null);
                  setError('');
                }}
              >
                고민 다시 쓰기
              </Button>
              <Button onClick={submit}>멘토 투표 시작하기</Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  pending.current?.abort();
                  setBusy(false);
                  setError('');
                  setDraft({ q: raw.slice(0, 180), opts: ['', ''] });
                }}
              >
                선택지 직접 쓰기
              </Button>
              <Button disabled={busy} onClick={() => generate(raw)}>
                {busy ? '질문을 정리하고 있어요…' : '질문과 선택지 만들기'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

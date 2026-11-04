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
        <DialogHeader>
          <DialogTitle>
            {draft ? '투표 질문 검토' : '새 질문 만들기'}
          </DialogTitle>
          <DialogDescription>
            {topic
              ? topic.week + ' · ' + topic.theme
              : '내 고민으로 멘토라운드를 시작하세요.'}
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="round-question">투표할 질문</Label>
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
              readOnly={busy}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              고민을 OpenAI에 보내 질문과 선택지 초안을 만듭니다.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
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
                고민 입력으로
              </Button>
              <Button onClick={submit}>28명 투표 시작</Button>
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
                직접 작성하기
              </Button>
              <Button disabled={busy} onClick={() => generate(raw)}>
                {busy
                  ? 'MEA의 전략을 적용하는 중입니다'
                  : '질문과 선택지 만들기'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  confidenceDescription,
  strategyLabel,
  uniqueSourcePairs,
} from '../lib/presentation';
import type { Ballot, SourcePair } from '../lib/rounds';

import { DecisionExplanation, PersonaDetails } from './PersonaEvidenceDetails';

function SourcePairs({ sources }: { sources: SourcePair[] }) {
  return (
    <div className="space-y-4">
      {uniqueSourcePairs(sources).map(({ summary, question, quote }, index) => (
        <article
          key={question + quote + index}
          className="overflow-hidden rounded-lg border"
        >
          <div className="space-y-2 bg-muted/50 p-4 sm:p-5">
            <p className="text-xs font-semibold text-muted-foreground">
              멘토가 받았던 질문 {index + 1}
            </p>
            <p className="whitespace-pre-wrap break-words text-[15px] font-medium leading-7">
              {question}
            </p>
          </div>
          <div className="space-y-2 p-4 sm:p-5">
            <p className="text-xs font-semibold text-muted-foreground">
              멘토의 답변 · 일부 발췌
            </p>
            <blockquote className="whitespace-pre-wrap break-words text-[15px] leading-8">
              {quote}
            </blockquote>
          </div>
          {summary && (
            <details className="border-t px-4 py-3 sm:px-5">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                경험 요약 보기
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
                {summary}
              </p>
            </details>
          )}
        </article>
      ))}
    </div>
  );
}

function RecheckSource({
  busy,
  error,
  run,
}: {
  busy: boolean;
  error: string;
  run: () => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={run}>
        {busy ? (
          <LoaderCircle className="motion-safe:animate-spin" />
        ) : (
          <RefreshCw />
        )}
        {busy ? '답변 원문을 확인하고 있어요…' : '답변 원문 찾아보기'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function MentorEvidenceDialog({
  open,
  onOpenChange,
  tag,
  name,
  ballot,
  choices,
  onRecheck,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: NonNullable<Ballot['applied']>[number];
  name: string;
  ballot: Ballot;
  choices: string[];
  onRecheck: () => Promise<void>;
}) {
  // Keep request state outside the portal so closing/reopening cannot restart it.
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false);
  async function run() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onRecheck();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : '답변 원문을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const support = ballot.support;
  const current = Boolean(
    ballot.explanation && ballot.explanation.version !== '1',
  );
  const allSources = uniqueSourcePairs(ballot.sources ?? []);
  const sources = tag?.sourceRefs?.length
    ? allSources.filter(
        (source) => source.id && tag.sourceRefs!.includes(source.id),
      )
    : allSources;
  const checkedSources = uniqueSourcePairs(support?.sources ?? []);
  const hasCheckedEvidence =
    checkedSources.length > 0 || Boolean(support?.quotes?.length);
  const showRecheck =
    !current && !support?.sources && (ballot.choice ?? -1) >= 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg leading-7">
            {name} 멘토의 실제 답변
          </DialogTitle>
          <DialogDescription className="leading-6">
            {sources.length || hasCheckedEvidence
              ? '멘토가 이전에 작성한 답변에서 관련 부분을 가져왔어요.'
              : '이 의견과 관련된 멘토의 실제 경험을 확인하는 곳이에요.'}
          </DialogDescription>
        </DialogHeader>
        {tag && (
          <Badge
            variant="highlight"
            className="h-auto max-w-full justify-self-start whitespace-normal"
          >
            {strategyLabel(tag.label)}
          </Badge>
        )}
        {sources.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">
              이번 선택에 참고한 답변 {sources.length}개
            </h3>
            <SourcePairs sources={sources} />
          </section>
        ) : (
          !hasCheckedEvidence && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-4 text-sm leading-7">
              <p className="font-medium">
                {current
                  ? '이 질문과 연결된 원문이 없어요'
                  : '아직 연결된 원문이 없어요'}
              </p>
              <p className="text-muted-foreground">
                {current
                  ? '지금은 멘토의 직접적인 경험을 함께 보여드리기 어려워요.'
                  : '예전에 저장한 의견에는 멘토의 실제 답변이 함께 저장되지 않았어요.'}
              </p>
            </div>
          )
        )}
        {!current && hasCheckedEvidence && (
          <section className="space-y-3">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                의견과 비교해 본 멘토 답변
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                의견을 만든 뒤 원문과 비교한 결과예요. 처음 참고한 자료와 다를
                수 있어요.
              </p>
              {support && (
                <Badge
                  variant={
                    support.level === '상'
                      ? 'success'
                      : support.level === '중'
                        ? 'highlight'
                        : 'subtle'
                  }
                >
                  원문 근거 {support.level} · {confidenceDescription(support)}
                </Badge>
              )}
            </div>
            {checkedSources.length ? (
              <SourcePairs sources={checkedSources} />
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  이 기록에는 질문 없이 답변 일부만 남아 있어요.
                </p>
                {support?.quotes?.map((quote, i) => (
                  <blockquote
                    key={i}
                    className="whitespace-pre-wrap break-words rounded-lg border p-4 text-[15px] leading-8"
                  >
                    {quote}
                  </blockquote>
                ))}
              </div>
            )}
          </section>
        )}
        {!current && support?.sources && !hasCheckedEvidence && (
          <p className="text-sm leading-7 text-muted-foreground">
            멘토의 답변에서 이 의견을 직접 뒷받침하는 내용을 찾지 못했어요.
          </p>
        )}
        {showRecheck && <RecheckSource busy={busy} error={error} run={run} />}
        {ballot.explanation?.version === '1' && (
          <DecisionExplanation ballot={ballot} choices={choices} />
        )}
        {current && ballot.persona && (
          <details className="border-t pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              이 멘토의 다른 경험
            </summary>
            <div className="mt-4">
              <PersonaDetails persona={ballot.persona} />
            </div>
          </details>
        )}
        <p className="border-t pt-4 text-xs leading-6 text-muted-foreground">
          조언의 바탕이 된 멘토의 과거 경험이에요. 내 상황과 비교하며
          읽어보세요.
        </p>
      </DialogContent>
    </Dialog>
  );
}

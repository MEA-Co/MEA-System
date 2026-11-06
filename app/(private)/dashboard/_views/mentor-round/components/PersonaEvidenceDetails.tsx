import { Badge } from '@/components/ui/badge';

import { strategyLabel } from '../lib/presentation';
import type { Ballot, PersonaSnapshot, SourcePair } from '../lib/rounds';
const componentLabels = {
  strategy: '전략',
  skill: '공부·탐구 방법',
  experience: '경험',
};
export function PersonaDetails({ persona }: { persona: PersonaSnapshot }) {
  return (
    <div className="space-y-3">
      <ul className="space-y-4">
        {persona.components.map((component) => (
          <li key={component.id} className="space-y-1">
            <Badge
              variant={component.kind === 'strategy' ? 'highlight' : 'subtle'}
              className="h-auto whitespace-normal text-left"
            >
              {componentLabels[component.kind]} ·{' '}
              {strategyLabel(component.label)}
            </Badge>
            <p className="text-sm leading-7">{component.statement}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function SourcePairs({ sources }: { sources: SourcePair[] }) {
  return (
    <div className="mt-3 space-y-3">
      {sources.map(({ summary, question, quote }) => (
        <dl
          key={question + quote}
          className="space-y-1 border-l-2 border-brand pl-3 text-sm leading-relaxed"
        >
          <dt className="text-xs font-medium text-muted-foreground">
            경험 요약
          </dt>
          <dd>{summary}</dd>
          <dt className="pt-1 text-xs font-medium text-muted-foreground">
            멘토가 받았던 질문
          </dt>
          <dd className="whitespace-pre-line">{question}</dd>
          <dt className="pt-1 text-xs font-medium text-muted-foreground">
            멘토의 답변 · 일부 발췌
          </dt>
          <dd>
            <blockquote className="whitespace-pre-line">{quote}</blockquote>
          </dd>
        </dl>
      ))}
    </div>
  );
}
export function CitationSources({
  refs,
  sources,
}: {
  refs: string[];
  sources: SourcePair[];
}) {
  const matched = sources.filter(
    (source) => source.id && refs.includes(source.id),
  );
  return (
    <div className="mt-2 text-xs">
      {matched.length > 0 && (
        <details>
          <summary className="cursor-pointer underline">
            참고한 멘토 답변 {matched.length}개 보기
          </summary>
          <SourcePairs sources={matched} />
        </details>
      )}
      {refs.length > matched.length && (
        <p className="text-muted-foreground">
          참고한 답변 중 {refs.length - matched.length}개는 원문이 저장되어 있지
          않아요.
        </p>
      )}
    </div>
  );
}
export function DecisionExplanation({
  ballot,
  choices,
}: {
  ballot: Ballot;
  choices: string[];
}) {
  const explanation = ballot.explanation;
  if (!explanation)
    return (
      <p className="text-xs text-muted-foreground">
        이 답변에는 자세한 선택 이유가 저장되어 있지 않아요.
      </p>
    );
  return (
    <details className="rounded-md border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        선택 이유 더 보기
      </summary>
      <div className="mt-3 space-y-4">
        <ol className="list-decimal space-y-4 pl-5">
          <li>
            <p className="font-medium">질문에서 살펴본 점</p>
            <p className="mt-1 leading-relaxed">{explanation.context}</p>
          </li>
          <li>
            <p className="font-medium">참고한 전략과 방법</p>
            {explanation.criteria.length ? (
              <ul className="mt-2 space-y-3">
                {explanation.criteria.map((criterion) => (
                  <li key={criterion.componentId}>
                    <Badge
                      variant="subtle"
                      className="h-auto whitespace-normal text-left"
                    >
                      {strategyLabel(criterion.label)}
                    </Badge>
                    <p className="mt-1 leading-relaxed">
                      {criterion.application}
                    </p>
                    <CitationSources
                      refs={criterion.sourceRefs}
                      sources={ballot.sources ?? []}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted-foreground">
                이 질문과 직접 연결되는 경험을 찾지 못했어요.
              </p>
            )}
          </li>
          <li>
            <p className="font-medium">다른 선택지와의 비교</p>
            <ul className="mt-2 space-y-2">
              {explanation.alternatives.map((alternative) => (
                <li key={alternative.choice}>
                  <p className="font-medium">
                    {choices[alternative.choice] ?? '선택지 정보 없음'}
                  </p>
                  <p className="leading-relaxed">{alternative.tradeoff}</p>
                </li>
              ))}
            </ul>
          </li>
          <li>
            <p className="font-medium">이렇게 제안했어요</p>
            <p className="mt-1 leading-relaxed">{explanation.conclusion}</p>
          </li>
        </ol>
        {explanation.caveats.length > 0 && (
          <div>
            <p className="font-medium">함께 생각해 볼 점</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              {explanation.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </div>
        )}
        {ballot.persona && (
          <details className="border-t pt-3">
            <summary className="cursor-pointer font-medium">
              이 멘토의 다른 경험
            </summary>
            <div className="mt-3">
              <PersonaDetails persona={ballot.persona} />
            </div>
          </details>
        )}
      </div>
    </details>
  );
}

import { LoaderCircle } from 'lucide-react';

import type { ComparisonResponse } from '@/features/subject-selection/comparison';

export function ComparisonExplanationLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 space-y-3 border-t pt-3"
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
        />
        AI 설명을 불러오는 중이에요…
      </p>
      <div aria-hidden="true" className="space-y-2 motion-safe:animate-pulse">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

export function ComparisonExplanation({
  explanation,
  current = false,
}: {
  explanation: ComparisonResponse['comparisons'][number];
  current?: boolean;
}) {
  const sections = current
    ? [['현재 과목과 전공', explanation.currentConnection]]
    : [
        ['대안 과목과 전공', explanation.alternativeConnection],
        ['교체 시 고려할 점', explanation.tradeoff],
        ['선택 기준', explanation.decisionGuide],
      ];
  return (
    <div className="mt-4 space-y-3 border-t pt-3">
      <p className="text-xs font-medium text-emerald-700">AI 비교 설명</p>
      {sections.map(([title, text]) => (
        <div key={title}>
          <h4 className="text-xs font-semibold">{title}</h4>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
            {text}
          </p>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        전공 연결은 탐구 방향의 제안이며, 대학 평가 결과를 보장하지 않아요. 최종
        선택은 학생이 결정해 주세요.
      </p>
    </div>
  );
}

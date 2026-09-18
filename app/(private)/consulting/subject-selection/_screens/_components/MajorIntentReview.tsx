'use client';

import { ArrowRight } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';

import type { MajorReviewScreening } from '../../_lib/major-review-screening';

export function MajorIntentReview({
  primary,
  secondary,
  screening,
  onDecision,
  onViewStandard,
}: {
  primary: string;
  secondary: string;
  screening: MajorReviewScreening;
  onDecision: (ready: boolean) => void;
  onViewStandard: () => void;
}) {
  const radioName = useId();
  const [intent, setIntent] = useState<
    'parallel' | 'extension' | 'undecided' | null
  >(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!screening.worthReviewing)
    return (
      <section
        className="space-y-3 border-y py-5"
        aria-label="병행 준비 사전 검토"
      >
        <h3 className="font-semibold">우선 {primary} 중심의 준비를 추천해요</h3>
        <ul className="list-disc space-y-2 pl-5 text-sm text-amber-800">
          {screening.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          현재 편제와 내부 과목 기준에 따른 권고예요. 기존 전공의 기본 추천안을
          보거나 다른 학과를 검토해 주세요.
        </p>
        <Button onClick={onViewStandard}>
          <ArrowRight />
          {primary} 기본 추천안 보기
        </Button>
      </section>
    );

  return (
    <section
      className="space-y-4 border-y py-5"
      aria-label="복수 학과 지원 의향 확인"
    >
      <h3 className="font-semibold">{secondary}에도 지원할 생각이 있나요?</h3>
      <p className="text-sm leading-6 text-muted-foreground">
        구체적인 탐구 주제나 활동 계획은 아직 없어도 괜찮아요. {primary} 준비를
        유지하면서 어떤 과목을 더 듣거나 바꿔야 하는지 먼저 확인할 수 있어요.
      </p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!intent) return;
          setConfirmed(true);
          onDecision(intent !== 'extension');
        }}
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">추가 학과 지원 의향</legend>
          {(
            [
              ['parallel', '그 학과 자체에도 관심이 있어 실제 지원을 고려해요'],
              [
                'extension',
                '지원보다는 기존 전공의 탐구를 넓히는 데 활용하고 싶어요',
              ],
              [
                'undecided',
                '아직 모르겠어요. 필요한 과목 변경을 보고 판단할래요',
              ],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name={radioName}
                value={value}
                checked={intent === value}
                onChange={() => {
                  setIntent(value);
                  setConfirmed(false);
                  onDecision(false);
                }}
                className="mt-0.5"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={!intent}>
          <ArrowRight />
          {intent === 'extension' ? '확인' : '과목 조정 검토로 계속'}
        </Button>
      </form>
      {confirmed && (
        <div
          role="status"
          className="space-y-3 border-l-4 border-emerald-500 bg-emerald-50 p-4 text-sm leading-6"
        >
          {intent === 'extension' ? (
            <>
              <p>
                지금은 {primary} 중심으로 준비하면서 관심 분야를 탐구에 보태는
                방향을 추천해요.
              </p>
              <Button onClick={onViewStandard}>
                <ArrowRight />
                {primary} 기본 추천안 보기
              </Button>
            </>
          ) : (
            <p>
              아래에서 과목 조정안을 찾아보세요. 추가되는 과목과 빠지는 과목을
              보고,
              {primary} 공부와 함께 {secondary}의 기초·심화 과목도 준비할 수
              있을지 판단해 주세요. 변경안에 동의하기 전에는 기존 선택을
              유지합니다.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

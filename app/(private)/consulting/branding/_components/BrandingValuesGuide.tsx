'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';

import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { Button } from '@/components/ui/button';

const messages: readonly ConsultingPrompterMessage[] = [
  {
    segments: [
      {
        text: '전공 키워드를 정했다면, 다음 단계는 각 키워드에 여러분만의 생각을 더하는 것입니다. 어떤 키워드에 관심이 있는지에서 한 걸음 더 나아가, ',
      },
      { text: '그 키워드가 왜 중요한지', emphasis: 'accent' },
      { text: ' 생각해볼 거예요.' },
    ],
  },
  {
    segments: [
      {
        text: '같은 키워드여도, 무엇을 중요하게 생각하는지에 따라 학생의 스토리는 달라집니다.',
      },
    ],
  },
  {
    segments: [
      {
        text: 'MEA는 이렇게 키워드에서 한 걸음 나아가 학생만의 생각을 더한 것을 ',
      },
      { text: '“전공 가치관”', emphasis: 'accent' },
      { text: '이라고 부릅니다.' },
    ],
  },
  {
    segments: [
      {
        text: '한 번도 생각해본 적 없는 것이라 어려울 수 있겠지만, 여러분이 그 키워드에 왜 관심이 있는지 잘 생각해보세요. 특히, 그 키워드와 관련된 여러 문제들 중 ',
      },
      { text: '어떤 문제를 해결해보고 싶은지', emphasis: 'accent' },
      { text: ' 생각해보면, 전공 가치관을 설정하기가 한결 쉬워질 거예요.' },
    ],
  },
  {
    segments: [
      { text: '지금부터 MEA와 대화를 나누며 여러분의 생각을 정리해봅시다.' },
    ],
  },
];

const examples = [
  '신약 개발 시 환경에 가해지는 부담을 줄이기 위해 고민하는',
  '신약의 안정성을 최우선으로 생각하는',
  '약이 사회 구성원 모두에게 접근성이 높아야 한다고 생각하는',
  '신약을 개발하는 속도를 높이려 하는',
];

export function BrandingValuesGuide({
  onStart,
  onBack,
}: {
  onStart: () => void;
  onBack: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const canContinue =
    ready && (index !== 1 || revealed.length === examples.length);
  const next = () => {
    if (!canContinue) return;
    if (index === messages.length - 1) onStart();
    else {
      setReady(false);
      setIndex(index + 1);
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ConsultingPrompter
        key={index}
        appearance="flat"
        animateTyping
        onTypingComplete={() => setReady(true)}
        onNext={canContinue ? next : undefined}
        message={messages[index]}
      >
        <Button
          variant="outline"
          onClick={() => {
            if (index === 0) onBack();
            else {
              setReady(false);
              setIndex(index - 1);
            }
          }}
        >
          <ArrowLeft aria-hidden="true" />
          이전
        </Button>
        <Button
          disabled={!canContinue}
          onClick={next}
          className="bg-violet-700 text-white hover:bg-violet-800"
        >
          {index === messages.length - 1 ? '가치관 대화 시작하기' : '다음'}
          <ArrowRight aria-hidden="true" />
        </Button>
      </ConsultingPrompter>
      {index === 1 && (
        <section
          aria-label="같은 키워드, 서로 다른 전공 가치관"
          className="space-y-4"
        >
          <p className="text-center text-sm text-slate-600" aria-live="polite">
            가려진 전공 가치관을 하나씩 눌러 확인해보세요. ({revealed.length}/
            {examples.length})
          </p>
          <div className="space-y-3">
            {examples.map((example, exampleIndex) => {
              const isRevealed = revealed.includes(exampleIndex);
              return (
                <article
                  key={example}
                  className="flex flex-col gap-4 rounded-xl border border-violet-100 bg-white p-5 md:flex-row md:items-center"
                >
                  <button
                    type="button"
                    aria-expanded={isRevealed}
                    aria-controls={`values-example-${exampleIndex}`}
                    aria-label={
                      isRevealed
                        ? `전공 가치관 ${exampleIndex + 1}: ${example}`
                        : `전공 가치관 ${exampleIndex + 1} 열기`
                    }
                    onClick={() =>
                      setRevealed((current) =>
                        current.includes(exampleIndex)
                          ? current
                          : [...current, exampleIndex],
                      )
                    }
                    className={`min-h-20 flex-1 rounded-lg px-5 py-4 text-left text-sm font-semibold leading-7 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 ${isRevealed ? 'bg-violet-50 text-violet-800' : 'cursor-pointer border border-dashed border-violet-300 bg-violet-100 text-violet-700 hover:bg-violet-200'}`}
                  >
                    <span
                      id={`values-example-${exampleIndex}`}
                      hidden={!isRevealed}
                    >
                      {example}
                    </span>
                    {!isRevealed && <span>눌러서 전공 가치관 확인하기</span>}
                  </button>
                  <p className="shrink-0 text-sm leading-7 text-slate-700 md:w-48">
                    <span className="block font-semibold">
                      약학과 희망 학생
                    </span>
                    <span className="text-slate-500">키워드: 신약 개발</span>
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

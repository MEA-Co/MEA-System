'use client';

import { ArrowRight, Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { Button } from '@/components/ui/button';

import { ResearchIllustration } from './ResearchIllustration';

const examples = {
  advanced:
    '폭이 다른 컵에서의 물의 냉각 현상을 뉴턴의 냉각 법칙에 근거하여 탐구함. 집중열용량 모델을 활용해 온도 변화가 지수함수 형태로 나타남을 이론적으로 설명하고, 냉각 상수가 물체의 표면적 및 대류 열전달계수와 비례 관계에 있음을 조사함. 폭이 다른 컵에 동일한 조건의 물을 담아 시간에 따른 온도 변화를 측정하는 실험을 설계하였으며, 뚜껑의 유무를 추가 변인으로 설정하여 실험의 정밀도를 높임. 측정한 냉각 곡선에 비선형 회귀분석을 적용하여 냉각 상수를 정량적으로 추정하였고, 이론값과 실험값 사이에 발생한 편차의 원인을 열복사 및 증발에 의한 에너지 손실과 연관 지어 분석함. 표면적과 열전달의 상관관계를 정량적으로 규명하여 물리학적 역량을 드러냄.',
  thoughtful:
    '넓은 컵의 차가 더 빨리 식는 이유가 궁금해 폭이 다른 컵에 같은 양·온도의 물을 담아 1분 간격으로 20분간 온도 변화를 측정한 결과, 지름 9cm 컵은 42℃, 6cm 컵은 51℃로 약 9℃의 차이를 확인함. 컵의 폭 외에 뚜껑 유무도 변인으로 추가하였고, 뚜껑을 덮으면 같은 폭에서도 냉각이 뚜렷하게 느려짐을 관찰함. 이 결과를 뉴턴의 냉각 법칙 T(t)=T∞+(T₀−T∞)e^(−kt)와 연결해, 표면적이 넓을수록 냉각 상수 k가 커져 온도가 더 빠르게 감소함을 논리적으로 추론함. 다만 이론값과 실측값 사이의 편차는 물 표면에서의 증발과 복사에 의한 추가적 열 손실 때문으로 해석하며, 단순 대류 모델만으로는 설명에 한계가 있음을 스스로 파악함. 이후 컵 재질에 따른 열전달 차이가 냉각 곡선에 미치는 영향을 후속 탐구로 제시함.',
  before:
    '일상 속 열의 이동을 조사하며 같은 시간 동안 둔 차도 컵에 따라 식는 정도가 다름을 관찰함. 컵의 폭, 재질, 뚜껑 유무를 비교 조건으로 정리한 뒤, 먼저 재질을 같게 하고 폭만 달리하면 어떤 차이가 생길지 질문함. 이를 확인하기 위해 물의 양과 시작 온도를 통제하고 일정한 간격으로 온도를 기록하는 실험을 계획함.',
  after:
    '폭과 뚜껑에 따른 냉각 실험에서 생긴 의문을 바탕으로 “컵의 재질이 달라지면 냉각 곡선도 달라질까?”로 탐구를 확장함. 크기와 두께가 유사한 유리·도자기·금속 컵에 같은 양과 온도의 물을 담고 뚜껑 조건을 맞추어 비교함. 냉각 곡선과 추정한 냉각 상수를 재질의 열전도 특성과 연결해 해석하되, 두께와 컵 자체의 열용량도 결과에 영향을 줄 수 있음을 검토함. 후속 실험에서는 컵의 초기 온도까지 통제할 필요가 있다고 제안함.',
};

type Scene = {
  focus: 'selected' | 'advanced' | 'thoughtful' | 'connections' | 'past' | 'ai';
  message: ConsultingPrompterMessage;
};

const openings: readonly ConsultingPrompterMessage[] = [
  {
    segments: [
      { text: '생활기록부 브랜딩 컨설팅', emphasis: 'accent' },
      { text: '에 오신 것을 환영합니다!' },
    ],
  },
  {
    segments: [{ text: '본격적으로 시작하기 전에, 한 번 생각해 봅시다!' }],
  },
  {
    segments: [
      {
        text: '둘 중 어떤 문구가 여러분의 생활기록부를 더 우수하게 만들어줄까요?',
      },
    ],
  },
];

const scenes: readonly Scene[] = [
  {
    focus: 'selected',
    message: {
      segments: [
        {
          text: '사용된 용어의 난이도, 탐구 내용이 어려운 정도, 탐구 계기, 후속 질문 등 여러분이 지금과 같은 선택을 한 데에는 여러 이유가 있을거에요.',
        },
      ],
    },
  },
  {
    focus: 'advanced',
    message: {
      segments: [
        { text: '흔히 우수한 생활기록부를 ' },
        { text: '‘난이도 있는 주제’, ‘어려운 용어’', emphasis: 'accent' },
        { text: ' 등과 연결지어 생각하는 경우가 많습니다.' },
      ],
    },
  },
  {
    focus: 'thoughtful',
    message: {
      segments: [
        { text: '하지만 지금은, ' },
        { text: '“학생만의 생각과 경험”', emphasis: 'accent' },
        { text: '을 담아내는 것이 무엇보다 중요합니다.' },
      ],
    },
  },
  {
    focus: 'thoughtful',
    message: {
      segments: [
        { text: '특히, 생성형 인공지능을 누구나 사용할 수 있는 지금, ' },
        { text: '‘어떤 주제로 탐구를 해야 하나요?’', emphasis: 'accent' },
        { text: '는 우수한 생활기록부를 만들 수 있는 질문은 아닙니다.' },
      ],
    },
  },
  {
    focus: 'past',
    message: {
      segments: [
        {
          text: '예전에는, 난이도 있는 주제를 찾아내고 이해하는 것 자체가 어려운 일이었기 때문에 그렇게 찾아낸 주제로 탐구를 하는 것이 곧 우수한 학생이 되는 방법이었습니다.',
        },
      ],
    },
  },
  {
    focus: 'ai',
    message: {
      segments: [
        {
          text: '하지만 지금은 누구나 AI에게 여러 주제들을 받아볼 수 있고, AI가 그 내용을 쉽게 풀어서 설명해주기까지 합니다.',
        },
      ],
    },
  },
  {
    focus: 'thoughtful',
    message: {
      segments: [
        {
          text: '따라서 지금 우리에게 중요한 것은, 활동의 깊이를 더하면서도 ',
        },
        { text: '“우리만의 생각”', emphasis: 'accent' },
        { text: '을 활동에 녹여내는 것입니다.' },
      ],
    },
  },
  {
    focus: 'connections',
    message: {
      segments: [
        {
          text: '그리고 하나의 활동에서뿐만 아니라 나만의 생각들이 서로 이어지고, 또 뻗어나가는 여러 활동들로 생활기록부 전체를 만든다면, 그렇게 만든 생활기록부가 곧 가장 ',
        },
        { text: '“특별하고” “우수한”', emphasis: 'accent' },
        { text: ' 생활기록부, ' },
        { text: '“대학이 뽑고 싶은”', emphasis: 'accent' },
        { text: ' 생활기록부가 됩니다.' },
      ],
    },
  },
  {
    focus: 'connections',
    message: {
      segments: [
        { text: 'MEA는 이것을 ' },
        { text: '“생활기록부 브랜딩”', emphasis: 'accent' },
        { text: '이라고 부릅니다.' },
      ],
    },
  },
  {
    focus: 'connections',
    message: {
      segments: [
        { text: '생활기록부에 ' },
        { text: '“여러분만의 브랜드”', emphasis: 'accent' },
        { text: '를 담아내는 것이죠.' },
      ],
    },
  },
  {
    focus: 'connections',
    message: {
      segments: [
        {
          text: '지금부터 여러분은 여러분의 생활기록부를 브랜딩하기 위한 준비물들을 만들어볼 것입니다.',
        },
      ],
    },
  },
];

function ExampleText({ text }: { text: string }) {
  return <p className="text-sm leading-7 break-keep text-slate-700">{text}</p>;
}

export function BrandingIntro({ onStart }: { onStart: () => void }) {
  const [choice, setChoice] = useState<'advanced' | 'thoughtful' | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [typingComplete, setTypingComplete] = useState(false);
  const scene = scenes[sceneIndex];
  const connections = choice !== null && scene.focus === 'connections';
  const reduceMotion = useReducedMotion();
  const [connectionPhase, setConnectionPhase] = useState(0);
  useEffect(() => {
    if (!connections) return;
    const move = window.setTimeout(
      () => setConnectionPhase(1),
      reduceMotion ? 0 : 400,
    );
    const reveal = window.setTimeout(
      () => setConnectionPhase(2),
      reduceMotion ? 0 : 1100,
    );
    return () => {
      window.clearTimeout(move);
      window.clearTimeout(reveal);
    };
  }, [connections, reduceMotion]);
  const illustration =
    choice !== null && (scene.focus === 'past' || scene.focus === 'ai')
      ? scene.focus
      : null;
  const [openingIndex, setOpeningIndex] = useState(0);
  const choosing = choice === null && openingIndex === openings.length - 1;
  const showExamples = choosing || choice !== null;
  const canNext = !choosing;
  function advance() {
    if (!typingComplete || !canNext) return;
    setTypingComplete(false);
    if (choice === null) setOpeningIndex((index) => index + 1);
    else if (sceneIndex === scenes.length - 1) onStart();
    else setSceneIndex((index) => index + 1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="sr-only">생활기록부 브랜딩 도입</h1>
      <ConsultingPrompter
        key={
          choice === null ? `opening-${openingIndex}` : `scene-${sceneIndex}`
        }
        appearance="flat"
        animateTyping
        message={choice === null ? openings[openingIndex] : scene.message}
        onTypingComplete={() => setTypingComplete(true)}
        onNext={typingComplete && canNext ? advance : undefined}
      >
        {canNext && (
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Space · {typingComplete ? '다음으로' : '빨리 보기'}
            </span>
            <Button
              type="button"
              disabled={!typingComplete}
              aria-keyshortcuts="Space"
              className="rounded-xl bg-violet-700 text-white hover:bg-violet-800"
              onClick={advance}
            >
              {choice !== null && sceneIndex === scenes.length - 1
                ? '시작하기'
                : '다음'}
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </ConsultingPrompter>

      {illustration ? (
        <ResearchIllustration key={illustration} era={illustration} />
      ) : !showExamples ? null : (
        <>
          <div
            className={
              connections && connectionPhase >= 1
                ? 'grid gap-4 md:grid-cols-3'
                : 'grid gap-4 md:grid-cols-2'
            }
            role="group"
            aria-label="세특 문구 비교"
          >
            {connections && connectionPhase >= 1 && (
              <motion.article
                initial={{ opacity: 0 }}
                animate={{ opacity: connectionPhase === 2 ? 1 : 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.4 }}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <p className="mb-3 flex items-center justify-between text-xs font-semibold text-violet-700">
                  선행 탐구 · 질문의 시작
                  <ArrowRight className="size-4" aria-hidden="true" />
                </p>
                <ExampleText text={examples.before} />
              </motion.article>
            )}
            {(['thoughtful', 'advanced'] as const)
              .filter(
                (id) =>
                  !(connections && connectionPhase >= 1 && id === 'advanced'),
              )
              .map((id, index) => {
                const highlighted =
                  choice !== null &&
                  (scene.focus === 'selected'
                    ? choice === id
                    : scene.focus === id ||
                      (connections && id === 'thoughtful'));
                const content = (
                  <>
                    <span className="mb-4 flex items-center justify-between gap-2 text-xs font-semibold text-violet-800">
                      <span>세특 {index === 0 ? 'A' : 'B'}</span>
                      {choice === id && (
                        <span className="inline-flex items-center gap-1">
                          <Check className="size-3.5" aria-hidden="true" />
                          내가 선택한 문구
                        </span>
                      )}
                    </span>
                    <ExampleText text={examples[id]} />
                  </>
                );
                const className = `rounded-xl border-2 p-5 text-left transition-colors motion-reduce:transition-none md:p-6 ${highlighted ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white'}`;
                return choice === null ? (
                  <button
                    key={id}
                    type="button"
                    disabled={!typingComplete}
                    onClick={() => {
                      setChoice(id);
                      setTypingComplete(false);
                    }}
                    className={`${className} cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {content}
                    <span className="mt-5 flex items-center gap-2 text-sm font-semibold text-violet-700">
                      이 문구 선택하기
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </span>
                  </button>
                ) : (
                  <motion.article
                    layout
                    key={id}
                    animate={{
                      opacity: connections && id === 'advanced' ? 0 : 1,
                    }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.4,
                      layout: { duration: reduceMotion ? 0 : 0.65 },
                    }}
                    className={className}
                  >
                    {content}
                  </motion.article>
                );
              })}
            {connections && connectionPhase >= 1 && (
              <motion.article
                initial={{ opacity: 0 }}
                animate={{ opacity: connectionPhase === 2 ? 1 : 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.4 }}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-violet-700">
                  <ArrowRight className="size-4" aria-hidden="true" />
                  후속 탐구 · 다음 질문으로
                </p>
                <ExampleText text={examples.after} />
              </motion.article>
            )}
          </div>
          {choice === null && (
            <p className="text-center text-xs text-muted-foreground">
              이해를 돕기 위해 작성한 가상의 예시입니다.
            </p>
          )}
        </>
      )}
    </div>
  );
}

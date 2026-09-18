'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';

import { type MajorList } from '../_lib/plan';

export { MajorOverviews } from './MajorOverviews';

const messages = [
  '좋습니다. 여러분만의 이야기를 하려면, 희망 전공에서 한 걸음 더 나아가 전공별로 세부 키워드를 정해야 합니다.',
  '희망 전공만 생각하며 탐구활동을 하면, 그 전공이 다루는 넓은 분야들을 모두 얕게 건드릴 수밖에 없게 됩니다. 또는, 아주 전형적인, 모두가 하는 주제들로 탐구를 하게 됩니다.',
  '너무 어렵게 생각하지 않아도 됩니다. 여러분이 평소에 관심이 있던 것들, 해당 전공에서 다루는 분야들 중 관심이 가는 것들... 어떤 것이든 여러분의 키워드가 될 수 있습니다.',
  '여러분이 희망하는 학과에서 무엇을 다루는지 확실하게 알고, 그 안에서 여러분만의 키워드를 선택해봅시다!',
];
const examples = [
  [
    '모터 스포츠용 엔진',
    'F1 엔지니어들처럼 모터 스포츠용 엔진을 만들어보고 싶어.',
  ],
  [
    '소비자 심리를 활용한 마케팅',
    '사람들이 왜 광고에 마음을 빼앗기는지 궁금해.',
  ],
  [
    '인공지능 검색 모델',
    '질문의 의도를 이해하고 원하는 답을 찾아주는 검색 모델을 만들고 싶어.',
  ],
  ['청소년 언어', '친구들이 같은 말을 상황마다 다르게 쓰는 게 신기해.'],
];

export function BrandingKeywordGuide({
  majors,
  confirmation = false,
  environment,
}: {
  majors: MajorList;
  confirmation?: boolean;
  environment: ConsultingScreenRenderEnvironment;
}) {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const next = () => {
    if (!ready) return;
    if (confirmation || index === messages.length - 1)
      environment.send({ type: 'user.start-input' });
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
        onNext={ready ? next : undefined}
        message={{
          segments: [
            {
              text: confirmation
                ? '희망 전공을 잘 입력했나요? 희망 전공은 학년이 지남에 따라 얼마든지 달라질 수 있습니다. 중요한 것은 지금 여러분의 마음입니다.'
                : messages[index],
            },
          ],
        }}
      >
        {confirmation && (
          <Button
            variant="outline"
            onClick={() =>
              environment.send({ type: 'user.previous-explanation' })
            }
          >
            수정하기
          </Button>
        )}
        <Button
          disabled={!ready}
          onClick={next}
          className="bg-violet-700 text-white hover:bg-violet-800"
        >
          {confirmation
            ? '잘 작성했어요'
            : index === messages.length - 1
              ? '키워드 작성하기'
              : '다음'}
          <ArrowRight aria-hidden="true" />
        </Button>
      </ConsultingPrompter>
      {confirmation ? (
        <ol className="grid gap-4 sm:grid-cols-3">
          {[majors.first, majors.second, majors.third].map(
            (major, position) => (
              <li
                key={position}
                className="rounded-xl border border-violet-100 bg-white p-5"
              >
                <p className="text-sm text-violet-700">{position + 1}순위</p>
                <p className="mt-3 font-medium">{major || '입력하지 않음'}</p>
              </li>
            ),
          )}
        </ol>
      ) : index === 2 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {examples.map(([keyword, text]) => (
            <article
              key={keyword}
              className="rounded-xl border border-violet-100 bg-white p-5"
            >
              <h2 className="font-semibold text-violet-700">{keyword}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">“{text}”</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

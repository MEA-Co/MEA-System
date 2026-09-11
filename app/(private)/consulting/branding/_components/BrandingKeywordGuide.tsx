'use client';

import { Tabs } from '@base-ui/react/tabs';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import {
  useConsultingToolRuntime,
  useConsultingToolRuntimeSnapshot,
} from '@/app/(private)/consulting/_components/ConsultingToolRuntimeProvider';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';

import { type MajorList, majorNames } from '../_lib/plan';
import {
  majorOverviewKey,
  majorOverviewSchema,
} from '../_tools/GenerateMajorOverviewTool';

import { DepartmentWebsitePreview } from './DepartmentWebsitePreview';

import styles from './MajorOverviews.module.css';

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

export function MajorOverviews({ majors }: { majors: MajorList }) {
  const { jobs } = useConsultingToolRuntimeSnapshot();
  const runtime = useConsultingToolRuntime();
  return (
    <Tabs.Root className="overflow-hidden rounded-2xl border border-violet-100 bg-white">
      <Tabs.List
        aria-label="희망 전공별 안내"
        activateOnFocus
        className="flex gap-1 overflow-x-auto border-b border-violet-100 bg-violet-50/50 p-2"
      >
        {majorNames(majors).map((major) => (
          <Tabs.Tab
            key={major}
            value={major}
            className="shrink-0 rounded-lg px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-violet-100/60 focus-visible:outline-2 focus-visible:outline-violet-500 data-active:bg-violet-100 data-active:text-violet-800"
          >
            {major}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {majorNames(majors).map((major) => {
        const job = [...jobs]
          .reverse()
          .find((item) => item.key === majorOverviewKey(major));
        const result = majorOverviewSchema.safeParse(job?.output);
        const failed =
          job?.status === 'rejected' ||
          job?.status === 'cancelled' ||
          (job?.status === 'completed' && !result.success);
        return (
          <Tabs.Panel
            key={major}
            value={major}
            className="min-h-48 p-5 focus-visible:outline-2 focus-visible:outline-violet-500 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-violet-900">{major}</h2>
            {job?.status === 'completed' && result.success ? (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  {result.data.department}의 공식 자료를 참고한 안내입니다.
                  대학마다 교육과정은 다를 수 있어요.
                </p>
                <DepartmentWebsitePreview
                  department={result.data.department}
                  url={result.data.url}
                  previewSites={result.data.previewSites}
                />
                <ol className="divide-y divide-violet-100">
                  {result.data.topics.map((topic, index) => (
                    <li key={topic.title} className="py-4">
                      <h3 className="font-medium">
                        <span className="mr-2 text-violet-600">
                          {index + 1}.
                        </span>
                        {topic.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {topic.description}
                      </p>
                    </li>
                  ))}
                </ol>
              </>
            ) : failed ? (
              <div role="alert" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  학과 안내를 가져오지 못했습니다. 다시 시도해 주세요.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (job) {
                      const run = runtime.retry(job.id);
                      void run?.result.catch(() => undefined);
                    }
                  }}
                >
                  다시 시도
                </Button>
              </div>
            ) : (
              <p
                role="status"
                className={`mt-6 text-sm leading-7 ${styles.loadingText}`}
              >
                공식 학과 자료에서 5개 대주제를 정리하고 있어요.
              </p>
            )}
          </Tabs.Panel>
        );
      })}
    </Tabs.Root>
  );
}

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
      ) : index === 3 ? (
        <MajorOverviews majors={majors} />
      ) : null}
    </div>
  );
}

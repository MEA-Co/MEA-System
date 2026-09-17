'use client';

import { ArrowLeft, ArrowRight, Eye, NotebookPen, Play } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { ConsultingFlow } from '@/app/(private)/consulting/_components/ConsultingFlow';
import { ConsultingReview } from '@/app/(private)/consulting/_components/ConsultingReview';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { BrandingMajorSearchProvider } from '@/app/(private)/consulting/branding/_context/BrandingMajorSearchContext';
import {
  brandingPlan,
  brandingScreenSchema,
  brandingSteps,
  brandingTools,
  majorListSchema,
  majorNames,
} from '@/app/(private)/consulting/branding/_lib/plan';
import { resumeBrandingValues } from '@/app/(private)/consulting/branding/_lib/resume';
import { brandingReviewPlan } from '@/app/(private)/consulting/branding/_lib/review';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createConsultingRenderer } from '@/features/consulting/core/renderer';
import { MajorValuesChat } from '@/features/major-values/components/MajorValuesChat';
import { ValuesResumeNotice } from '@/features/major-values/components/ValuesResumeNotice';
import { ValuesSessionProvider } from '@/features/major-values/components/ValuesSessionProvider';
import {
  createValuesContext,
  type ValuesState,
} from '@/features/major-values/domain';
import type { MemberRole } from '@/lib/profile';

import { BrandingIntro } from './BrandingIntro';
import { BrandingKeywordGuide, MajorOverviews } from './BrandingKeywordGuide';
import { BrandingKeywordInput } from './BrandingKeywordInput';
import { BrandingMajorScreen } from './BrandingMajorScreen';
import { BrandingValuesGuide } from './BrandingValuesGuide';

function BrandingScreen({
  data,
  environment,
}: {
  data: unknown;
  environment: ConsultingScreenRenderEnvironment;
}) {
  const { index, isReview, outputs, majors, valuesSession } =
    brandingScreenSchema.parse(data);
  const step = brandingSteps[index];
  const { draftValue, onDraftChange, send } = environment;
  const currentValue =
    step && isReview ? draftValue || outputs[step.id] : draftValue;
  const navigate = (direction: 'next' | 'back') =>
    send({
      type: 'user.submit',
      value: JSON.stringify({
        direction,
        outputs: step ? { ...outputs, [step.id]: currentValue } : outputs,
      }),
    });

  if (step?.id === 'values') {
    const context = createValuesContext(majors, outputs.keywords);
    const submitValues = (direction: 'next' | 'back', value: string) =>
      send({
        type: 'user.submit',
        value: JSON.stringify({
          direction,
          outputs: { ...outputs, values: value },
        }),
      });
    return (
      <MajorValuesChat
        key={JSON.stringify(context)}
        context={context}
        draftValue={draftValue || (isReview ? (valuesSession ?? '') : '')}
        onDraftChange={onDraftChange}
        onBack={(value) => submitValues('back', value)}
        onComplete={(value) => submitValues('next', value)}
      />
    );
  }

  if (index === 0 && step) {
    const names = majorNames(majors);
    const entries = names.map((major, position) => {
      const marker = `[${major}]\n`;
      const start = currentValue.indexOf(marker);
      if (start < 0)
        return position === 0 &&
          !names.some((name) => currentValue.includes(`[${name}]\n`))
          ? currentValue
          : '';
      const contentStart = start + marker.length;
      const next = names
        .map((name) => currentValue.indexOf(`\n\n[${name}]\n`, contentStart))
        .filter((offset) => offset >= 0);
      return currentValue.slice(
        contentStart,
        next.length ? Math.min(...next) : undefined,
      );
    });
    const keywordLists = entries.map((entry) =>
      entry
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    const valid =
      keywordLists.length > 0 && keywordLists.every((list) => list.length > 0);
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <form
          className="space-y-5 rounded-2xl border border-violet-100 bg-white p-6 md:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) navigate('next');
          }}
        >
          <MajorOverviews
            majors={majors}
            completed={names.filter((_, i) => keywordLists[i].length > 0)}
            renderInput={(major) => (
              <BrandingKeywordInput
                major={major}
                keywords={keywordLists[names.indexOf(major)]}
                onChange={(keywords) =>
                  onDraftChange(
                    names
                      .map(
                        (name, i) =>
                          `[${name}]\n${(name === major ? keywords : keywordLists[i]).join('\n')}`,
                      )
                      .join('\n\n'),
                  )
                }
              />
            )}
          />
          <div className="flex justify-between border-t border-violet-100 pt-5">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50"
              onClick={() =>
                isReview
                  ? send({ type: 'user.previous-explanation' })
                  : navigate('back')
              }
            >
              <ArrowLeft aria-hidden="true" />
              이전
            </Button>
            <Button
              type="submit"
              disabled={!valid}
              className="rounded-xl bg-violet-700 text-white hover:bg-violet-800"
            >
              다음 <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="border-l-4 border-violet-700 pl-4">
        <p className="text-sm font-semibold text-violet-800">
          BRANDING WORKBOOK
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          나만의 진로 이야기를 만드는 4단계
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          한 단계씩 생각을 정리해 나에게 맞는 생활기록부의 방향을 찾아보세요.
        </p>
      </div>

      <div
        className={
          step
            ? 'grid overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]'
            : ''
        }
      >
        {step ? (
          <form
            key={step.id}
            className="space-y-7 p-6 md:p-8 lg:border-r lg:border-slate-200"
            onSubmit={(event) => {
              event.preventDefault();
              if (currentValue.trim()) navigate('next');
            }}
          >
            <div className="space-y-3">
              <p className="text-sm font-medium text-violet-800">
                STEP {String(index + 1).padStart(2, '0')}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                <label htmlFor={`branding-${step.id}`}>{step.title}</label>
              </h2>
              <p
                id="branding-description"
                className="text-sm leading-6 text-muted-foreground"
              >
                {step.description}
              </p>
            </div>
            <Textarea
              id={`branding-${step.id}`}
              aria-describedby="branding-description"
              value={currentValue}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={step.placeholder}
              className="min-h-52 rounded-xl border-slate-200 bg-violet-50/30 px-4 py-4 text-base leading-7 placeholder:text-slate-400 focus-visible:border-violet-700 focus-visible:ring-violet-700/15"
              required
            />
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              {index > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => navigate('back')}
                >
                  이전 산출물
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                className="rounded-xl bg-violet-800 hover:bg-violet-900"
                disabled={!currentValue.trim()}
              >
                {index === brandingSteps.length - 1
                  ? '산출물 모아보기'
                  : '다음 산출물'}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </form>
        ) : (
          <div className="mb-6 space-y-2">
            <h2 className="text-2xl font-semibold">나의 브랜딩 산출물</h2>
            <p className="text-sm text-muted-foreground">
              네 가지 산출물을 연결해 확인해보세요. 이전으로 돌아가 내용을
              다듬을 수 있어요.
            </p>
          </div>
        )}
        <aside
          className="border-t border-slate-200 bg-violet-50/45 p-6 lg:border-t-0"
          aria-label="작성한 산출물"
        >
          <div className="mb-6 flex items-center gap-2 text-violet-900">
            <NotebookPen className="size-4" aria-hidden="true" />
            <h2 className="text-sm font-semibold">
              {step ? '나의 브랜딩 노트' : '생활기록부 브랜딩 컨설팅'}
            </h2>
          </div>
          <dl className="mb-5 space-y-2 border-b border-violet-200 pb-5">
            {[majors.first, majors.second, majors.third].map(
              (major, position) =>
                major ? (
                  <div key={position} className="flex gap-3 text-sm">
                    <dt className="shrink-0 text-violet-700">
                      {position + 1}순위
                    </dt>
                    <dd className="wrap-break-word text-slate-700">{major}</dd>
                  </div>
                ) : null,
            )}
          </dl>
          {index === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              전공 세부 키워드부터 시작해 나의 가치관, 역량, 한 줄 서사를 차례로
              완성합니다.
            </p>
          ) : (
            <dl className="space-y-3">
              {brandingSteps.slice(0, index).map((item) => (
                <div
                  key={item.id}
                  className="border border-violet-900/10 bg-white/75 p-4"
                >
                  <dt className="mb-2 text-xs font-semibold text-violet-800">
                    {item.title}
                  </dt>
                  <dd className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-slate-700">
                    {outputs[item.id]}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </aside>
      </div>
      {!step && (
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => navigate('back')}
        >
          산출물 수정하기
        </Button>
      )}
    </div>
  );
}

const screenEntry = {
  mode: 'dynamic' as const,
  validateData: (data: unknown) => brandingScreenSchema.safeParse(data).success,
  render: (
    request: { data: unknown },
    environment: ConsultingScreenRenderEnvironment,
  ) => <BrandingScreen data={request.data} environment={environment} />,
};
const brandingRenderer = createConsultingRenderer<
  ConsultingScreenRenderEnvironment,
  ReactNode
>({
  'branding.intro': {
    mode: 'static',
    render: (_request, environment) => (
      <BrandingIntro
        onStart={() => environment.send({ type: 'user.start-input' })}
      />
    ),
  },
  'branding.input': screenEntry,
  'branding.values-guide': {
    mode: 'dynamic',
    validateData: (data) => brandingScreenSchema.safeParse(data).success,
    render: (request, environment) => {
      const { outputs } = brandingScreenSchema.parse(request.data);
      const navigate = (direction: 'next' | 'back') =>
        environment.send({
          type: 'user.submit',
          value: JSON.stringify({ direction, outputs }),
        });
      return (
        <BrandingValuesGuide
          onStart={() => navigate('next')}
          onBack={() => navigate('back')}
        />
      );
    },
  },
  'branding.major-confirmation': {
    mode: 'dynamic',
    validateData: (data) => majorListSchema.safeParse(data).success,
    render: (request, environment) => (
      <BrandingKeywordGuide
        key="confirmation"
        confirmation
        majors={majorListSchema.parse(request.data)}
        environment={environment}
      />
    ),
  },
  'branding.keyword-guide': {
    mode: 'dynamic',
    validateData: (data) => majorListSchema.safeParse(data).success,
    render: (request, environment) => (
      <BrandingKeywordGuide
        key="guide"
        majors={majorListSchema.parse(request.data)}
        environment={environment}
      />
    ),
  },
  'branding.primary-major': {
    mode: 'static',
    render: (_request, environment) => (
      <BrandingMajorScreen key="primary" environment={environment} />
    ),
  },
  'branding.additional-majors': {
    mode: 'static',
    render: (_request, environment) => (
      <BrandingMajorScreen
        key="additional"
        additional
        environment={environment}
      />
    ),
  },
  'branding.complete': screenEntry,
});

export function BrandingConsulting({
  role,
  userId,
}: {
  role: MemberRole;
  userId: string;
}) {
  const [mode, setMode] = useState<'experience' | 'review'>('experience');
  const [resumed, setResumed] = useState<ValuesState | null>(null);
  const experiencePlan = useMemo(
    () => (resumed ? resumeBrandingValues(resumed) : brandingPlan),
    [resumed],
  );
  const reviewEnabled =
    role === 'admin' || role === 'consultant' || role === 'consultant_lead';

  return (
    <div className="space-y-4">
      {reviewEnabled ? (
        <div
          className="flex w-fit rounded-xl border bg-background p-1 shadow-sm"
          role="group"
          aria-label="컨설팅 확인 방식"
        >
          <Button
            type="button"
            variant={mode === 'experience' ? 'default' : 'ghost'}
            size="sm"
            aria-pressed={mode === 'experience'}
            onClick={() => setMode('experience')}
          >
            <Play aria-hidden="true" />
            직접 체험
          </Button>
          <Button
            type="button"
            variant={mode === 'review' ? 'default' : 'ghost'}
            size="sm"
            aria-pressed={mode === 'review'}
            onClick={() => setMode('review')}
          >
            <Eye aria-hidden="true" />
            전체 검토
          </Button>
        </div>
      ) : null}

      <ValuesSessionProvider ownerId={mode === 'experience' ? userId : null}>
        {mode === 'experience' && !resumed && (
          <ValuesResumeNotice ownerId={userId} onResume={setResumed} />
        )}
        <BrandingMajorSearchProvider key={mode}>
          {mode === 'review' && reviewEnabled ? (
            <ConsultingReview
              plan={brandingPlan}
              review={brandingReviewPlan}
              renderer={brandingRenderer}
              viewerRole={role}
            />
          ) : (
            <ConsultingFlow
              key={resumed?.source ?? 'new'}
              progressLabels={brandingSteps.map((step) => step.title)}
              plan={experiencePlan}
              renderer={brandingRenderer}
              tools={brandingTools}
              viewerRole={role}
              debug={role === 'admin'}
            />
          )}
        </BrandingMajorSearchProvider>
      </ValuesSessionProvider>
    </div>
  );
}

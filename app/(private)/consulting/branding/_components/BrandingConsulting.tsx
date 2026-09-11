'use client';

import { ArrowRight, NotebookPen } from 'lucide-react';
import type { ReactNode } from 'react';

import { ConsultingFlow } from '@/app/(private)/consulting/_components/ConsultingFlow';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  brandingPlan,
  brandingScreenSchema,
  brandingSteps,
  brandingTools,
} from '@/app/(private)/consulting/branding/_lib/plan';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createConsultingRenderer } from '@/features/consulting/core/renderer';
import type { MemberRole } from '@/lib/profile';

function BrandingScreen({
  data,
  environment,
}: {
  data: unknown;
  environment: ConsultingScreenRenderEnvironment;
}) {
  const { index, outputs } = brandingScreenSchema.parse(data);
  const step = brandingSteps[index];
  const { draftValue, onDraftChange, send } = environment;
  const navigate = (direction: 'next' | 'back') =>
    send({
      type: 'user.submit',
      value: JSON.stringify({
        direction,
        outputs: step ? { ...outputs, [step.id]: draftValue } : outputs,
      }),
    });

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
              if (draftValue.trim()) navigate('next');
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
              value={draftValue}
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
                disabled={!draftValue.trim()}
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
                  <dd className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
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
>({ 'branding.input': screenEntry, 'branding.complete': screenEntry });

export function BrandingConsulting({ role }: { role: MemberRole }) {
  return (
    <ConsultingFlow
      progressLabels={brandingSteps.map((step) => step.title)}
      plan={brandingPlan}
      renderer={brandingRenderer}
      tools={brandingTools}
      viewerRole={role}
      debug={role === 'admin'}
    />
  );
}

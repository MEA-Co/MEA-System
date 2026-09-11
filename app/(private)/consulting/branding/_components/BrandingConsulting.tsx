'use client';

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
    <div className="mx-auto max-w-5xl space-y-8">
      <ol
        aria-label="만들어갈 산출물"
        className="grid grid-cols-2 gap-2 md:grid-cols-4"
      >
        {brandingSteps.map((item, position) => (
          <li
            key={item.id}
            aria-current={position === index ? 'step' : undefined}
            className={`rounded-xl border px-4 py-3 text-sm ${position === index ? 'border-primary bg-primary/5 font-semibold' : 'text-muted-foreground'}`}
          >
            <span className="mr-2 text-xs">
              {String(position + 1).padStart(2, '0')}
            </span>
            {item.title}
          </li>
        ))}
      </ol>
      <div className={step ? 'grid gap-8 lg:grid-cols-[1.5fr_1fr]' : ''}>
        {step ? (
          <form
            key={step.id}
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (draftValue.trim()) navigate('next');
            }}
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                이번에 만들 산출물
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                <label htmlFor={`branding-${step.id}`}>{step.title}</label>
              </h1>
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
              className="min-h-48 bg-background text-base"
              required
            />
            <div className="flex items-center justify-between gap-3">
              {index > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('back')}
                >
                  이전 산출물
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={!draftValue.trim()}>
                {index === brandingSteps.length - 1
                  ? '산출물 모아보기'
                  : '다음 산출물'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl font-semibold">나의 브랜딩 산출물</h1>
            <p className="text-sm text-muted-foreground">
              네 가지 산출물을 연결해 확인해보세요. 이전으로 돌아가 내용을
              다듬을 수 있어요.
            </p>
          </div>
        )}
        <aside
          className="rounded-2xl border bg-muted/30 p-5"
          aria-label="작성한 산출물"
        >
          <h2 className="mb-5 text-sm font-semibold">
            {step ? '지금까지 만든 산출물' : '생활기록부 브랜딩 컨설팅'}
          </h2>
          {index === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              세부 키워드부터 시작해 나의 가치관, 역량, 한 줄 서사를 차례로
              완성합니다.
            </p>
          ) : (
            <dl className="space-y-5">
              {brandingSteps.slice(0, index).map((item) => (
                <div key={item.id}>
                  <dt className="mb-2 text-sm font-medium">{item.title}</dt>
                  <dd className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                    {outputs[item.id]}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </aside>
      </div>
      {!step && (
        <Button variant="outline" onClick={() => navigate('back')}>
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
      plan={brandingPlan}
      renderer={brandingRenderer}
      tools={brandingTools}
      viewerRole={role}
      debug={role === 'admin'}
    />
  );
}

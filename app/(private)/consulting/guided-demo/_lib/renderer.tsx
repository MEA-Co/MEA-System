import { ArrowDown, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  type GuidedConsultingMainRenderEnvironment,
  GuidedConsultingResultCard,
  isDefaultInputRendererData,
  renderDefaultInputMain,
  renderDefaultTutorialMain,
} from '@/app/(private)/consulting/_components/GuidedConsultingMainRenderer';
import type { MergeSortContext } from '@/app/(private)/consulting/guided-demo/_lib/types';
import { createGuidedConsultingRenderer } from '@/features/guided-consulting/core/renderer';

type MergeSortScreenData = {
  label: string;
  input: Array<number>;
  sorted?: Array<number>;
};

type FinalResultsScreenData = {
  context: MergeSortContext;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumberArray(value: unknown): value is Array<number> {
  return (
    Array.isArray(value) &&
    value.every((candidate) => typeof candidate === 'number')
  );
}

function isMergeSortScreenData(value: unknown): value is MergeSortScreenData {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    isNumberArray(value.input) &&
    (value.sorted === undefined || isNumberArray(value.sorted))
  );
}

function isMergeSortContext(value: unknown): value is MergeSortContext {
  return (
    isRecord(value) &&
    isNumberArray(value.firstInput) &&
    isNumberArray(value.firstSorted) &&
    isNumberArray(value.secondInput) &&
    isNumberArray(value.secondSorted)
  );
}

function isFinalResultsScreenData(
  value: unknown,
): value is FinalResultsScreenData {
  return isRecord(value) && isMergeSortContext(value.context);
}

function NumberList({ numbers }: { numbers: Array<number> }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {numbers.map((number, index) => (
        <span
          key={`${number}-${index}`}
          className="flex size-10 items-center justify-center rounded-lg border bg-background font-mono text-sm font-semibold shadow-xs"
        >
          {number}
        </span>
      ))}
    </div>
  );
}

function MergeSortResult({ data }: { data: MergeSortScreenData }) {
  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border bg-background/90 p-6 text-center shadow-sm md:p-8">
      <p className="text-xs font-bold tracking-[0.14em] text-primary">
        {data.label}
      </p>
      <p className="mt-5 text-xs font-semibold text-muted-foreground">INPUT</p>
      <div className="mt-3">
        <NumberList numbers={data.input} />
      </div>
      <ArrowDown
        className="mx-auto my-5 size-5 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="text-xs font-semibold text-muted-foreground">
        MERGE SORT RESULT
      </p>
      <div className="mt-3">
        <NumberList numbers={data.sorted ?? []} />
      </div>
    </section>
  );
}

function MergeSortPending({ data }: { data: MergeSortScreenData }) {
  return (
    <section className="mx-auto flex min-h-72 w-full max-w-3xl flex-col items-center justify-center rounded-2xl border bg-background/90 p-6 text-center shadow-sm md:p-8">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      </span>
      <p className="mt-5 text-xs font-bold tracking-[0.14em] text-primary">
        {data.label}
      </p>
      <h1 className="mt-2 text-xl font-bold tracking-[-0.03em]">
        결과가 도착하면 이 화면이 업데이트됩니다
      </h1>
      <div className="mt-6">
        <NumberList numbers={data.input} />
      </div>
    </section>
  );
}

function FinalResults({ context }: { context: MergeSortContext }) {
  return (
    <div className="grid gap-5">
      <MergeSortResult
        data={{
          label: '첫 번째 정렬 결과',
          input: context.firstInput,
          sorted: context.firstSorted,
        }}
      />
      <MergeSortResult
        data={{
          label: '두 번째 정렬 결과 · 화면 업데이트 완료',
          input: context.secondInput,
          sorted: context.secondSorted,
        }}
      />
    </div>
  );
}

export const mergeSortRenderer = createGuidedConsultingRenderer<
  GuidedConsultingMainRenderEnvironment,
  ReactNode
>({
  'tutorial.default': {
    mode: 'static',
    render: renderDefaultTutorialMain,
  },
  'input.default': {
    mode: 'dynamic',
    validateData: isDefaultInputRendererData,
    render: renderDefaultInputMain,
  },
  'merge-sort.result': {
    mode: 'dynamic',
    validateData: isMergeSortScreenData,
    render: (request) => (
      <MergeSortResult data={request.data as MergeSortScreenData} />
    ),
  },
  'merge-sort.pending': {
    mode: 'dynamic',
    validateData: isMergeSortScreenData,
    render: (request) => (
      <MergeSortPending data={request.data as MergeSortScreenData} />
    ),
  },
  'result.default': {
    mode: 'dynamic',
    validateData: isFinalResultsScreenData,
    render: (request, environment) => {
      const { send } = environment;
      const { context } = request.data as FinalResultsScreenData;

      return (
        <GuidedConsultingResultCard
          onReset={() => send({ type: 'user.reset' })}
        >
          <FinalResults context={context} />
        </GuidedConsultingResultCard>
      );
    },
  },
});

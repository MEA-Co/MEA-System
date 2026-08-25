'use client';

import type { ReactNode } from 'react';

import { GuidedConsultingResultCard } from '@/app/(private)/consulting/_components/GuidedConsultingResultCard';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import type { MergeSortContext } from '@/app/(private)/consulting/guided-demo/_lib/types';
import {
  type FinalResultsScreenData,
  isFinalResultsScreenData,
} from '@/app/(private)/consulting/guided-demo/_screens/data';
import { MergeSortResultScreen } from '@/app/(private)/consulting/guided-demo/_screens/MergeSortResultScreen';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function FinalResults({ context }: { context: MergeSortContext }) {
  return (
    <div className="grid gap-5">
      <MergeSortResultScreen
        label="첫 번째 정렬 결과"
        data={{
          input: context.firstInput,
          sorted: context.firstSorted,
        }}
      />
      <MergeSortResultScreen
        label="두 번째 정렬 결과 · 화면 업데이트 완료"
        data={{
          input: context.secondInput,
          sorted: context.secondSorted,
        }}
      />
    </div>
  );
}

export const mergeSortCompleteScreen = {
  mode: 'dynamic',
  validateData: isFinalResultsScreenData,
  render: (request, environment) => {
    const { context } = request.data as FinalResultsScreenData;

    return (
      <GuidedConsultingResultCard
        onReset={() => environment.send({ type: 'user.reset' })}
      >
        <FinalResults context={context} />
      </GuidedConsultingResultCard>
    );
  },
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;

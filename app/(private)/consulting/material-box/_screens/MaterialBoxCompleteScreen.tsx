'use client';

import type { ReactNode } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  isMaterialBoxProgressScreenData,
  type MaterialBoxProgressScreenData,
} from '@/app/(private)/consulting/material-box/_lib/types';
import { MaterialBoxTable } from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function MaterialBoxCompleteScreen({
  data,
}: {
  data: MaterialBoxProgressScreenData;
}) {
  return (
    <ConsultingScreenView>
      <MaterialBoxTable
        focus={null}
        majorRowCount={3}
        majors={data.majors}
        keyword={data.keyword}
        careerIdentity={data.careerIdentity}
        coreValue={data.coreValue}
        fieldStrength={data.fieldStrength}
        personalStrength={data.personalStrength}
      />
      <ConsultingPrompter
        animateTyping
        message={{
          segments: [
            {
              text: '좋습니다! 진로의 모습, 중요 가치, 분야 역량, 평소의 장점까지 재료함에 모두 담겼어요. 이 재료들은 앞으로 여러분만의 활동과 성장 서사를 설계하는 기준이 됩니다.',
            },
          ],
        }}
      />
    </ConsultingScreenView>
  );
}

export const materialBoxCompleteScreen = {
  mode: 'dynamic',
  validateData: isMaterialBoxProgressScreenData,
  render: (request) => (
    <MaterialBoxCompleteScreen
      data={request.data as MaterialBoxProgressScreenData}
    />
  ),
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;

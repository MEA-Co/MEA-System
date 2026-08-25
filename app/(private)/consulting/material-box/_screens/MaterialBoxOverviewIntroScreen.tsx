'use client';

import type { ReactNode } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

function MaterialBoxOverview() {
  return (
    <section
      className="mx-auto flex w-full max-w-4xl items-center"
      aria-label="생활기록부 브랜딩 재료함 구성"
    >
      <div className="w-full overflow-hidden sm:overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg border text-left text-xs sm:min-w-160 sm:table-auto sm:rounded-xl sm:text-sm">
          <tbody>
            <tr>
              <th
                scope="rowgroup"
                rowSpan={2}
                className="w-[38%] border-r border-b bg-muted/35 px-2.5 py-3 align-middle font-bold leading-5 sm:w-56 sm:px-5 sm:py-5 sm:text-sm"
              >
                전공 세부 분야 키워드
              </th>
              <td className="w-[29%] border-r border-b px-2.5 py-3 font-semibold sm:w-44 sm:px-5 sm:py-5 sm:text-sm">
                전공
              </td>
              <td className="border-b px-2.5 py-3 text-muted-foreground sm:px-5 sm:py-5 sm:text-sm">
                키워드
              </td>
            </tr>
            <tr>
              <th
                scope="row"
                colSpan={2}
                className="border-b px-2.5 py-3 font-semibold sm:px-5 sm:py-5 sm:text-sm"
              >
                학생의 스토리
              </th>
            </tr>
            <tr>
              <th
                scope="row"
                className="border-r border-b bg-muted/35 px-2.5 py-3 font-bold leading-5 sm:px-5 sm:py-5 sm:text-sm"
              >
                전공 가치관
              </th>
              <td
                colSpan={2}
                className="border-b px-2.5 py-3 font-medium sm:px-5 sm:py-5 sm:text-sm"
              />
            </tr>
            <tr>
              <th
                scope="row"
                className="border-r bg-muted/35 px-2.5 py-3 font-bold leading-5 sm:px-5 sm:py-5 sm:text-sm"
              >
                계열 적합 역량
              </th>
              <td
                colSpan={2}
                className="px-2.5 py-3 font-medium sm:px-5 sm:py-5 sm:text-sm"
              />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MaterialBoxOverviewIntroScreen() {
  return (
    <ConsultingScreenView>
      <MaterialBoxOverview />
      <ConsultingPrompter
        animateTyping
        message={{
          segments: [
            { text: '여러분은 지금부터 ' },
            { text: '재료함', emphasis: 'accent' },
            {
              text: '이라고 하는 것을 채워가며 생활기록부에 그려질 여러분의 모습을 만들어볼 것입니다.',
            },
          ],
        }}
      />
    </ConsultingScreenView>
  );
}

export const materialBoxOverviewIntroScreen = {
  mode: 'static',
  render: () => <MaterialBoxOverviewIntroScreen />,
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;

'use client';

import { GuidedConsultingFlow } from '@/app/(private)/consulting/_components/GuidedConsultingFlow';
import { studyRoutineConsulting } from '@/app/(private)/consulting/guided-demo/_lib/definition';
import { studyRoutineTools } from '@/app/(private)/consulting/guided-demo/_lib/tools';
import type { StudyRoutineContext } from '@/app/(private)/consulting/guided-demo/_lib/types';

function StudyRoutineResult({ context }: { context: StudyRoutineContext }) {
  const items = [
    { label: '목표', value: context.goal },
    { label: '확보한 시간', value: context.availableTime },
    { label: '완성된 루틴', value: context.finalRoutine },
  ];

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <section key={item.label} className="rounded-xl border bg-muted/25 p-4">
          <p className="text-xs font-semibold text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-2 text-sm leading-7 md:text-base">{item.value}</p>
        </section>
      ))}
    </div>
  );
}

export function StudyRoutineDemo() {
  return (
    <GuidedConsultingFlow
      definition={studyRoutineConsulting}
      tools={studyRoutineTools}
      renderComplete={(context) => <StudyRoutineResult context={context} />}
    />
  );
}

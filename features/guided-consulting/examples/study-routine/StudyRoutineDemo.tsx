'use client';

import { studyRoutineConsulting } from '@/features/guided-consulting/examples/study-routine/definition';
import { studyRoutineTools } from '@/features/guided-consulting/examples/study-routine/tools';
import type { StudyRoutineContext } from '@/features/guided-consulting/examples/study-routine/types';
import { GuidedConsultingFlow } from '@/features/guided-consulting/ui/GuidedConsultingFlow';

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

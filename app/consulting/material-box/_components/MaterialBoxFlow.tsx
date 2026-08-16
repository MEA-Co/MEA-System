'use client';

import { materialBoxConsulting } from '@/app/consulting/material-box/_lib/materialBoxConsulting';
import { ConsultingMain } from '@/features/consulting/components/ConsultingMain';
import { ConsultingPrompter } from '@/features/consulting/components/ConsultingPrompter';
import { useConsultingSequence } from '@/features/consulting/hooks/useConsultingSequence';

export function MaterialBoxFlow() {
  const consulting = useConsultingSequence(materialBoxConsulting);

  return (
    <ConsultingMain
      prompterPlacement={consulting.view.prompterPlacement}
      prompterSize={consulting.view.prompterSize}
      onPrompterTransitionComplete={consulting.completePrompterLayout}
      prompter={
        <ConsultingPrompter
          message={consulting.view.message}
          onTypingComplete={consulting.completePrompterTyping}
        />
      }
    />
  );
}

'use client';

import { MajorPreferencesScreen } from '@/app/consulting/material-box/_components/MajorPreferencesScreen';
import { materialBoxConsulting } from '@/app/consulting/material-box/_lib/materialBoxConsulting';
import { ConsultingMain } from '@/features/consulting/components/ConsultingMain';
import { ConsultingProgressButton } from '@/features/consulting/components/ConsultingProgressButton';
import { ConsultingPrompter } from '@/features/consulting/components/ConsultingPrompter';
import { useConsultingSequence } from '@/features/consulting/hooks/useConsultingSequence';

export function MaterialBoxFlow() {
  const consulting = useConsultingSequence(materialBoxConsulting);
  const currentScreen = consulting.view.screen;
  const canContinue =
    consulting.currentAction?.type === 'prompter' &&
    consulting.currentAction.waitFor === 'continue';

  return (
    <ConsultingMain
      prompterPlacement={consulting.view.prompterPlacement}
      prompterSize={consulting.view.prompterSize}
      onPrompterTransitionComplete={consulting.completePrompterLayout}
      prompter={
        <ConsultingPrompter
          message={consulting.view.message}
          onTypingComplete={consulting.completePrompterTyping}
        >
          {canContinue && (
            <ConsultingProgressButton onClick={consulting.continueSequence} />
          )}
        </ConsultingPrompter>
      }
    >
      {currentScreen && (
        <MajorPreferencesScreen
          screen={currentScreen}
          isInteractive={consulting.turn === 'user'}
          submittedPreferences={consulting.context.preferences}
          onAnimationComplete={consulting.completeScreenAnimation}
          onSubmit={(preferences) => consulting.completeScreen({ preferences })}
        />
      )}
    </ConsultingMain>
  );
}

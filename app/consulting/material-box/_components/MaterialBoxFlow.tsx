'use client';

import { Undo2 } from 'lucide-react';

import { MajorPreferencesScreen } from '@/app/consulting/material-box/_components/MajorPreferencesScreen';
import { materialBoxConsulting } from '@/app/consulting/material-box/_lib/materialBoxConsulting';
import { Button } from '@/components/ui/button';
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
  const isReviewingPreferences = canContinue && currentScreen === 'major-input';

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
          {isReviewingPreferences ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={consulting.returnToPreviousUserAction}
                className="h-11 px-4 text-muted-foreground hover:text-foreground"
              >
                <Undo2 className="size-4" aria-hidden="true" />
                아니오, 수정할게요
              </Button>
              <ConsultingProgressButton onClick={consulting.continueSequence}>
                네, 잘 작성했어요
              </ConsultingProgressButton>
            </div>
          ) : (
            canContinue && (
              <ConsultingProgressButton onClick={consulting.continueSequence} />
            )
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

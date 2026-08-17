'use client';

import { Undo2 } from 'lucide-react';

import { KeywordExamplesScreen } from '@/app/consulting/material-box/_components/KeywordExamplesScreen';
import { KeywordExplorationScreen } from '@/app/consulting/material-box/_components/KeywordExplorationScreen';
import { MajorPreferencesScreen } from '@/app/consulting/material-box/_components/MajorPreferencesScreen';
import {
  type MajorPreferenceScreen,
  materialBoxConsulting,
  type MaterialBoxScreen,
} from '@/app/consulting/material-box/_lib/materialBoxConsulting';
import { Button } from '@/components/ui/button';
import { ConsultingMain } from '@/features/consulting/components/ConsultingMain';
import { ConsultingProgressButton } from '@/features/consulting/components/ConsultingProgressButton';
import { ConsultingPrompter } from '@/features/consulting/components/ConsultingPrompter';
import { useConsultingRunner } from '@/features/consulting/hooks/useConsultingRunner';

function isMajorPreferenceScreen(
  screen: MaterialBoxScreen | null,
): screen is MajorPreferenceScreen {
  return (
    screen === 'major-one' ||
    screen === 'three-majors' ||
    screen === 'major-input'
  );
}

export function MaterialBoxFlow() {
  const consulting = useConsultingRunner(materialBoxConsulting);
  const currentScreen = consulting.view.screen;
  const canContinue =
    (consulting.currentTurnId === 'intro-continue' ||
      consulting.currentTurnId === 'keyword-intro-continue' ||
      consulting.currentTurnId === 'keyword-interest-continue') &&
    consulting.canSubmitUser;
  const isReviewingPreferences =
    consulting.currentTurnId === 'major-review' && consulting.canSubmitUser;
  const canEditMajors =
    consulting.currentTurnId === 'major-input' && consulting.canSubmitUser;
  const canEditKeyword =
    consulting.currentTurnId === 'keyword-input' && consulting.canSubmitUser;

  return (
    <ConsultingMain
      prompterPlacement={consulting.view.prompterPlacement}
      prompterSize={consulting.view.prompterSize}
      onPrompterTransitionComplete={consulting.completeLayoutPresentation}
      prompter={
        <ConsultingPrompter
          message={consulting.view.message}
          onTypingComplete={consulting.completePrompterPresentation}
        >
          {isReviewingPreferences ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() =>
                  consulting.submitUserTurn({
                    type: 'review-majors',
                    decision: 'edit',
                  })
                }
                className="h-11 px-4 text-muted-foreground hover:text-foreground"
              >
                <Undo2 className="size-4" aria-hidden="true" />
                아니오, 수정할게요
              </Button>
              <ConsultingProgressButton
                onClick={() =>
                  consulting.submitUserTurn({
                    type: 'review-majors',
                    decision: 'confirm',
                  })
                }
              >
                네, 잘 작성했어요
              </ConsultingProgressButton>
            </div>
          ) : (
            canContinue && (
              <ConsultingProgressButton
                onClick={() => consulting.submitUserTurn({ type: 'continue' })}
              />
            )
          )}
        </ConsultingPrompter>
      }
    >
      {isMajorPreferenceScreen(currentScreen) && (
        <MajorPreferencesScreen
          screen={currentScreen}
          isInteractive={canEditMajors}
          submittedPreferences={consulting.context.preferences}
          onAnimationComplete={consulting.completeScreenPresentation}
          onSubmit={(preferences) =>
            consulting.submitUserTurn({
              type: 'submit-majors',
              preferences,
            })
          }
        />
      )}

      {currentScreen === 'keyword-examples' && (
        <KeywordExamplesScreen
          onAnimationComplete={consulting.completeScreenPresentation}
        />
      )}

      {currentScreen === 'keyword-exploration' && (
        <KeywordExplorationScreen
          advice={consulting.resources.mentorAdvice.data ?? []}
          adviceStatus={consulting.resources.mentorAdvice.status}
          isInteractive={canEditKeyword}
          preferences={consulting.memory.majorPreferences}
          submittedKeyword={consulting.context.keyword}
          onSubmit={(keyword) =>
            consulting.submitUserTurn({
              type: 'submit-keyword',
              keyword,
            })
          }
        />
      )}
    </ConsultingMain>
  );
}

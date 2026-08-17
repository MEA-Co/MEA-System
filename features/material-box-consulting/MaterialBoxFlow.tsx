'use client';

import { Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useConsultingSession } from '@/features/consulting/runtime/useConsultingSession';
import { ConsultingMain } from '@/features/consulting/ui/ConsultingMain';
import { ConsultingProgressButton } from '@/features/consulting/ui/ConsultingProgressButton';
import { ConsultingPrompter } from '@/features/consulting/ui/ConsultingPrompter';
import { materialBoxConsulting } from '@/features/material-box-consulting/definition/consulting';
import type {
  MajorPreferenceScreen,
  MaterialBoxScreen,
} from '@/features/material-box-consulting/model/types';
import { KeywordExamplesScreen } from '@/features/material-box-consulting/screens/KeywordExamplesScreen';
import { KeywordExplorationScreen } from '@/features/material-box-consulting/screens/KeywordExplorationScreen';
import { MajorPreferencesScreen } from '@/features/material-box-consulting/screens/MajorPreferencesScreen';

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
  const session = useConsultingSession(materialBoxConsulting);
  const currentScreen = session.view.screen;
  const canContinue =
    session.interaction.kind === 'continue' && session.isWaitingForUser;
  const isReviewingPreferences =
    session.interaction.kind === 'major-review' && session.isWaitingForUser;
  const canEditMajors =
    session.interaction.kind === 'major-form' && session.isWaitingForUser;
  const canEditKeyword =
    session.interaction.kind === 'keyword-form' && session.isWaitingForUser;

  return (
    <ConsultingMain
      prompterPlacement={session.view.prompterPlacement}
      prompterSize={session.view.prompterSize}
      canGoBack={session.canGoBack}
      onBack={session.goBack}
      onPrompterTransitionComplete={session.completeLayoutPresentation}
      prompter={
        session.view.message && (
          <ConsultingPrompter
            key={session.presentationKeys.prompter}
            message={session.view.message}
            onTypingComplete={session.completePrompterPresentation}
          >
            {isReviewingPreferences ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => session.send({ type: 'EDIT_MAJORS' })}
                  className="h-11 px-4 text-muted-foreground hover:text-foreground"
                >
                  <Undo2 className="size-4" aria-hidden="true" />
                  아니오, 수정할게요
                </Button>
                <ConsultingProgressButton
                  onClick={() => session.send({ type: 'CONFIRM_MAJORS' })}
                >
                  네, 잘 작성했어요
                </ConsultingProgressButton>
              </div>
            ) : (
              canContinue && (
                <ConsultingProgressButton
                  onClick={() => session.send({ type: 'CONTINUE' })}
                />
              )
            )}
          </ConsultingPrompter>
        )
      }
    >
      {isMajorPreferenceScreen(currentScreen) && (
        <MajorPreferencesScreen
          key={`${currentScreen}-${session.presentationKeys.screen}`}
          screen={currentScreen}
          isInteractive={canEditMajors}
          submittedPreferences={session.memory.majorPreferences}
          onAnimationComplete={session.completeScreenPresentation}
          onSubmit={(preferences) =>
            session.send({ type: 'SUBMIT_MAJORS', preferences })
          }
        />
      )}

      {currentScreen === 'keyword-examples' && (
        <KeywordExamplesScreen
          key={`keyword-examples-${session.presentationKeys.screen}`}
          onAnimationComplete={session.completeScreenPresentation}
        />
      )}

      {currentScreen === 'keyword-exploration' && (
        <KeywordExplorationScreen
          key={`keyword-exploration-${session.presentationKeys.screen}`}
          advice={session.tasks.mentorAdvice.data ?? []}
          adviceStatus={session.tasks.mentorAdvice.status}
          isInteractive={canEditKeyword}
          preferences={session.memory.majorPreferences}
          submittedKeyword={session.memory.keyword}
          onSubmit={(keyword) =>
            session.send({ type: 'SUBMIT_KEYWORD', keyword })
          }
        />
      )}
    </ConsultingMain>
  );
}

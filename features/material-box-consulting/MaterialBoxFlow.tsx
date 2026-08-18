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
  MaterialReflectionScreen as MaterialReflectionScreenName,
} from '@/features/material-box-consulting/model/types';
import { KeywordExamplesScreen } from '@/features/material-box-consulting/screens/KeywordExamplesScreen';
import { KeywordExplorationScreen } from '@/features/material-box-consulting/screens/KeywordExplorationScreen';
import { MajorPreferencesScreen } from '@/features/material-box-consulting/screens/MajorPreferencesScreen';
import { MaterialBoxOverviewScreen } from '@/features/material-box-consulting/screens/MaterialBoxOverviewScreen';
import { MaterialBoxReportScreen } from '@/features/material-box-consulting/screens/MaterialBoxReportScreen';
import { MaterialReflectionScreen } from '@/features/material-box-consulting/screens/MaterialReflectionScreen';

function isMajorPreferenceScreen(
  screen: MaterialBoxScreen | null,
): screen is MajorPreferenceScreen {
  return (
    screen === 'major-one' ||
    screen === 'three-majors' ||
    screen === 'major-input'
  );
}

function isMaterialReflectionScreen(
  screen: MaterialBoxScreen | null,
): screen is MaterialReflectionScreenName {
  return (
    screen === 'career-identity-input' ||
    screen === 'core-value-input' ||
    screen === 'field-strength-input' ||
    screen === 'personal-strength-input'
  );
}

export function MaterialBoxFlow() {
  const session = useConsultingSession(materialBoxConsulting);
  const currentScreen = session.view.screen;
  const hasContinueInteraction =
    session.interaction.kind === 'continue' ||
    session.sequenceEvent === 'CONTINUE';
  const canContinue = hasContinueInteraction && session.isWaitingForUser;
  const hasReviewInteraction = session.interaction.kind === 'major-review';
  const canReviewPreferences = hasReviewInteraction && session.isWaitingForUser;
  const canEditMajors =
    session.interaction.kind === 'major-form' &&
    session.isWaitingForUser &&
    session.sequenceEvent === null;
  const canEditKeyword =
    session.interaction.kind === 'keyword-form' && session.isWaitingForUser;
  const canEditReflection =
    session.interaction.kind === 'reflection-form' && session.isWaitingForUser;

  const reflectionValue = isMaterialReflectionScreen(currentScreen)
    ? {
        'career-identity-input': session.memory.careerIdentity,
        'core-value-input': session.memory.coreValue,
        'field-strength-input': session.memory.fieldStrength,
        'personal-strength-input': session.memory.personalStrength,
      }[currentScreen]
    : '';

  const submitReflection = (
    screen: MaterialReflectionScreenName,
    value: string,
  ) => {
    switch (screen) {
      case 'career-identity-input':
        session.send({
          type: 'SUBMIT_CAREER_IDENTITY',
          careerIdentity: value,
        });
        break;
      case 'core-value-input':
        session.send({ type: 'SUBMIT_CORE_VALUE', coreValue: value });
        break;
      case 'field-strength-input':
        session.send({
          type: 'SUBMIT_FIELD_STRENGTH',
          fieldStrength: value,
        });
        break;
      case 'personal-strength-input':
        session.send({
          type: 'SUBMIT_PERSONAL_STRENGTH',
          personalStrength: value,
        });
        break;
    }
  };

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
            animateTyping={session.nodeId !== 'major-edit'}
            message={session.view.message}
            onTypingComplete={session.completePrompterPresentation}
          >
            {hasReviewInteraction ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canReviewPreferences}
                  onClick={() => session.send({ type: 'EDIT_MAJORS' })}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Undo2 className="size-4" aria-hidden="true" />
                  아니오, 수정할게요
                </Button>
                <ConsultingProgressButton
                  compact
                  disabled={!canReviewPreferences}
                  onClick={() => session.send({ type: 'CONFIRM_MAJORS' })}
                >
                  네, 잘 작성했어요
                </ConsultingProgressButton>
              </div>
            ) : (
              hasContinueInteraction && (
                <ConsultingProgressButton
                  compact
                  disabled={!canContinue}
                  spacebarShortcut
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

      {currentScreen === 'material-box-overview' && (
        <MaterialBoxOverviewScreen
          key={`material-box-overview-${session.presentationKeys.screen}`}
          focus={session.view.materialBoxOverviewFocus}
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

      {isMaterialReflectionScreen(currentScreen) && (
        <MaterialReflectionScreen
          key={currentScreen}
          screen={currentScreen}
          isInteractive={canEditReflection}
          submittedValue={reflectionValue}
          onSubmit={(value) => submitReflection(currentScreen, value)}
        />
      )}

      {currentScreen === 'report' && (
        <MaterialBoxReportScreen memory={session.memory} />
      )}
    </ConsultingMain>
  );
}

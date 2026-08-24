'use client';

import { Undo2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

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
import {
  MajorPreferencesScreen,
  MaterialBoxProgressTable,
} from '@/features/material-box-consulting/screens/MajorPreferencesScreen';
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

const nodesBeforePersistentMaterialBox = new Set([
  'intro',
  'material-box-overview',
  'major',
  'major-review',
  'major-edit',
]);

export function MaterialBoxFlow() {
  const session = useConsultingSession(materialBoxConsulting);
  const shouldReduceMotion = useReducedMotion();
  const currentScreen = session.view.screen;
  const hasCompletedMajor = !nodesBeforePersistentMaterialBox.has(
    session.nodeId,
  );
  const showPersistentMaterialBox =
    hasCompletedMajor && !isMajorPreferenceScreen(currentScreen);
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
      {showPersistentMaterialBox && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
          className="relative z-10 mx-auto mb-5 w-full lg:absolute lg:inset-x-8 lg:top-28 lg:mb-0 lg:w-auto"
        >
          <div className="mx-auto grid w-full max-w-5xl lg:grid-cols-[minmax(0,1fr)_24rem]">
            <aside
              className="w-full lg:col-start-2 lg:w-96"
              aria-label="현재까지 완성된 재료함"
            >
              <MaterialBoxProgressTable
                compact
                expanded
                highlight="keyword"
                keyword={session.memory.keyword}
                preferences={session.memory.majorPreferences}
                showSavedPreferences
                shouldReduceMotion={Boolean(shouldReduceMotion)}
              />
            </aside>
          </div>
        </motion.div>
      )}

      <div
        className={
          showPersistentMaterialBox
            ? 'mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]'
            : undefined
        }
      >
        {isMajorPreferenceScreen(currentScreen) && (
          <MajorPreferencesScreen
            screen={currentScreen}
            isInteractive={canEditMajors}
            materialBoxHighlight={hasCompletedMajor ? 'keyword' : 'major'}
            materialBoxKeyword={session.memory.keyword}
            showMajorHelpButton={!hasCompletedMajor}
            showSavedPreferences={hasCompletedMajor}
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
            recommendations={session.tasks.keywordRecommendations.data ?? []}
            recommendationError={
              session.tasks.keywordRecommendations.error?.message ?? null
            }
            recommendationStatus={session.tasks.keywordRecommendations.status}
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
      </div>
    </ConsultingMain>
  );
}

'use client';

import { AnimatePresence } from 'motion/react';

import { useConsultingProcess } from '@/features/consulting/process/useConsultingProcess';
import { ConsultingMain } from '@/features/consulting/ui/ConsultingMain';
import { ConsultingProgressButton } from '@/features/consulting/ui/ConsultingProgressButton';
import { ConsultingPrompter } from '@/features/consulting/ui/ConsultingPrompter';
import { onboardingProcess } from '@/features/onboarding-consulting/process/graph';
import { WritingComparisonScreen } from '@/features/onboarding-consulting/screens/WritingComparisonScreen';

export function OnboardingFlow() {
  const session = useConsultingProcess(onboardingProcess);
  const canContinue =
    session.interaction.kind === 'continue' && session.isWaitingForUser;
  const canChoose =
    session.interaction.kind === 'writing-choice' && session.isWaitingForUser;

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
            {canContinue && (
              <ConsultingProgressButton
                onClick={() => session.send({ type: 'CONTINUE' })}
              />
            )}
          </ConsultingPrompter>
        )
      }
    >
      <AnimatePresence initial={false}>
        {session.view.screen === 'writing-comparison' && (
          <WritingComparisonScreen
            key={`writing-comparison-${session.presentationKeys.screen}`}
            selectedAnswer={session.memory.answer}
            isInteractive={canChoose}
            onAnimationComplete={session.completeScreenPresentation}
            onSelect={(answer) =>
              session.send({ type: 'SELECT_WRITING', answer })
            }
          />
        )}
      </AnimatePresence>
    </ConsultingMain>
  );
}

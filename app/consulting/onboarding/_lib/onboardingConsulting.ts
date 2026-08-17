import { createConsultingActions } from '@/features/consulting/runner/createConsultingActions';
import { defineConsulting } from '@/features/consulting/runner/defineConsulting';

export type OnboardingAnswer = 'well-written' | 'poorly-written';
export type OnboardingScreen = 'writing-comparison';

export type OnboardingContext = {
  answer: OnboardingAnswer | null;
};

export type OnboardingMemory = Record<never, never>;
export type OnboardingResources = Record<never, never>;

export type OnboardingUserInput =
  | { type: 'continue' }
  | {
      type: 'select-writing';
      answer: OnboardingAnswer;
    };

const action = createConsultingActions<
  OnboardingContext,
  OnboardingMemory,
  OnboardingScreen,
  OnboardingResources
>();

const introView = {
  message:
    '안녕하세요! 지금부터 여러분은 "우수하고 특별한 생활기록부"를 만들어볼거에요.',
  prompterPlacement: 'center' as const,
  prompterSize: 'default' as const,
  screen: null,
};

export const onboardingConsulting = defineConsulting<
  OnboardingContext,
  OnboardingMemory,
  OnboardingScreen,
  OnboardingResources,
  OnboardingUserInput
>({
  initialSystemTurnId: 'intro-system',
  initialContext: {
    answer: null,
  },
  initialMemory: {},
  initialView: introView,
  turns: [
    {
      id: 'intro-system',
      actor: 'system',
      sequence: [action.present(introView, 'prompter')],
      next: 'intro-continue',
    },
    {
      id: 'intro-continue',
      actor: 'user',
      submit: () => undefined,
      next: 'writing-question-system',
    },
    {
      id: 'writing-question-system',
      actor: 'system',
      sequence: [
        action.present(
          {
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
          },
          'layout',
        ),
        action.present(
          { message: '그 전에 먼저, 둘 중에 무엇이 더 나은 것 같나요?' },
          'prompter',
        ),
        action.present({ screen: 'writing-comparison' }, 'screen'),
      ],
      next: 'writing-choice',
    },
    {
      id: 'writing-choice',
      actor: 'user',
      submit: (input) => {
        if (input.type !== 'select-writing') return;
        return { context: { answer: input.answer } };
      },
      next: 'writing-result-system',
    },
    {
      id: 'writing-result-system',
      actor: 'system',
      sequence: [
        action.present(
          ({ context }) => ({
            message:
              context.answer === 'well-written' ? '정답이에요!' : '오답이에요.',
          }),
          'prompter',
        ),
      ],
    },
  ],
});

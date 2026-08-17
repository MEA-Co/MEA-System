import { createPresentationActions } from '@/features/consulting/process/createPresentationActions';
import { defineConsultingProcess } from '@/features/consulting/process/defineConsultingProcess';
import type {
  OnboardingEvent,
  OnboardingInteraction,
  OnboardingMemory,
  OnboardingTaskOutputs,
  OnboardingView,
} from '@/features/onboarding-consulting/model/types';

const presentation = createPresentationActions<
  OnboardingMemory,
  OnboardingView,
  OnboardingTaskOutputs
>();

export const onboardingProcess = defineConsultingProcess<
  OnboardingMemory,
  OnboardingView,
  OnboardingTaskOutputs,
  OnboardingEvent,
  OnboardingInteraction
>({
  initialNodeId: 'intro',
  initialMemory: {
    answer: null,
  },
  initialView: {
    message: null,
    prompterPlacement: 'center',
    prompterSize: 'default',
    screen: null,
  },
  tasks: {},
  nodes: {
    intro: {
      sequence: [
        presentation.present(
          {
            message:
              '안녕하세요! 지금부터 여러분은 "우수하고 특별한 생활기록부"를 만들어볼거에요.',
            prompterPlacement: 'center',
            prompterSize: 'default',
            screen: null,
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'continue' },
      edges: {
        CONTINUE: 'writing-question',
      },
    },
    'writing-question': {
      sequence: [
        presentation.present({ screen: null }),
        presentation.present(
          {
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
          },
          'layout',
        ),
        presentation.present(
          { message: '그 전에 먼저, 둘 중에 무엇이 더 나은 것 같나요?' },
          'prompter',
        ),
        presentation.present({ screen: 'writing-comparison' }, 'screen'),
      ],
      interaction: { kind: 'writing-choice' },
      edges: {
        SELECT_WRITING: {
          target: 'writing-result',
          updateMemory: ({ event }) =>
            event.type === 'SELECT_WRITING'
              ? { answer: event.answer }
              : undefined,
        },
      },
    },
    'writing-result': {
      sequence: [
        presentation.present(
          ({ memory }) => ({
            message:
              memory.answer === 'well-written' ? '정답이에요!' : '오답이에요.',
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'writing-comparison',
          }),
          'prompter',
        ),
      ],
      interaction: { kind: 'none' },
      edges: {},
      terminal: true,
    },
  },
});

import {
  createConsultingActions,
  defineConsulting,
} from '@/features/consulting/sequence/createConsultingSequence';

export type MaterialBoxAnswer = 'well-written' | 'poorly-written';
export type MaterialBoxScreen = 'writing-comparison';

export type MaterialBoxContext = {
  answer: MaterialBoxAnswer | null;
};

const action = createConsultingActions<MaterialBoxContext, MaterialBoxScreen>();

export const materialBoxConsulting = defineConsulting<
  MaterialBoxContext,
  MaterialBoxScreen
>({
  initialContext: {
    answer: null,
  },
  sequence: [
    action.prompter({
      message:
        '안녕하세요! 지금부터 여러분은 "우수하고 특별한 생활기록부"를 만들기 위한 준비 작업을 해볼거에요.',
      placement: 'center',
      size: 'default',
      waitFor: 'continue',
    }),
    action.prompter({
      placement: 'bottom',
      size: 'wide',
      waitFor: 'layout',
    }),
    action.prompter({
      message: '그 전에 먼저, 둘 중에 무엇이 더 나은 것 같나요?',
      waitFor: 'typing',
    }),
    action.screen({
      screen: 'writing-comparison',
      waitFor: 'user',
    }),
    action.prompter({
      message: ({ answer }) =>
        answer === 'well-written' ? '정답이에요!' : '오답이에요.',
      waitFor: 'typing',
    }),
  ],
});

import {
  createConsultingActions,
  defineConsulting,
} from '@/features/consulting/sequence/createConsultingSequence';

export type MajorPreference = {
  major: string;
  reason: string;
};

export type MaterialBoxContext = {
  preferences: Array<MajorPreference>;
};

export type MaterialBoxMemory = {
  majorPreferences: Array<MajorPreference>;
};

export type MaterialBoxScreen =
  'major-one' | 'major-one-with-reason' | 'three-majors' | 'major-input';

const action = createConsultingActions<
  MaterialBoxContext,
  MaterialBoxScreen,
  never,
  MaterialBoxMemory
>();

export const materialBoxConsulting = defineConsulting<
  MaterialBoxContext,
  MaterialBoxScreen,
  never,
  MaterialBoxMemory
>({
  initialContext: {
    preferences: [],
  },
  initialMemory: {
    majorPreferences: [],
  },
  sequence: [
    action.prompter({
      message: [
        {
          text: '앞서 여러분은 생활기록부 브랜딩이란 무엇이며, 브랜딩을 하기 위해서 ',
        },
        { text: '재료함', emphasis: 'accent' },
        { text: '이라는 것이 필요하다는 걸 확인했어요.' },
      ],
      placement: 'center',
      size: 'default',
      waitFor: 'continue',
    }),
    action.prompter({
      message: [
        { text: '이제 본격적으로 ' },
        { text: '재료함', emphasis: 'accent' },
        { text: '을 만들어봅시다!' },
      ],
      waitFor: 'typing',
    }),
    action.prompter({
      placement: 'bottom',
      size: 'wide',
      waitFor: 'layout',
    }),
    action.screen({
      screen: 'major-one',
      waitFor: 'animation',
    }),
    action.prompter({
      message: '우선 여러분이 가고 싶은 학과가 필요해요.',
      waitFor: 'typing',
    }),
    action.screen({
      screen: 'major-one-with-reason',
      waitFor: 'animation',
    }),
    action.prompter({
      message:
        '그 전공을 공부하고 싶은 여러분만의 이유도 필요합니다. 구체적인 이유가 있을 수도 있고, 막연하게 멋있어서 희망할 수도 있어요. 무엇이든 편하게 알려주시면 됩니다.',
      waitFor: 'typing',
    }),
    action.screen({
      screen: 'three-majors',
      waitFor: 'animation',
    }),
    action.prompter({
      message:
        '희망 전공이 하나가 아닐 수도 있습니다. 그 희망전공들에서 여러분만의 스토리가 드러나요. 희망 전공이 여러개라면, 가장 가고 싶은 학과를 3개까지 써주세요.',
      waitFor: 'typing',
    }),
    action.screen({
      screen: 'major-input',
      waitFor: 'user',
    }),
    action.prompter({
      message:
        '잘 작성했나요? 희망 전공은 나중에 얼마든지 달라질 수 있습니다. 희망 전공이 달라지면 어떻게 해야하는지는 나중에 알려드릴게요.',
      waitFor: 'continue',
    }),
    action.memory({
      update: ({ preferences }) => ({
        majorPreferences: preferences.map((preference) => ({ ...preference })),
      }),
    }),
    action.prompter({
      message: '이제 희망 전공을 바탕으로 여러분만의 이야기를 찾아볼게요.',
      waitFor: 'typing',
    }),
  ],
});

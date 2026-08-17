import {
  createConsultingActions,
  defineConsulting,
} from '@/features/consulting/sequence/createConsultingSequence';

export type MajorPreference = {
  major: string;
};

export type MentorAdviceQuestion = 'mentor-interests' | 'keyword-help';

export type MentorAdvice = {
  id: string;
  question: MentorAdviceQuestion;
  mentorName: string;
  mentorMajor: string;
  message: string;
  keyword: string;
};

export type MaterialBoxContext = {
  preferences: Array<MajorPreference>;
  mentorAdvice: Array<MentorAdvice>;
  keyword: string;
};

export type MaterialBoxMemory = {
  majorPreferences: Array<MajorPreference>;
};

export type MajorPreferenceScreen =
  'major-one' | 'three-majors' | 'major-input';

export type MaterialBoxScreen =
  MajorPreferenceScreen | 'keyword-examples' | 'keyword-exploration';

export type MaterialBoxOperation = 'load-mentor-advice';

const action = createConsultingActions<
  MaterialBoxContext,
  MaterialBoxScreen,
  MaterialBoxOperation,
  MaterialBoxMemory
>();

export const materialBoxConsulting = defineConsulting<
  MaterialBoxContext,
  MaterialBoxScreen,
  MaterialBoxOperation,
  MaterialBoxMemory
>({
  initialContext: {
    preferences: [],
    mentorAdvice: [],
    keyword: '',
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
      message: [
        {
          text: '좋습니다! 그런데 전공은 사실 아주 광범위한 내용을 다룬답니다. 여러분이 여러분만의 서사를 담아내려면, 전공 별로 ',
        },
        { text: "'세부 키워드'", emphasis: 'strong' },
        { text: '를 선택해야 해요.' },
      ],
      waitFor: 'continue',
    }),
    action.prompter({
      message: '너무 어렵게 생각하지 않아도 됩니다.',
      waitFor: 'typing',
    }),
    action.screen({
      screen: 'keyword-examples',
      waitFor: 'animation',
    }),
    action.prompter({
      message:
        '이미 여러분만의 관심사가 있을 수도 있고, 조금만 생각해보면 관심 가는 분야가 나올 수도 있어요.',
      waitFor: 'continue',
    }),
    action.external({ operation: 'load-mentor-advice' }),
    action.prompter({
      message: '이제 세부 키워드를 입력해주세요!',
      waitFor: 'typing',
    }),
    action.screen({
      screen: 'keyword-exploration',
      waitFor: 'user',
    }),
  ],
});

const mentorAdviceFixtures: Array<MentorAdvice> = [
  {
    id: 'computer-vr-ar',
    question: 'mentor-interests',
    mentorName: '김민준 멘토',
    mentorMajor: '컴퓨터공학과',
    message:
      '저는 컴퓨터가 현실의 경험을 어떻게 확장할 수 있는지 궁금해서 VR과 AR에 관심을 가졌어요. 수업에서 배운 그래픽과 센서 기술을 가상현실 경험으로 연결해봤습니다.',
    keyword: 'VR/AR',
  },
  {
    id: 'computer-ai-search',
    question: 'mentor-interests',
    mentorName: '박서윤 멘토',
    mentorMajor: '컴퓨터공학과',
    message:
      '저는 필요한 정보를 더 정확하게 찾아주는 기술에 관심이 있었어요. 그래서 인공지능이 사용자의 의도를 이해하는 검색 모델을 저만의 세부 주제로 삼았습니다.',
    keyword: '인공지능 검색 모델',
  },
  {
    id: 'computer-data',
    question: 'keyword-help',
    mentorName: '이서준 멘토',
    mentorMajor: '컴퓨터공학과',
    message:
      '아직 한 분야를 고르기 어렵다면 어디에서나 활용할 수 있는 데이터부터 살펴보세요. 관심 있는 현상의 데이터를 모으고 분석하는 과정은 다양한 전공 주제로 확장할 수 있습니다.',
    keyword: '데이터 분석',
  },
  {
    id: 'linguistics-language-society',
    question: 'keyword-help',
    mentorName: '최하린 멘토',
    mentorMajor: '언어학과',
    message:
      '평소 자주 듣는 말이나 온라인에서 달라지는 표현부터 관찰해보세요. 일상의 언어가 사람과 사회에 어떤 영향을 주는지 궁금해하는 것만으로도 좋은 출발점이 됩니다.',
    keyword: '언어와 사회',
  },
];

export async function executeMaterialBoxExternalAction(
  operation: MaterialBoxOperation,
): Promise<Partial<MaterialBoxContext>> {
  if (operation === 'load-mentor-advice') {
    return {
      mentorAdvice: mentorAdviceFixtures.map((advice) => ({ ...advice })),
    };
  }

  return {};
}

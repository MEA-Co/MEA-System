import type { ConsultingProcessDefinition } from '@/features/consulting/core/process';
import { createSequenceActions } from '@/features/consulting/core/sequence';
import type {
  MaterialBoxEvent,
  MaterialBoxInteraction,
  MaterialBoxMemory,
  MaterialBoxTaskOutputs,
  MaterialBoxView,
} from '@/features/material-box-consulting/model/types';
const sequence = createSequenceActions<
  MaterialBoxMemory,
  MaterialBoxView,
  MaterialBoxTaskOutputs,
  MaterialBoxEvent
>();

export const materialBoxProcess: ConsultingProcessDefinition<
  MaterialBoxMemory,
  MaterialBoxView,
  MaterialBoxTaskOutputs,
  MaterialBoxEvent,
  MaterialBoxInteraction
> = {
  initialNodeId: 'intro',
  initialView: {
    message: null,
    prompterPlacement: 'center',
    prompterSize: 'default',
    screen: null,
  },
  nodes: {
    intro: {
      sequence: [
        sequence.present(
          {
            message: [
              {
                text: '여러분의 생활기록부가 특별해지기 위해서는 ',
              },
              { text: '3년간의 성장서사', emphasis: 'accent' },
              { text: '가 담겨야 하고, 여러분이 하나의 ' },
              { text: '브랜드', emphasis: 'accent' },
              { text: '로 드러나야 합니다.' },
            ],
            prompterPlacement: 'center',
            prompterSize: 'default',
            screen: null,
          },
          'prompter',
        ),
        sequence.awaitEvent('CONTINUE'),
        sequence.present(
          {
            message: [
              {
                text: '바꿔 말하면, 여러분의 생활기록부를 읽었을 때 여러분의 생각, 경험 등으로부터 여러분이 ',
              },
              { text: '어떤 학생인지', emphasis: 'accent' },
              {
                text: '가 보여야 합니다. 활동들이 나열되어 있는 것만으로는 여러분이 어떤 학생인지 잘 드러나지 않습니다.',
              },
            ],
            prompterPlacement: 'center',
            prompterSize: 'default',
            screen: null,
          },
          'prompter',
        ),
        sequence.awaitEvent('CONTINUE'),
        sequence.present(
          {
            message: [
              { text: '그렇게 하기 위해서, 여러분들만의 ' },
              { text: '재료함', emphasis: 'accent' },
              {
                text: '을 만들어두고 앞으로 계속 사용할거에요. 재료함의 내용은 지속적으로 업데이트되거나 추가될 수는 있지만 비어있어서는 안됩니다.',
              },
            ],
          },
          'prompter',
        ),
        sequence.awaitEvent('CONTINUE'),
        sequence.present(
          {
            message: [
              { text: '이번 컨설팅에서는 여러분이라는 브랜드를 담는 ' },
              { text: '재료함', emphasis: 'accent' },
              { text: '을 직접 만들어보겠습니다.' },
            ],
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'continue' },
      edges: {
        CONTINUE: 'majors',
      },
    },
    majors: {
      sequence: [
        sequence.present(
          {
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
          },
          'layout',
        ),
        sequence.present({ screen: 'major-one' }, 'screen'),
        sequence.present(
          { message: '희망 전공에서 출발해보겠습니다.' },
          'prompter',
        ),
        sequence.awaitEvent('CONTINUE'),
        sequence.present(
          {
            message: '희망 전공은 하나일 수도 있고,',
          },
          'prompter',
        ),
        sequence.present({ screen: 'three-majors' }, 'screen'),
        sequence.present(
          {
            message:
              '여러 개일 수도 있습니다. 희망 전공이 여러 개라면 그 희망 전공들에서 여러분들의 특색이 드러나기도 합니다.',
          },
          'prompter',
        ),
        sequence.awaitEvent('CONTINUE'),
        sequence.present(
          {
            message:
              '여러분의 희망 전공은 무엇인가요? 하나라면 1개만, 여러 개라면 가장 가고 싶은 학과를 3개까지 입력해주세요',
          },
          'prompter',
        ),
        sequence.present({ screen: 'major-input' }),
      ],
      interaction: { kind: 'major-form' },
      edges: {
        SUBMIT_MAJORS: {
          target: 'major-review',
          updateMemory: ({ event }) =>
            event.type === 'SUBMIT_MAJORS'
              ? { majorPreferences: event.preferences }
              : undefined,
        },
      },
    },
    'major-review': {
      sequence: [
        sequence.present(
          {
            message:
              '잘 작성했나요? 희망 전공은 학교를 다니면서 얼마든지 달라질 수 있습니다. 중요한 것은 지금 여러분의 관심사와 목표입니다.',
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'major-input',
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'major-review' },
      edges: {
        EDIT_MAJORS: {
          target: 'major-edit',
          history: 'none',
        },
        CONFIRM_MAJORS: 'keyword-intro',
      },
    },
    'major-edit': {
      sequence: [
        sequence.present(
          {
            message:
              '여러분의 희망 전공은 무엇인가요? 하나라면 1개만, 여러 개라면 가장 가고 싶은 학과를 3개까지 입력해주세요.',
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'major-input',
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'major-form' },
      edges: {
        SUBMIT_MAJORS: {
          target: 'major-review',
          history: 'none',
          updateMemory: ({ event }) =>
            event.type === 'SUBMIT_MAJORS'
              ? { majorPreferences: event.preferences }
              : undefined,
        },
      },
    },
    'keyword-intro': {
      sequence: [
        sequence.present(
          {
            message: [
              {
                text: '좋습니다! 그런데 전공은 사실 아주 광범위한 내용을 다룬답니다. 여러분이 여러분만의 서사를 담아내려면, 전공 별로 ',
              },
              { text: "'세부 키워드'", emphasis: 'strong' },
              { text: '를 선택해야 해요.' },
            ],
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'major-input',
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'continue' },
      edges: {
        CONTINUE: 'keyword-examples',
      },
    },
    'keyword-examples': {
      sequence: [
        sequence.present(
          {
            message: '너무 어렵게 생각하지 않아도 됩니다.',
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'major-input',
          },
          'prompter',
        ),
        sequence.present({ screen: 'keyword-examples' }, 'screen'),
        sequence.present(
          {
            message:
              '이미 여러분만의 관심사가 있을 수도 있고, 조금만 생각해보면 관심 가는 분야가 나올 수도 있어요.',
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'continue' },
      edges: {
        CONTINUE: 'keyword-input',
      },
    },
    'keyword-input': {
      sequence: [
        sequence.startTask('mentorAdvice'),
        sequence.present(
          {
            message: '이제 세부 키워드를 입력해주세요!',
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'keyword-exploration',
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'keyword-form' },
      edges: {
        SUBMIT_KEYWORD: {
          target: 'career-identity-input',
          updateMemory: ({ event }) =>
            event.type === 'SUBMIT_KEYWORD'
              ? { keyword: event.keyword }
              : undefined,
        },
      },
    },
    'career-identity-input': {
      sequence: [
        sequence.present(
          {
            message:
              "좋아요. 이제 이 키워드를 바탕으로 궁극적으로 되고 싶은 모습을 하나의 명사형 진로로 붙여볼게요. '무엇을 하는 사람'인지 선명하게 이름 지어보세요.",
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'career-identity-input',
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'reflection-form' },
      edges: {
        SUBMIT_CAREER_IDENTITY: {
          target: 'core-value-input',
          updateMemory: ({ event }) =>
            event.type === 'SUBMIT_CAREER_IDENTITY'
              ? { careerIdentity: event.careerIdentity }
              : undefined,
        },
      },
    },
    'core-value-input': {
      sequence: [
        sequence.present(
          {
            message:
              '진로의 이름을 정했다면, 이제 그 일을 통해 지키고 싶은 가치를 찾아볼 차례예요. 관심 분야에서 아직 해결되지 않은 문제에 시선을 두어보세요.',
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'core-value-input',
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'reflection-form' },
      edges: {
        SUBMIT_CORE_VALUE: {
          target: 'field-strength-input',
          updateMemory: ({ event }) =>
            event.type === 'SUBMIT_CORE_VALUE'
              ? { coreValue: event.coreValue }
              : undefined,
        },
      },
    },
    'field-strength-input': {
      sequence: [
        sequence.present(
          {
            message:
              '그 문제를 해결할 때 여러분은 어떤 힘을 발휘할 수 있을까요? 잘하는 과목과 잘하는 이유를 연결하면 강점이 더 구체적으로 보입니다.',
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'field-strength-input',
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'reflection-form' },
      edges: {
        SUBMIT_FIELD_STRENGTH: {
          target: 'personal-strength-input',
          updateMemory: ({ event }) =>
            event.type === 'SUBMIT_FIELD_STRENGTH'
              ? { fieldStrength: event.fieldStrength }
              : undefined,
        },
      },
    },
    'personal-strength-input': {
      sequence: [
        sequence.present(
          {
            message:
              '마지막으로 성적이나 진로와 바로 연결되지 않아도 괜찮아요. 평소 반복하는 습관과 자연스럽게 드러나는 장점을 떠올려보세요.',
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'personal-strength-input',
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'reflection-form' },
      edges: {
        SUBMIT_PERSONAL_STRENGTH: {
          target: 'complete',
          updateMemory: ({ event }) =>
            event.type === 'SUBMIT_PERSONAL_STRENGTH'
              ? { personalStrength: event.personalStrength }
              : undefined,
        },
      },
    },
    complete: {
      sequence: [
        sequence.present(
          {
            message:
              '좋습니다! 진로의 모습, 중요 가치, 분야 역량, 평소의 장점까지 재료함에 모두 담겼어요. 이 재료들은 앞으로 여러분만의 활동과 성장 서사를 설계하는 기준이 됩니다.',
            screen: 'report',
          },
          'prompter',
        ),
      ],
      interaction: { kind: 'complete' },
      edges: {},
      terminal: true,
    },
  },
};

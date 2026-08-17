import { createPresentationActions } from '@/features/consulting/core/presentation';
import type { ConsultingProcessDefinition } from '@/features/consulting/core/process';
import {
  introMessage,
  keywordInterestMessage,
  keywordIntroMessage,
  majorInputMessage,
  majorReviewMessage,
  startMessage,
} from '@/features/material-box-consulting/model/messages';
import type {
  MaterialBoxEvent,
  MaterialBoxInteraction,
  MaterialBoxMemory,
  MaterialBoxTaskOutputs,
  MaterialBoxView,
} from '@/features/material-box-consulting/model/types';
const presentation = createPresentationActions<
  MaterialBoxMemory,
  MaterialBoxView,
  MaterialBoxTaskOutputs
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
        presentation.present(
          {
            message: introMessage,
            prompterPlacement: 'center',
            prompterSize: 'default',
            screen: null,
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
        presentation.present(
          {
            message: startMessage,
            prompterPlacement: 'center',
            prompterSize: 'default',
            screen: null,
          },
          'prompter',
        ),
        presentation.present(
          {
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
          },
          'layout',
        ),
        presentation.present({ screen: 'major-one' }, 'screen'),
        presentation.present(
          { message: '우선 여러분이 가고 싶은 학과가 필요해요.' },
          'prompter',
        ),
        presentation.present({ screen: 'three-majors' }, 'screen'),
        presentation.present({ message: majorInputMessage }, 'prompter'),
        presentation.present({ screen: 'major-input' }),
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
        presentation.present(
          {
            message: majorReviewMessage,
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
        presentation.present(
          {
            message: majorInputMessage,
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
        presentation.present(
          {
            message: keywordIntroMessage,
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
        presentation.present(
          {
            message: '너무 어렵게 생각하지 않아도 됩니다.',
            prompterPlacement: 'bottom',
            prompterSize: 'wide',
            screen: 'major-input',
          },
          'prompter',
        ),
        presentation.present({ screen: 'keyword-examples' }, 'screen'),
        presentation.present({ message: keywordInterestMessage }, 'prompter'),
      ],
      interaction: { kind: 'continue' },
      edges: {
        CONTINUE: 'keyword-input',
      },
    },
    'keyword-input': {
      sequence: [
        presentation.startTask('mentorAdvice'),
        presentation.present(
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
          target: null,
          updateMemory: ({ event }) =>
            event.type === 'SUBMIT_KEYWORD'
              ? { keyword: event.keyword }
              : undefined,
        },
      },
    },
  },
};

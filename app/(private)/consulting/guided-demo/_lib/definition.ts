import type {
  StudyRoutineContext,
  StudyRoutineTools,
} from '@/app/(private)/consulting/guided-demo/_lib/types';
import { defineGuidedConsulting } from '@/features/guided-consulting/core/definition';

function requireValue(value: string, message: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

export const studyRoutineConsulting = defineGuidedConsulting<
  StudyRoutineContext,
  StudyRoutineTools
>({
  id: 'study-routine-demo',
  title: '나만의 학습 루틴 만들기',
  createInitialContext: () => ({
    goal: '',
    availableTime: '',
    suggestedRoutine: '',
    adjustment: '',
    finalRoutine: '',
  }),
  steps: [
    {
      id: 'goal',
      explain: [
        {
          eyebrow: 'STEP 1 · 목표',
          title: '먼저 이번 주의 방향을 정해볼게요',
          description:
            '좋은 학습 루틴은 무엇을 바꾸고 싶은지 분명하게 정하는 것에서 시작해요.',
        },
        {
          eyebrow: 'STEP 1 · 목표',
          title: '작고 확인 가능한 행동이 좋아요',
          description:
            '크고 추상적인 결과보다 일주일 안에 반복 여부를 확인할 수 있는 행동을 적어보세요.',
          tips: [
            '결과보다 반복하고 싶은 행동을 적어보세요.',
            '한 번에 한 가지 목표에 집중해보세요.',
          ],
        },
      ],
      input: {
        label: '이번 주의 학습 목표',
        placeholder: '예: 영어 지문을 매일 한 개씩 분석하기',
        maxLength: 100,
      },
      validate: (value) => requireValue(value, '학습 목표를 입력해 주세요.'),
      action: ({ value }) => ({
        context: { goal: value },
      }),
    },
    {
      id: 'available-time',
      explain: ({ goal }) => [
        {
          eyebrow: 'STEP 2 · 현실성',
          title: '목표를 실천할 시간을 찾아볼게요',
          description: `이제 ‘${goal}’을 일상 안에서 언제 실천할 수 있을지 살펴볼 차례예요.`,
        },
        {
          eyebrow: 'STEP 2 · 현실성',
          title: '이상적인 시간보다 실제 가능한 시간이 중요해요',
          description:
            '짧더라도 꾸준히 확보할 수 있는 시간을 기준으로 잡으면 루틴을 유지하기 쉬워져요.',
          tips: [
            '학교와 학원 일정을 고려해보세요.',
            '짧더라도 반복 가능한 시간이 더 좋습니다.',
          ],
        },
      ],
      input: {
        label: '사용할 수 있는 시간',
        placeholder: '예: 평일 저녁 40분, 주말 오전 1시간',
        maxLength: 100,
      },
      validate: (value) =>
        requireValue(value, '사용할 수 있는 시간을 입력해 주세요.'),
      action: async ({ value, context, tools, signal }) => {
        const suggestedRoutine = await tools.suggestRoutine(
          { goal: context.goal, availableTime: value },
          { signal },
        );

        return {
          context: {
            availableTime: value,
            suggestedRoutine,
          },
        };
      },
    },
    {
      id: 'adjustment',
      explain: ({ suggestedRoutine }) => [
        {
          eyebrow: 'STEP 3 · 조정',
          title: '입력한 내용을 바탕으로 루틴을 만들었어요',
          description: suggestedRoutine,
        },
        {
          eyebrow: 'STEP 3 · 조정',
          title: '마지막으로 나에게 맞게 조정해요',
          description:
            '추천안은 출발점이에요. 내가 실제로 시작하기 편한 방식으로 바꾸면 더 오래 유지할 수 있어요.',
          tips: [
            '부담스러운 부분은 더 작게 줄여도 됩니다.',
            '시작하기 쉽게 만드는 나만의 방법을 더해보세요.',
          ],
        },
      ],
      input: {
        label: '바꾸거나 덧붙이고 싶은 점',
        placeholder:
          '예: 집중을 시작하기 어려우니 책상에 앉으면 먼저 타이머를 켜고 싶어요.',
        multiline: true,
        maxLength: 200,
      },
      validate: (value) =>
        requireValue(value, '나에게 맞게 조정할 내용을 입력해 주세요.'),
      action: ({ value, context }) => ({
        context: {
          adjustment: value,
          finalRoutine: `${context.suggestedRoutine}. 여기에 ‘${value}’을 더해 나만의 방식으로 실천합니다.`,
        },
      }),
    },
  ],
});

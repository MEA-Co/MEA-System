import {
  createConsultingActions,
  defineConsulting,
} from '@/features/consulting/sequence/createConsultingSequence';

export type MaterialBoxContext = Record<string, never>;
export type MaterialBoxScreen = never;

const action = createConsultingActions<MaterialBoxContext, MaterialBoxScreen>();

export const materialBoxConsulting = defineConsulting<
  MaterialBoxContext,
  MaterialBoxScreen
>({
  initialContext: {},
  sequence: [
    action.prompter({
      message:
        '앞서 여러분은 생활기록부 브랜딩이란 무엇이며, 브랜딩을 하기 위해서 재료함이라는 것이 필요하다는 걸 확인했어요. ',
      placement: 'center',
      size: 'default',
      waitFor: 'typing',
    }),
  ],
});

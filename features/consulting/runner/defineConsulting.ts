import type { ConsultingDefinition } from '@/features/consulting/runner/types';

export function defineConsulting<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
  UserInput,
>(
  definition: ConsultingDefinition<
    Context,
    Memory,
    Screen,
    Resources,
    UserInput
  >,
): ConsultingDefinition<Context, Memory, Screen, Resources, UserInput> {
  const turnsById = new Map(definition.turns.map((turn) => [turn.id, turn]));
  const initialTurn = turnsById.get(definition.initialSystemTurnId);

  if (!initialTurn || initialTurn.actor !== 'system') {
    throw new Error('컨설팅은 시스템 턴으로 시작해야 합니다.');
  }

  for (const turn of definition.turns) {
    if (typeof turn.next !== 'string') continue;

    const target = turnsById.get(turn.next);
    if (!target) {
      throw new Error(
        `${turn.id}의 다음 턴 ${turn.next}이 정의되지 않았습니다.`,
      );
    }

    if (target.actor === turn.actor) {
      throw new Error(
        `${turn.id}에서 ${turn.next}(으)로 같은 주체의 턴을 연속 실행할 수 없습니다.`,
      );
    }
  }

  return definition;
}

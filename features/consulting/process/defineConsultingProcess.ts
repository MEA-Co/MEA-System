import type {
  ConsultingEdge,
  ConsultingEvent,
  ConsultingProcessDefinition,
} from '@/features/consulting/process/types';

export function defineConsultingProcess<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
  Interaction,
>(
  definition: ConsultingProcessDefinition<
    Memory,
    View,
    TaskOutputs,
    Event,
    Interaction
  >,
) {
  if (!definition.nodes[definition.initialNodeId]) {
    throw new Error(
      `초기 노드 ${definition.initialNodeId}가 정의되지 않았습니다.`,
    );
  }

  for (const [nodeId, node] of Object.entries(definition.nodes)) {
    const edges = Object.values(node.edges) as Array<
      ConsultingEdge<Memory, View, TaskOutputs, Event> | undefined
    >;

    for (const edge of edges) {
      if (!edge) continue;
      const target = typeof edge === 'string' ? edge : edge.target;
      if (typeof target !== 'string') continue;

      if (!definition.nodes[target]) {
        throw new Error(
          `${nodeId} 노드의 목적지 ${target}가 정의되지 않았습니다.`,
        );
      }
    }

    for (const action of node.sequence ?? []) {
      if (
        (action.type === 'task.start' || action.type === 'task.await') &&
        !definition.tasks[action.task]
      ) {
        throw new Error(
          `${nodeId} 노드의 태스크 ${action.task}가 정의되지 않았습니다.`,
        );
      }
    }
  }

  return definition;
}

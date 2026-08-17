import type { ConsultingMemoryDefinition } from '@/features/consulting/core/memory';
import type {
  ConsultingEdge,
  ConsultingEvent,
  ConsultingProcessDefinition,
} from '@/features/consulting/core/process';
import type { ConsultingTaskDefinitions } from '@/features/consulting/core/task';

export interface ConsultingDefinition<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
  Interaction,
> {
  memory: ConsultingMemoryDefinition<Memory>;
  tasks: ConsultingTaskDefinitions<Memory, View, TaskOutputs>;
  process: ConsultingProcessDefinition<
    Memory,
    View,
    TaskOutputs,
    Event,
    Interaction
  >;
}

export function defineConsulting<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
  Interaction,
>(
  definition: ConsultingDefinition<
    Memory,
    View,
    TaskOutputs,
    Event,
    Interaction
  >,
): ConsultingDefinition<Memory, View, TaskOutputs, Event, Interaction> {
  const { process, tasks } = definition;

  if (!process.nodes[process.initialNodeId]) {
    throw new Error(
      `초기 노드 ${process.initialNodeId}가 정의되지 않았습니다.`,
    );
  }

  for (const [nodeId, node] of Object.entries(process.nodes)) {
    const edges = Object.values(node.edges) as Array<
      ConsultingEdge<Memory, View, TaskOutputs, Event> | undefined
    >;

    for (const edge of edges) {
      if (!edge) continue;
      const target = typeof edge === 'string' ? edge : edge.target;
      if (typeof target !== 'string') continue;

      if (!process.nodes[target]) {
        throw new Error(
          `${nodeId} 노드의 목적지 ${target}가 정의되지 않았습니다.`,
        );
      }
    }

    for (const action of node.sequence ?? []) {
      if (
        (action.type === 'task.start' || action.type === 'task.await') &&
        !tasks[action.task]
      ) {
        throw new Error(
          `${nodeId} 노드의 태스크 ${action.task}가 정의되지 않았습니다.`,
        );
      }
    }
  }

  return definition;
}

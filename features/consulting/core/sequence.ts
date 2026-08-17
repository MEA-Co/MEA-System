import type {
  ConsultingEvent,
  ConsultingSequenceAction,
  ConsultingUpdate,
  PresentationWaitFor,
} from '@/features/consulting/core/process';
import type { ConsultingRuntimeSnapshot } from '@/features/consulting/core/task';

export function createSequenceActions<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
>() {
  type Runtime = ConsultingRuntimeSnapshot<Memory, View, TaskOutputs>;
  type Action = ConsultingSequenceAction<Memory, View, TaskOutputs, Event>;

  return {
    awaitEvent<Type extends Event['type']>(event: Type): Action {
      return { type: 'event.await', event } as Action;
    },

    present(
      view: Partial<View> | ((runtime: Runtime) => Partial<View>),
      waitFor: PresentationWaitFor = 'immediate',
    ): Action {
      return { type: 'present', view, waitFor } as Action;
    },

    startTask<Key extends keyof TaskOutputs & string>(
      task: Key,
      options: { policy?: 'restart' | 'reuse' } = {},
    ): Action {
      return {
        type: 'task.start',
        task,
        policy: options.policy ?? 'restart',
      } as Action;
    },

    awaitTask<Key extends keyof TaskOutputs & string>(
      task: Key,
      apply?: (
        result: TaskOutputs[Key],
        runtime: Runtime,
      ) =>
        | ConsultingUpdate<Memory, View>
        | void
        | Promise<ConsultingUpdate<Memory, View> | void>,
    ): Action {
      return { type: 'task.await', task, apply } as Action;
    },
  };
}

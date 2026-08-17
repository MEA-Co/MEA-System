import type {
  ConsultingRuntime,
  ConsultingUpdate,
  PresentationAction,
  PresentationWaitFor,
} from '@/features/consulting/process/types';

export function createPresentationActions<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
>() {
  type Runtime = ConsultingRuntime<Memory, View, TaskOutputs>;
  type Action = PresentationAction<Memory, View, TaskOutputs>;

  return {
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

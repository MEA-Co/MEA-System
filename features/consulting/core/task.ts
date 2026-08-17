export type ConsultingTaskStatus = 'idle' | 'running' | 'success' | 'error';

export interface ConsultingTaskState<Output> {
  status: ConsultingTaskStatus;
  data: Output | null;
  error: Error | null;
}

export type ConsultingTaskStates<TaskOutputs extends object> = {
  readonly [Key in keyof TaskOutputs]: ConsultingTaskState<TaskOutputs[Key]>;
};

export interface ConsultingRuntimeSnapshot<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> {
  memory: Readonly<Memory>;
  view: Readonly<View>;
  tasks: ConsultingTaskStates<TaskOutputs>;
}

export type ConsultingTaskDefinitions<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> = {
  [Key in keyof TaskOutputs]: (
    runtime: ConsultingRuntimeSnapshot<Memory, View, TaskOutputs> & {
      signal: AbortSignal;
    },
  ) => TaskOutputs[Key] | Promise<TaskOutputs[Key]>;
};

export function defineConsultingTasks<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
>(
  tasks: ConsultingTaskDefinitions<Memory, View, TaskOutputs>,
): ConsultingTaskDefinitions<Memory, View, TaskOutputs> {
  return tasks;
}

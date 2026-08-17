export type ConsultingProcessPhase =
  'presenting' | 'waiting-for-user' | 'transitioning' | 'complete' | 'error';

export type PresentationWaitFor =
  'immediate' | 'prompter' | 'layout' | 'screen';

export type ConsultingTaskStatus = 'idle' | 'running' | 'success' | 'error';

export type ConsultingTaskState<Output> = {
  status: ConsultingTaskStatus;
  data: Output | null;
  error: Error | null;
};

export type ConsultingTaskStates<TaskOutputs extends object> = {
  readonly [Key in keyof TaskOutputs]: ConsultingTaskState<TaskOutputs[Key]>;
};

export type ConsultingRuntime<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> = {
  memory: Readonly<Memory>;
  view: Readonly<View>;
  tasks: ConsultingTaskStates<TaskOutputs>;
};

export type ConsultingTaskDefinitions<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> = {
  [Key in keyof TaskOutputs]: (
    runtime: ConsultingRuntime<Memory, View, TaskOutputs> & {
      signal: AbortSignal;
    },
  ) => TaskOutputs[Key] | Promise<TaskOutputs[Key]>;
};

export type ConsultingUpdate<Memory extends object, View extends object> = {
  memory?: Partial<Memory>;
  view?: Partial<View>;
};

export type PresentAction<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> = {
  type: 'present';
  view:
    | Partial<View>
    | ((
        runtime: ConsultingRuntime<Memory, View, TaskOutputs> & {
          phase: ConsultingProcessPhase;
        },
      ) => Partial<View>);
  waitFor: PresentationWaitFor;
};

export type StartTaskAction<TaskOutputs extends object> = {
  type: 'task.start';
  task: keyof TaskOutputs & string;
  policy: 'restart' | 'reuse';
};

export type AwaitTaskAction<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> = {
  type: 'task.await';
  task: keyof TaskOutputs & string;
  apply?: (
    result: TaskOutputs[keyof TaskOutputs],
    runtime: ConsultingRuntime<Memory, View, TaskOutputs>,
  ) =>
    | ConsultingUpdate<Memory, View>
    | void
    | Promise<ConsultingUpdate<Memory, View> | void>;
};

export type PresentationAction<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> =
  | PresentAction<Memory, View, TaskOutputs>
  | StartTaskAction<TaskOutputs>
  | AwaitTaskAction<Memory, View, TaskOutputs>;

export type ConsultingEvent = { type: string };

export type EdgeRuntime<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
> = ConsultingRuntime<Memory, View, TaskOutputs> & {
  event: Event;
};

export type ConsultingEdge<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
> =
  | string
  | {
      target:
        | string
        | null
        | ((
            runtime: EdgeRuntime<Memory, View, TaskOutputs, Event>,
          ) => string | null);
      updateMemory?: (
        runtime: EdgeRuntime<Memory, View, TaskOutputs, Event>,
      ) => Partial<Memory> | void | Promise<Partial<Memory> | void>;
      history?: 'push' | 'replace' | 'none';
    };

export type ConsultingNode<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
  Interaction,
> = {
  sequence?: ReadonlyArray<PresentationAction<Memory, View, TaskOutputs>>;
  interaction: Interaction;
  edges: Partial<
    Record<Event['type'], ConsultingEdge<Memory, View, TaskOutputs, Event>>
  >;
  terminal?: boolean;
};

export type ConsultingProcessDefinition<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
  Interaction,
> = {
  initialNodeId: string;
  initialMemory: Memory;
  initialView: View;
  tasks: ConsultingTaskDefinitions<Memory, View, TaskOutputs>;
  nodes: Record<
    string,
    ConsultingNode<Memory, View, TaskOutputs, Event, Interaction>
  >;
};

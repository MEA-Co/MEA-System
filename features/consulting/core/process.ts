import type {
  ConsultingRuntimeSnapshot,
  ConsultingTaskStates,
} from '@/features/consulting/core/task';

export type ConsultingProcessPhase =
  'presenting' | 'waiting-for-user' | 'transitioning' | 'complete' | 'error';

export type PresentationWaitFor =
  'immediate' | 'prompter' | 'layout' | 'screen';

export interface ConsultingEvent {
  type: string;
}

export interface ConsultingUpdate<Memory extends object, View extends object> {
  memory?: Partial<Memory>;
  view?: Partial<View>;
}

export interface PresentAction<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> {
  type: 'present';
  view:
    | Partial<View>
    | ((
        runtime: ConsultingRuntimeSnapshot<Memory, View, TaskOutputs> & {
          phase: ConsultingProcessPhase;
        },
      ) => Partial<View>);
  waitFor: PresentationWaitFor;
}

export interface StartTaskAction<TaskOutputs extends object> {
  type: 'task.start';
  task: keyof TaskOutputs & string;
  policy: 'restart' | 'reuse';
}

export type AwaitTaskAction<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
> = {
  [Key in keyof TaskOutputs & string]: {
    type: 'task.await';
    task: Key;
    apply?: (
      result: TaskOutputs[Key],
      runtime: ConsultingRuntimeSnapshot<Memory, View, TaskOutputs>,
    ) =>
      | ConsultingUpdate<Memory, View>
      | void
      | Promise<ConsultingUpdate<Memory, View> | void>;
  };
}[keyof TaskOutputs & string];

export interface AwaitEventAction<Event extends ConsultingEvent> {
  type: 'event.await';
  event: Event['type'];
}

export type ConsultingSequenceAction<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
> =
  | PresentAction<Memory, View, TaskOutputs>
  | StartTaskAction<TaskOutputs>
  | AwaitTaskAction<Memory, View, TaskOutputs>
  | AwaitEventAction<Event>;

export type EdgeRuntime<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
> = ConsultingRuntimeSnapshot<Memory, View, TaskOutputs> & {
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

export interface ConsultingNode<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
  Interaction,
> {
  sequence?: ReadonlyArray<
    ConsultingSequenceAction<Memory, View, TaskOutputs, Event>
  >;
  interaction: Interaction;
  edges: Partial<
    Record<Event['type'], ConsultingEdge<Memory, View, TaskOutputs, Event>>
  >;
  terminal?: boolean;
}

export interface ConsultingProcessDefinition<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
  Interaction,
> {
  initialNodeId: string;
  initialView: View;
  nodes: Record<
    string,
    ConsultingNode<Memory, View, TaskOutputs, Event, Interaction>
  >;
}

export interface ConsultingSession<
  Memory extends object,
  View extends object,
  TaskOutputs extends object,
  Event extends ConsultingEvent,
  Interaction,
> {
  nodeId: string;
  interaction: Interaction;
  phase: ConsultingProcessPhase;
  isWaitingForUser: boolean;
  sequenceEvent: Event['type'] | null;
  view: View;
  memory: Memory;
  tasks: ConsultingTaskStates<TaskOutputs>;
  presentationKeys: {
    prompter: number;
    layout: number;
    screen: number;
  };
  error: Error | null;
  isComplete: boolean;
  canGoBack: boolean;
  completePrompterPresentation: () => void;
  completeLayoutPresentation: () => void;
  completeScreenPresentation: () => void;
  send: (event: Event) => void;
  goBack: () => void;
  retryCurrentNode: () => void;
}

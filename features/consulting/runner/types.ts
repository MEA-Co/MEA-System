import type {
  ConsultingPrompterPlacement,
  ConsultingPrompterSize,
} from '@/features/consulting/components/ConsultingMain';
import type { ConsultingMessage } from '@/features/consulting/types';

export type ConsultingActor = 'system' | 'user';

export type ConsultingTurnPhase =
  'presenting' | 'running' | 'waiting-for-user' | 'submitting' | 'error';

export type ConsultingPresentation =
  'immediate' | 'prompter' | 'layout' | 'screen';

export type ConsultingView<Screen extends string> = {
  message: ConsultingMessage;
  prompterPlacement: ConsultingPrompterPlacement;
  prompterSize: ConsultingPrompterSize;
  screen: Screen | null;
};

export type ConsultingResourceStatus = 'idle' | 'loading' | 'success' | 'error';

export type ConsultingResourceState<Data> = {
  status: ConsultingResourceStatus;
  data: Data | null;
  error: Error | null;
};

export type ConsultingResources<Resources extends object> = {
  readonly [Key in keyof Resources]: ConsultingResourceState<Resources[Key]>;
};

export type ConsultingRuntime<
  Context extends object,
  Memory extends object,
  Resources extends object,
> = {
  context: Readonly<Context>;
  memory: Readonly<Memory>;
  resources: ConsultingResources<Resources>;
};

export type ConsultingViewRuntime<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
> = ConsultingRuntime<Context, Memory, Resources> & {
  phase: ConsultingTurnPhase;
  view: Readonly<ConsultingView<Screen>>;
};

export type ConsultingViewUpdateDefinition<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
> =
  | Partial<ConsultingView<Screen>>
  | ((
      runtime: ConsultingViewRuntime<Context, Memory, Screen, Resources>,
    ) => Partial<ConsultingView<Screen>>);

export type ConsultingUpdate<Context extends object, Memory extends object> = {
  context?: Partial<Context>;
  memory?: Partial<Memory>;
};

export type ConsultingNextRuntime<
  Context extends object,
  Memory extends object,
  Resources extends object,
  UserInput,
> = ConsultingRuntime<Context, Memory, Resources> & {
  input: UserInput;
};

export type ConsultingNext<
  Context extends object,
  Memory extends object,
  Resources extends object,
  UserInput,
> =
  | string
  | ((
      runtime: ConsultingNextRuntime<Context, Memory, Resources, UserInput>,
    ) => string | null);

export type PresentSystemAction<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
> = {
  type: 'present';
  view: ConsultingViewUpdateDefinition<Context, Memory, Screen, Resources>;
  waitFor: ConsultingPresentation;
};

export type RunSystemAction<
  Context extends object,
  Memory extends object,
  Resources extends object,
> = {
  type: 'run';
  run: (
    runtime: ConsultingRuntime<Context, Memory, Resources> & {
      signal: AbortSignal;
    },
  ) =>
    | ConsultingUpdate<Context, Memory>
    | void
    | Promise<ConsultingUpdate<Context, Memory> | void>;
};

export type StartResourceSystemAction<
  Context extends object,
  Memory extends object,
  Resources extends object,
> = {
  type: 'resource.start';
  resource: keyof Resources & string;
  run: (
    runtime: ConsultingRuntime<Context, Memory, Resources> & {
      signal: AbortSignal;
    },
  ) => Resources[keyof Resources] | Promise<Resources[keyof Resources]>;
};

export type AwaitResourceSystemAction<
  Context extends object,
  Memory extends object,
  Resources extends object,
> = {
  type: 'resource.await';
  resource: keyof Resources & string;
  apply?: (
    data: Resources[keyof Resources],
    runtime: ConsultingRuntime<Context, Memory, Resources>,
  ) => ConsultingUpdate<Context, Memory> | void;
};

export type CancelResourceSystemAction<Resources extends object> = {
  type: 'resource.cancel';
  resource: keyof Resources & string;
};

export type ConsultingSystemAction<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
> =
  | PresentSystemAction<Context, Memory, Screen, Resources>
  | RunSystemAction<Context, Memory, Resources>
  | StartResourceSystemAction<Context, Memory, Resources>
  | AwaitResourceSystemAction<Context, Memory, Resources>
  | CancelResourceSystemAction<Resources>;

export type SystemTurn<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
> = {
  id: string;
  actor: 'system';
  sequence: ReadonlyArray<
    ConsultingSystemAction<Context, Memory, Screen, Resources>
  >;
  next?: string;
};

export type UserTurn<
  Context extends object,
  Memory extends object,
  Resources extends object,
  UserInput,
> = {
  id: string;
  actor: 'user';
  submit: (
    input: UserInput,
    runtime: ConsultingRuntime<Context, Memory, Resources>,
  ) =>
    | ConsultingUpdate<Context, Memory>
    | void
    | Promise<ConsultingUpdate<Context, Memory> | void>;
  next?: ConsultingNext<Context, Memory, Resources, UserInput>;
  checkpoint?: boolean;
};

export type ConsultingTurn<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
  UserInput,
> =
  | SystemTurn<Context, Memory, Screen, Resources>
  | UserTurn<Context, Memory, Resources, UserInput>;

export type ConsultingDefinition<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
  UserInput,
> = {
  initialSystemTurnId: string;
  initialContext: Context;
  initialMemory: Memory;
  initialView: ConsultingView<Screen>;
  turns: ReadonlyArray<
    ConsultingTurn<Context, Memory, Screen, Resources, UserInput>
  >;
};

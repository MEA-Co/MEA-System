import type {
  ConsultingPrompterPlacement,
  ConsultingPrompterSize,
} from '@/features/consulting/components/ConsultingMain';
import type { ConsultingMessage } from '@/features/consulting/types';

export type ConsultingValue<T, Context, Memory extends object> =
  T | ((context: Readonly<Context>, memory: Readonly<Memory>) => T);

export type PrompterWait = 'none' | 'typing' | 'continue' | 'layout';

export type PrompterAction<Context, Memory extends object> = {
  type: 'prompter';
  message?: ConsultingValue<ConsultingMessage, Context, Memory>;
  placement?: ConsultingPrompterPlacement;
  size?: ConsultingPrompterSize;
  waitFor?: PrompterWait;
};

export type ScreenAction<
  Context,
  Memory extends object,
  Screen extends string,
> = {
  type: 'screen';
  screen: ConsultingValue<Screen | null, Context, Memory>;
  waitFor?: 'none' | 'user' | 'animation';
};

export type ConsultingMemoryUpdate<
  Context extends object,
  Memory extends object,
> =
  | Partial<Memory>
  | ((context: Readonly<Context>, memory: Readonly<Memory>) => Partial<Memory>);

export type MemoryAction<Context extends object, Memory extends object> = {
  type: 'memory';
  update: ConsultingMemoryUpdate<Context, Memory>;
};

export type ExternalAction<Operation extends string> = {
  type: 'external';
  operation: Operation;
};

export type ConsultingAction<
  Context extends object,
  Screen extends string,
  Operation extends string,
  Memory extends object,
> =
  | PrompterAction<Context, Memory>
  | ScreenAction<Context, Memory, Screen>
  | MemoryAction<Context, Memory>
  | ExternalAction<Operation>;

export type ConsultingDefinition<
  Context extends object,
  Screen extends string,
  Operation extends string,
  Memory extends object,
> = {
  initialContext: Context;
  initialMemory: Memory;
  sequence: ReadonlyArray<ConsultingAction<Context, Screen, Operation, Memory>>;
};

export type ConsultingContextUpdate<Context extends object> =
  Partial<Context> | ((context: Context) => Context);

export type ExternalActionExecutor<
  Context extends object,
  Operation extends string,
  Memory extends object,
> = (
  operation: Operation,
  context: Readonly<Context>,
  memory: Readonly<Memory>,
) => Promise<Partial<Context> | void>;

export type ConsultingView<Screen extends string> = {
  message: ConsultingMessage;
  prompterPlacement: ConsultingPrompterPlacement;
  prompterSize: ConsultingPrompterSize;
  screen: Screen | null;
};

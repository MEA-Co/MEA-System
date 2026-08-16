import type {
  ConsultingPrompterPlacement,
  ConsultingPrompterSize,
} from '@/features/consulting/components/ConsultingMain';
import type { ConsultingMessage } from '@/features/consulting/types';

export type ConsultingValue<T, Context> =
  T | ((context: Readonly<Context>) => T);

export type PrompterWait = 'none' | 'typing' | 'continue' | 'layout';

export type PrompterAction<Context> = {
  type: 'prompter';
  message?: ConsultingValue<ConsultingMessage, Context>;
  placement?: ConsultingPrompterPlacement;
  size?: ConsultingPrompterSize;
  waitFor?: PrompterWait;
};

export type ScreenAction<Context, Screen extends string> = {
  type: 'screen';
  screen: ConsultingValue<Screen | null, Context>;
  waitFor?: 'none' | 'user';
};

export type ExternalAction<Operation extends string> = {
  type: 'external';
  operation: Operation;
};

export type ConsultingAction<
  Context,
  Screen extends string,
  Operation extends string,
> =
  | PrompterAction<Context>
  | ScreenAction<Context, Screen>
  | ExternalAction<Operation>;

export type ConsultingDefinition<
  Context extends object,
  Screen extends string,
  Operation extends string,
> = {
  initialContext: Context;
  sequence: ReadonlyArray<ConsultingAction<Context, Screen, Operation>>;
};

export type ConsultingContextUpdate<Context extends object> =
  Partial<Context> | ((context: Context) => Context);

export type ExternalActionExecutor<
  Context extends object,
  Operation extends string,
> = (
  operation: Operation,
  context: Readonly<Context>,
) => Promise<Partial<Context> | void>;

export type ConsultingView<Screen extends string> = {
  message: ConsultingMessage;
  prompterPlacement: ConsultingPrompterPlacement;
  prompterSize: ConsultingPrompterSize;
  screen: Screen | null;
};

import type {
  ConsultingDefinition,
  ExternalAction,
  MemoryAction,
  PrompterAction,
  ScreenAction,
} from '@/features/consulting/sequence/types';

export function createConsultingActions<
  Context extends object,
  Screen extends string,
  Operation extends string = never,
  Memory extends object = Record<string, never>,
>() {
  return {
    prompter(
      action: Omit<PrompterAction<Context, Memory>, 'type'>,
    ): PrompterAction<Context, Memory> {
      return { type: 'prompter', ...action };
    },
    screen(
      action: Omit<ScreenAction<Context, Memory, Screen>, 'type'>,
    ): ScreenAction<Context, Memory, Screen> {
      return { type: 'screen', ...action };
    },
    memory(
      action: Omit<MemoryAction<Context, Memory>, 'type'>,
    ): MemoryAction<Context, Memory> {
      return { type: 'memory', ...action };
    },
    external(
      action: Omit<ExternalAction<Operation>, 'type'>,
    ): ExternalAction<Operation> {
      return { type: 'external', ...action };
    },
  };
}

export function defineConsulting<
  Context extends object,
  Screen extends string,
  Operation extends string = never,
  Memory extends object = Record<string, never>,
>(
  definition: ConsultingDefinition<Context, Screen, Operation, Memory>,
): ConsultingDefinition<Context, Screen, Operation, Memory> {
  return definition;
}

import type {
  ConsultingDefinition,
  ExternalAction,
  PrompterAction,
  ScreenAction,
} from '@/features/consulting/sequence/types';

export function createConsultingActions<
  Context extends object,
  Screen extends string,
  Operation extends string = never,
>() {
  return {
    prompter(
      action: Omit<PrompterAction<Context>, 'type'>,
    ): PrompterAction<Context> {
      return { type: 'prompter', ...action };
    },
    screen(
      action: Omit<ScreenAction<Context, Screen>, 'type'>,
    ): ScreenAction<Context, Screen> {
      return { type: 'screen', ...action };
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
>(
  definition: ConsultingDefinition<Context, Screen, Operation>,
): ConsultingDefinition<Context, Screen, Operation> {
  return definition;
}

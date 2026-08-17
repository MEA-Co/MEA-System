import type {
  ConsultingPresentation,
  ConsultingRuntime,
  ConsultingSystemAction,
  ConsultingUpdate,
  ConsultingViewUpdateDefinition,
} from '@/features/consulting/runner/types';

export function createConsultingActions<
  Context extends object,
  Memory extends object,
  Screen extends string,
  Resources extends object,
>() {
  type Runtime = ConsultingRuntime<Context, Memory, Resources>;
  type Action = ConsultingSystemAction<Context, Memory, Screen, Resources>;

  return {
    present(
      view: ConsultingViewUpdateDefinition<Context, Memory, Screen, Resources>,
      waitFor: ConsultingPresentation = 'immediate',
    ): Action {
      return { type: 'present', view, waitFor };
    },

    run(
      run: (
        runtime: Runtime & { signal: AbortSignal },
      ) =>
        | ConsultingUpdate<Context, Memory>
        | void
        | Promise<ConsultingUpdate<Context, Memory> | void>,
    ): Action {
      return { type: 'run', run };
    },

    startResource<Key extends keyof Resources & string>(
      resource: Key,
      run: (
        runtime: Runtime & { signal: AbortSignal },
      ) => Resources[Key] | Promise<Resources[Key]>,
    ): Action {
      return { type: 'resource.start', resource, run } as Action;
    },

    awaitResource<Key extends keyof Resources & string>(
      resource: Key,
      apply?: (
        data: Resources[Key],
        runtime: Runtime,
      ) => ConsultingUpdate<Context, Memory> | void,
    ): Action {
      return { type: 'resource.await', resource, apply } as Action;
    },

    cancelResource(resource: keyof Resources & string): Action {
      return { type: 'resource.cancel', resource } as Action;
    },
  };
}

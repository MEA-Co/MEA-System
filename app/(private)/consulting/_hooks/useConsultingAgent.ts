'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { createConsultingAgent } from '@/features/consulting/core/agent';
import { createConsultingLogger } from '@/features/consulting/core/logger';
import type { ConsultingPlan } from '@/features/consulting/core/plan';
import type {
  ConsultingRendererError,
  ConsultingRenderTarget,
} from '@/features/consulting/core/renderer';
import {
  createConsultingRendererRejectedResponse,
  createConsultingRendererSuccessResponse,
  parseConsultingRendererRequest,
} from '@/features/consulting/core/renderer';
import type { ConsultingToolsRuntime } from '@/features/consulting/core/tools';
import { createConsultingToolRuntime } from '@/features/consulting/core/tools';

const pendingDisposals = new WeakMap<object, ReturnType<typeof setTimeout>>();

export function useConsultingAgent<
  Context extends object,
  Tools extends ConsultingToolsRuntime,
>(
  plan: ConsultingPlan<Context, Tools>,
  tools: Tools,
  renderer: {
    validate: (
      request: ConsultingRenderTarget,
    ) => ConsultingRendererError | null;
  },
) {
  const execution = useMemo(() => {
    const logger = createConsultingLogger();
    const toolRuntime = createConsultingToolRuntime(tools);
    const agent = createConsultingAgent(plan, toolRuntime, {
      onEvent: logger.record,
    });
    return { agent, logger, toolRuntime };
  }, [plan, tools]);
  const { agent, logger, toolRuntime } = execution;
  const runningCallsRef = useRef(new Map<string, AbortController | null>());

  useEffect(() => {
    const runningCalls = runningCallsRef.current;
    const pendingDisposal = pendingDisposals.get(agent);
    if (pendingDisposal) {
      clearTimeout(pendingDisposal);
      pendingDisposals.delete(agent);
    }

    return () => {
      for (const controller of runningCalls.values()) {
        controller?.abort();
      }
      runningCalls.clear();

      const disposal = setTimeout(() => {
        agent.dispose();
        pendingDisposals.delete(agent);
      }, 0);
      pendingDisposals.set(agent, disposal);
    };
  }, [agent]);

  const snapshot = useSyncExternalStore(
    agent.subscribe,
    agent.getSnapshot,
    agent.getSnapshot,
  );
  const toolRuntimeSnapshot = useSyncExternalStore(
    toolRuntime.subscribe,
    toolRuntime.getSnapshot,
    toolRuntime.getSnapshot,
  );

  useEffect(() => {
    const pendingCallIds = new Set(
      snapshot.pendingModuleCalls.map((call) => call.id),
    );

    for (const [callId, controller] of runningCallsRef.current) {
      if (!pendingCallIds.has(callId)) {
        controller?.abort();
        runningCallsRef.current.delete(callId);
      }
    }

    for (const call of snapshot.pendingModuleCalls) {
      if (runningCallsRef.current.has(call.id)) continue;

      const controller = call.kind === 'screen' ? new AbortController() : null;
      runningCallsRef.current.set(call.id, controller);

      const executeCall = () => {
        if (call.kind !== 'screen') {
          return agent.executeToolCall(call.id);
        }
        if (!controller) {
          throw new Error('Renderer 호출을 취소할 Controller가 없습니다.');
        }

        const input =
          typeof call.input === 'object' && call.input !== null
            ? (call.input as Record<string, unknown>)
            : null;
        const screenId =
          typeof input?.screenId === 'string' ? input.screenId : 'unknown';

        let request;
        try {
          request = parseConsultingRendererRequest(call.input);
        } catch (error) {
          return Promise.resolve(
            createConsultingRendererRejectedResponse(screenId, {
              code: 'INVALID_REQUEST',
              message:
                error instanceof Error
                  ? error.message
                  : '올바르지 않은 Renderer 요청입니다.',
            }),
          );
        }

        const rendererError = renderer.validate(request);
        if (rendererError) {
          return Promise.resolve(
            createConsultingRendererRejectedResponse(
              request.screenId,
              rendererError,
            ),
          );
        }

        return Promise.resolve(
          createConsultingRendererSuccessResponse(request),
        );
      };

      void Promise.resolve()
        .then(executeCall)
        .then((output) => {
          if (controller?.signal.aborted !== true) {
            agent.resolveModuleCall(call.id, output);
          }
        })
        .catch((error: unknown) => {
          if (controller?.signal.aborted !== true) {
            agent.rejectModuleCall(call.id, error);
          }
        })
        .finally(() => {
          runningCallsRef.current.delete(call.id);
        });
    }
  }, [agent, renderer, snapshot.pendingModuleCalls]);

  return {
    snapshot,
    toolRuntime,
    toolRuntimeSnapshot,
    memory: agent.getMemory(),
    logs: logger.getSnapshot(),
    send: agent.send,
  };
}

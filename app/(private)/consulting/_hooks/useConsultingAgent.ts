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
  const runtime = useMemo(() => {
    const logger = createConsultingLogger();
    const agent = createConsultingAgent(plan, tools, {
      onEvent: logger.record,
    });
    return { agent, logger };
  }, [plan, tools]);
  const { agent, logger } = runtime;
  const runningCallsRef = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const runningCalls = runningCallsRef.current;
    const pendingDisposal = pendingDisposals.get(agent);
    if (pendingDisposal) {
      clearTimeout(pendingDisposal);
      pendingDisposals.delete(agent);
    }

    return () => {
      for (const controller of runningCalls.values()) {
        controller.abort();
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

  useEffect(() => {
    const pendingCallIds = new Set(
      snapshot.pendingModuleCalls.map((call) => call.id),
    );

    for (const [callId, controller] of runningCallsRef.current) {
      if (!pendingCallIds.has(callId)) {
        controller.abort();
        runningCallsRef.current.delete(callId);
      }
    }

    for (const call of snapshot.pendingModuleCalls) {
      if (runningCallsRef.current.has(call.id)) continue;

      const controller = new AbortController();
      runningCallsRef.current.set(call.id, controller);

      const executeCall = () => {
        if (call.kind !== 'screen') {
          return agent.executeToolCall(call.id, controller.signal);
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
          if (!controller.signal.aborted) {
            agent.resolveModuleCall(call.id, output);
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
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
    memory: agent.getMemory(),
    logs: logger.getSnapshot(),
    send: agent.send,
  };
}

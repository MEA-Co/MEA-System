'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { createGuidedConsultingAgent } from '@/features/guided-consulting/core/agent';
import { createGuidedConsultingLogger } from '@/features/guided-consulting/core/logger';
import type {
  GuidedConsultingRendererError,
  GuidedConsultingRenderTarget,
} from '@/features/guided-consulting/core/renderer/protocol';
import {
  createGuidedConsultingRendererRejectedResponse,
  createGuidedConsultingRendererSuccessResponse,
  parseGuidedConsultingRendererRequest,
} from '@/features/guided-consulting/core/renderer/protocol';
import type { GuidedConsultingToolsRuntime } from '@/features/guided-consulting/core/tools';
import type { GuidedConsultingDefinition } from '@/features/guided-consulting/core/types';

const pendingDisposals = new WeakMap<object, ReturnType<typeof setTimeout>>();

export function useGuidedConsultingAgent<
  Context extends object,
  Tools extends GuidedConsultingToolsRuntime,
>(
  definition: GuidedConsultingDefinition<Context, Tools>,
  tools: Tools,
  renderer: {
    validate: (
      request: GuidedConsultingRenderTarget,
    ) => GuidedConsultingRendererError | null;
  },
) {
  const runtime = useMemo(() => {
    const logger = createGuidedConsultingLogger();
    const agent = createGuidedConsultingAgent(definition, tools, {
      onEvent: logger.record,
    });
    return { agent, logger };
  }, [definition, tools]);
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
          request = parseGuidedConsultingRendererRequest(call.input);
        } catch (error) {
          return Promise.resolve(
            createGuidedConsultingRendererRejectedResponse(screenId, {
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
            createGuidedConsultingRendererRejectedResponse(
              request.screenId,
              rendererError,
            ),
          );
        }

        return Promise.resolve(
          createGuidedConsultingRendererSuccessResponse(request),
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
    ...snapshot,
    logs: logger.getSnapshot(),
    send: agent.send,
  };
}

'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { createGuidedConsultingAgent } from '@/features/guided-consulting/core/agent';
import {
  createGuidedConsultingRendererRejectedResponse,
  createGuidedConsultingRendererSuccessResponse,
  parseGuidedConsultingRendererRequest,
} from '@/features/guided-consulting/core/renderer-protocol';
import type { GuidedConsultingDefinition } from '@/features/guided-consulting/core/types';

const pendingDisposals = new WeakMap<object, ReturnType<typeof setTimeout>>();

export function useGuidedConsultingAgent<
  Context extends object,
  Services extends object,
>(
  definition: GuidedConsultingDefinition<Context, Services>,
  services: Services,
  renderer: { has: (id: string) => boolean },
) {
  const agent = useMemo(
    () => createGuidedConsultingAgent(definition, services),
    [definition, services],
  );
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
      snapshot.pendingToolCalls.map((call) => call.id),
    );

    for (const [callId, controller] of runningCallsRef.current) {
      if (!pendingCallIds.has(callId)) {
        controller.abort();
        runningCallsRef.current.delete(callId);
      }
    }

    for (const call of snapshot.pendingToolCalls) {
      if (runningCallsRef.current.has(call.id)) continue;

      const controller = new AbortController();
      runningCallsRef.current.set(call.id, controller);

      const executeCall = () => {
        if (call.kind !== 'screen') {
          return agent.executeToolCall(call.id, controller.signal);
        }

        const request = parseGuidedConsultingRendererRequest<Context>(
          call.input,
        );
        if (!renderer.has(request.screen.main.id)) {
          return Promise.resolve(
            createGuidedConsultingRendererRejectedResponse(request, {
              code: 'RENDERER_NOT_FOUND',
              message: `Renderer ID를 찾을 수 없습니다: ${request.screen.main.id}`,
            }),
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
            agent.resolveToolCall(call.id, output);
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            agent.rejectToolCall(call.id, error);
          }
        })
        .finally(() => {
          runningCallsRef.current.delete(call.id);
        });
    }
  }, [agent, renderer, snapshot.pendingToolCalls]);

  return {
    ...snapshot,
    send: agent.send,
  };
}

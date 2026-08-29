'use client';

import { Eye } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { ConsultingDebugConsole } from '@/app/(private)/consulting/_components/ConsultingDebugConsole';
import { ConsultingFrame } from '@/app/(private)/consulting/_components/ConsultingFrame';
import { ConsultingToolRuntimeProvider } from '@/app/(private)/consulting/_components/ConsultingToolRuntimeProvider';
import { ConsultingToolStatus } from '@/app/(private)/consulting/_components/ConsultingToolStatus';
import { useConsultingAgent } from '@/app/(private)/consulting/_hooks/useConsultingAgent';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { Button } from '@/components/ui/button';
import type { ConsultingMemory } from '@/features/consulting/core/agent';
import type { ConsultingPlan } from '@/features/consulting/core/plan';
import type { ConsultingRenderer } from '@/features/consulting/core/renderer';
import type { ConsultingToolsRuntime } from '@/features/consulting/core/tools';
import type { MemberRole } from '@/lib/profile';

type ConsultingFlowProps<
  Context extends object,
  Tools extends ConsultingToolsRuntime,
> = {
  plan: ConsultingPlan<Context, Tools>;
  tools: Tools;
  renderer: ConsultingRenderer<ConsultingScreenRenderEnvironment, ReactNode>;
  viewerRole: MemberRole;
  onComplete?: (completion: {
    planId: string;
    title: string;
    memory: ConsultingMemory<Context>;
  }) => Promise<void>;
  debug?: boolean;
};

export function ConsultingFlow<
  Context extends object,
  Tools extends ConsultingToolsRuntime,
>({
  plan,
  tools,
  renderer,
  viewerRole,
  onComplete,
  debug = false,
}: ConsultingFlowProps<Context, Tools>) {
  const { snapshot, toolRuntime, toolRuntimeSnapshot, memory, logs, send } =
    useConsultingAgent(plan, tools, renderer);
  const [drafts, setDrafts] = useState<{
    sessionId: number;
    values: Record<string, string>;
  }>({ sessionId: snapshot.sessionId, values: {} });
  const [completionState, setCompletionState] = useState<{
    status: 'idle' | 'saving' | 'saved' | 'error';
    error: string | null;
  }>({ status: 'idle', error: null });
  const attemptedCompletionSessionRef = useRef<number | null>(null);
  const screen = snapshot.screen;
  const draftKey = screen?.draftKey ?? screen?.nodeId ?? '';
  const draftValue =
    drafts.sessionId === snapshot.sessionId
      ? (drafts.values[draftKey] ?? '')
      : '';

  const saveCompletion = useCallback(async () => {
    if (!snapshot.isComplete || !onComplete) return;

    setCompletionState({ status: 'saving', error: null });
    try {
      await onComplete({
        planId: snapshot.planId,
        title: snapshot.title,
        memory,
      });
      setCompletionState({ status: 'saved', error: null });
    } catch (error) {
      setCompletionState({
        status: 'error',
        error:
          error instanceof Error
            ? error.message
            : '완료 결과를 저장하지 못했습니다. 다시 시도해 주세요.',
      });
    }
  }, [
    memory,
    onComplete,
    snapshot.isComplete,
    snapshot.planId,
    snapshot.title,
  ]);

  useEffect(() => {
    if (!snapshot.isComplete || !onComplete) {
      attemptedCompletionSessionRef.current = null;
      return;
    }
    if (attemptedCompletionSessionRef.current === snapshot.sessionId) return;

    attemptedCompletionSessionRef.current = snapshot.sessionId;
    void saveCompletion();
  }, [onComplete, saveCompletion, snapshot.isComplete, snapshot.sessionId]);

  const debugConsole = debug ? (
    <ConsultingDebugConsole
      snapshot={snapshot}
      toolRuntimeSnapshot={toolRuntimeSnapshot}
      memory={memory}
      logs={logs}
    />
  ) : null;

  if (!screen) return debugConsole;

  const rendererError = renderer.validate(screen.renderTarget);
  const renderedScreen = !rendererError ? (
    renderer.render(screen.renderTarget, {
      draftValue,
      viewerRole,
      onDraftChange: (value) =>
        setDrafts((current) => ({
          sessionId: snapshot.sessionId,
          values: {
            ...(current.sessionId === snapshot.sessionId ? current.values : {}),
            [draftKey]: value,
          },
        })),
      send,
      completion:
        snapshot.isComplete && onComplete
          ? {
              ...completionState,
              retry: () => void saveCompletion(),
            }
          : null,
    })
  ) : (
    <section
      role="alert"
      className="mx-auto w-full max-w-2xl rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive"
    >
      {rendererError.message}
    </section>
  );

  const canGoBack = screen.availableActions.includes('user.back');
  const canReviewExplanation = screen.availableActions.includes(
    'user.review-explanation',
  );

  return (
    <ConsultingToolRuntimeProvider runtime={toolRuntime}>
      <div>
        <ConsultingFrame
          title={screen.title}
          currentStep={screen.progress?.current}
          stepCount={screen.progress?.total}
          headerStatus={<ConsultingToolStatus />}
          onBack={canGoBack ? () => send({ type: 'user.back' }) : undefined}
          topRightAction={
            canReviewExplanation ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => send({ type: 'user.review-explanation' })}
              >
                <Eye aria-hidden="true" />
                설명 다시 보기
              </Button>
            ) : undefined
          }
        >
          {renderedScreen}
        </ConsultingFrame>
        {debugConsole}
      </div>
    </ConsultingToolRuntimeProvider>
  );
}

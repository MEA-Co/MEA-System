import type { GuidedConsultingMemory } from '@/features/guided-consulting/core/agent/memory';
import type {
  GuidedConsultingPlanNode,
  GuidedConsultingScreenProgress,
} from '@/features/guided-consulting/core/plan/types';
import type { GuidedConsultingRenderTarget } from '@/features/guided-consulting/core/renderer/protocol';
import type { GuidedConsultingUserAction } from '@/features/guided-consulting/core/user/protocol';

export type GuidedConsultingPhase =
  'waiting-for-user' | 'running-tools' | 'complete' | 'error';

export type GuidedConsultingScreen = {
  id: string;
  nodeId: string;
  title: string;
  renderTarget: GuidedConsultingRenderTarget;
  availableActions: ReadonlyArray<GuidedConsultingUserAction['type']>;
  progress?: GuidedConsultingScreenProgress;
  draftKey?: string;
  terminal: boolean;
};

export type GuidedConsultingModuleCallKind = 'screen' | 'tool';

export type GuidedConsultingModuleCall = {
  id: string;
  kind: GuidedConsultingModuleCallKind;
  toolName: string;
  nodeId: string;
  input: unknown;
};

export type GuidedConsultingAgentSnapshot<
  Context extends object,
  Tools extends object,
> = {
  planId: string;
  sessionId: number;
  title: string;
  phase: GuidedConsultingPhase;
  currentNodeId: string;
  node: GuidedConsultingPlanNode<Context, Tools>;
  error: Error | null;
  isComplete: boolean;
  screen: GuidedConsultingScreen | null;
  pendingModuleCalls: ReadonlyArray<GuidedConsultingModuleCall>;
};

export type GuidedConsultingAgent<
  Context extends object,
  Tools extends object,
> = {
  getSnapshot: () => GuidedConsultingAgentSnapshot<Context, Tools>;
  getMemory: () => GuidedConsultingMemory<Context>;
  subscribe: (listener: () => void) => () => void;
  send: (input: GuidedConsultingUserAction) => void;
  executeToolCall: (callId: string, signal: AbortSignal) => Promise<unknown>;
  resolveModuleCall: (callId: string, output: unknown) => void;
  rejectModuleCall: (callId: string, error: unknown) => void;
  dispose: () => void;
};

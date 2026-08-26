import type { ConsultingMemory } from '@/features/consulting/core/agent/memory';
import type {
  ConsultingPlanNode,
  ConsultingScreenProgress,
} from '@/features/consulting/core/plan';
import type { ConsultingRenderTarget } from '@/features/consulting/core/renderer';
import type { ConsultingUserAction } from '@/features/consulting/core/user';

export type ConsultingPhase =
  'waiting-for-user' | 'running-tools' | 'complete' | 'error';

export type ConsultingScreen = {
  id: string;
  nodeId: string;
  title: string;
  renderTarget: ConsultingRenderTarget;
  availableActions: ReadonlyArray<ConsultingUserAction['type']>;
  progress?: ConsultingScreenProgress;
  draftKey?: string;
  terminal: boolean;
};

export type ConsultingModuleCallKind = 'screen' | 'tool';

export type ConsultingModuleCall = {
  id: string;
  kind: ConsultingModuleCallKind;
  toolName: string;
  nodeId: string;
  input: unknown;
};

export type ConsultingAgentSnapshot<
  Context extends object,
  Tools extends object,
> = {
  planId: string;
  sessionId: number;
  title: string;
  phase: ConsultingPhase;
  currentNodeId: string;
  node: ConsultingPlanNode<Context, Tools>;
  error: Error | null;
  isComplete: boolean;
  screen: ConsultingScreen | null;
  pendingModuleCalls: ReadonlyArray<ConsultingModuleCall>;
};

export type ConsultingAgent<Context extends object, Tools extends object> = {
  getSnapshot: () => ConsultingAgentSnapshot<Context, Tools>;
  getMemory: () => ConsultingMemory<Context>;
  subscribe: (listener: () => void) => () => void;
  send: (input: ConsultingUserAction) => void;
  executeToolCall: (callId: string, signal: AbortSignal) => Promise<unknown>;
  resolveModuleCall: (callId: string, output: unknown) => void;
  rejectModuleCall: (callId: string, error: unknown) => void;
  dispose: () => void;
};

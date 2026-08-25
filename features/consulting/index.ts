export type { ConsultingAgentOptions } from '@/features/consulting/core/agent';
export { createConsultingAgent } from '@/features/consulting/core/agent';
export type {
  ConsultingAgentEvent,
  ConsultingAgentEventListener,
} from '@/features/consulting/core/agent/events';
export type { ConsultingMemory } from '@/features/consulting/core/agent/memory';
export type {
  ConsultingAgent,
  ConsultingAgentSnapshot,
  ConsultingModuleCall,
  ConsultingModuleCallKind,
  ConsultingPhase,
  ConsultingScreen,
} from '@/features/consulting/core/agent/types';
export type {
  ConsultingLog,
  ConsultingLogger,
  ConsultingLoggerOptions,
  ConsultingLogKind,
} from '@/features/consulting/core/logger';
export { createConsultingLogger } from '@/features/consulting/core/logger';
export type {
  ConsultingPlan,
  ConsultingPlanNode,
  ConsultingPlanTransition,
  ConsultingScreenNode,
  ConsultingScreenProgress,
  ConsultingToolId,
  ConsultingToolNode,
  ConsultingToolResultParams,
  ConsultingValueResolver,
} from '@/features/consulting/core/plan';
export { defineConsultingPlan } from '@/features/consulting/core/plan';
export type {
  ConsultingRenderer,
  ConsultingRendererEntry,
  ConsultingRenderHandler,
} from '@/features/consulting/core/renderer';
export { createConsultingRenderer } from '@/features/consulting/core/renderer';
export type {
  ConsultingDynamicRenderTarget,
  ConsultingRendererDynamicRequest,
  ConsultingRendererError,
  ConsultingRendererRejectedResponse,
  ConsultingRendererRequest,
  ConsultingRendererResponse,
  ConsultingRendererStaticRequest,
  ConsultingRendererSuccessResponse,
  ConsultingRenderTarget,
  ConsultingStaticRenderTarget,
} from '@/features/consulting/core/renderer/protocol';
export {
  CONSULTING_RENDERER_PROTOCOL,
  createConsultingRendererRejectedResponse,
  createConsultingRendererRequest,
  createConsultingRendererSuccessResponse,
  parseConsultingRendererRequest,
  parseConsultingRendererResponse,
} from '@/features/consulting/core/renderer/protocol';
export type {
  ConsultingToolContract,
  ConsultingToolEntry,
  ConsultingTools,
  ConsultingToolSchema,
  ConsultingToolsRuntime,
} from '@/features/consulting/core/tools';
export { createConsultingTools } from '@/features/consulting/core/tools';
export type {
  ConsultingToolError,
  ConsultingToolRejectedResponse,
  ConsultingToolRequest,
  ConsultingToolResponse,
  ConsultingToolSuccessResponse,
} from '@/features/consulting/core/tools/protocol';
export {
  CONSULTING_TOOLS_PROTOCOL,
  createConsultingToolRejectedResponse,
  createConsultingToolRequest,
  createConsultingToolSuccessResponse,
  parseConsultingToolRequest,
  parseConsultingToolResponse,
} from '@/features/consulting/core/tools/protocol';
export type { ConsultingUserAction } from '@/features/consulting/core/user/protocol';

import type {
  ConsultingPlan,
  ConsultingPlanNode,
} from '@/features/consulting/core/plan/types';

function assertTargetExists<Context extends object, Tools extends object>(
  nodes: Readonly<Record<string, ConsultingPlanNode<Context, Tools>>>,
  sourceId: string,
  targetId: string,
) {
  if (!nodes[targetId]) {
    throw new Error(
      `${sourceId}가 참조하는 Node를 찾을 수 없습니다: ${targetId}`,
    );
  }
}

export function defineConsultingPlan<
  Context extends object,
  Tools extends object,
>(plan: ConsultingPlan<Context, Tools>): ConsultingPlan<Context, Tools> {
  const nodes = plan.nodes;
  if (!nodes[plan.entry]) {
    throw new Error(`Entry Node를 찾을 수 없습니다: ${plan.entry}`);
  }

  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.id !== nodeId) {
      throw new Error(`Node key와 id가 일치하지 않습니다: ${nodeId}`);
    }
    if (!node.label.trim()) {
      throw new Error(`Node에 label이 필요합니다: ${nodeId}`);
    }

    if (node.type === 'screen') {
      for (const transition of Object.values(node.on ?? {})) {
        if (typeof transition === 'string') {
          assertTargetExists(nodes, nodeId, transition);
        }
      }
      continue;
    }

    if (!node.toolId.trim()) {
      throw new Error(`Tool Node에 toolId가 필요합니다: ${nodeId}`);
    }
    if (typeof node.next === 'string') {
      assertTargetExists(nodes, nodeId, node.next);
    }
    assertTargetExists(nodes, nodeId, node.onRejected);
  }

  return plan;
}

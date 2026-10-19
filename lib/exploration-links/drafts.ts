import { z } from 'zod';

const id = z.string().uuid();
const skillSchema = z.object({
  id,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  updatedAt: z.string().datetime({ offset: true }).optional(),
});
export const linkContentSchema = z
  .object({
    name: z.string().max(200),
    description: z.string().max(5000),
    graph: z.object({
      nodes: z
        .array(z.object({ explorationId: id, title: z.string().max(50000) }))
        .max(300),
      edges: z
        .array(z.object({ from: id, to: id, skillId: id.optional() }))
        .max(1000),
      skills: z.array(skillSchema).max(500),
    }),
  })
  .superRefine(({ graph }, ctx) => {
    const ids = new Set(graph.nodes.map((node) => node.explorationId));
    const skills = new Set(graph.skills.map((skill) => skill.id));
    const edges = new Set<string>();
    let invalid =
      ids.size !== graph.nodes.length || skills.size !== graph.skills.length;
    for (const edge of graph.edges) {
      const key = `${edge.from}:${edge.to}`;
      if (
        !ids.has(edge.from) ||
        !ids.has(edge.to) ||
        edge.from === edge.to ||
        edges.has(key) ||
        (edge.skillId && !skills.has(edge.skillId))
      )
        invalid = true;
      edges.add(key);
    }
    if (invalid || !layoutLink(graph.nodes, graph.edges))
      ctx.addIssue({
        code: 'custom',
        message: '탐구줄기의 활동·연결 정보를 확인해 주세요.',
      });
  });
export type LinkContent = z.infer<typeof linkContentSchema>;
export const linkDraftSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  ownerId: id,
  localRevision: z.number().int().positive(),
  serverRevision: z.number().int().nonnegative().optional(),
  updatedAt: z.string().datetime(),
  content: linkContentSchema,
});
export type LinkDraft = z.infer<typeof linkDraftSchema>;

// Longest path layers preserve every prerequisite, including direct + indirect references.
export function layoutLink(
  nodes: readonly { explorationId: string }[],
  edges: readonly { from: string; to: string }[],
) {
  const indegree = new Map(nodes.map((node) => [node.explorationId, 0]));
  const levels = new Map(nodes.map((node) => [node.explorationId, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!indegree.has(edge.from) || !indegree.has(edge.to)) return null;
    indegree.set(edge.to, indegree.get(edge.to)! + 1);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  const queue = nodes
    .filter((node) => !indegree.get(node.explorationId))
    .map((node) => node.explorationId);
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i];
    for (const to of outgoing.get(from) ?? []) {
      levels.set(to, Math.max(levels.get(to)!, levels.get(from)! + 1));
      indegree.set(to, indegree.get(to)! - 1);
      if (!indegree.get(to)) queue.push(to);
    }
  }
  if (queue.length !== nodes.length) return null;
  const rows = new Map<number, number>();
  return nodes.map((node) => {
    const column = levels.get(node.explorationId)!;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return {
      id: node.explorationId,
      column,
      position: { x: column * 400, y: row * 160 },
    };
  });
}
export const LINK_DRAFT_EVENT = 'mea:exploration-link-drafts';
export function linkDraftPrefix(environment: string, userId: string) {
  return `mea:exploration-links:v1:${environment}:${userId}:`;
}
export function readLinkDrafts(
  storage: Storage,
  prefix: string,
  ownerId: string,
) {
  const drafts: LinkDraft[] = [];
  const errors: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const draft = linkDraftSchema.parse(JSON.parse(storage.getItem(key)!));
      if (draft.ownerId !== ownerId || key !== prefix + draft.id)
        throw new Error();
      drafts.push(draft);
    } catch {
      errors.push(
        '읽을 수 없는 탐구줄기 임시저장이 있습니다. 원본은 보존했습니다.',
      );
    }
  }
  return {
    drafts: drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    errors,
  };
}
export function writeLinkDraft(
  storage: Storage,
  prefix: string,
  ownerId: string,
  draftId: string,
  expectedRevision: number,
  content: LinkContent,
  serverRevision = 0,
) {
  const key = prefix + draftId;
  const raw = storage.getItem(key);
  const previous = raw !== null ? linkDraftSchema.parse(JSON.parse(raw)) : null;
  if (
    (previous?.localRevision ?? 0) !== expectedRevision ||
    (previous && (previous.ownerId !== ownerId || previous.id !== draftId))
  )
    throw new Error(
      '다른 탭에서 이 초안을 수정하거나 삭제했습니다. 현재 입력을 유지한 채 목록에서 최신 초안을 확인해 주세요.',
    );
  const draft = linkDraftSchema.parse({
    schemaVersion: 1,
    id: draftId,
    ownerId,
    localRevision: expectedRevision + 1,
    serverRevision,
    updatedAt: new Date().toISOString(),
    content,
  });
  const encoded = JSON.stringify(draft);
  if (new TextEncoder().encode(encoded).length > 2_000_000)
    throw new Error('초안이 너무 큽니다. 내용을 줄여 주세요.');
  storage.setItem(key, encoded);
  return draft;
}
export function deleteLinkDraft(
  storage: Storage,
  prefix: string,
  draft: LinkDraft,
) {
  const raw = storage.getItem(prefix + draft.id);
  if (!raw) throw new Error('이미 삭제된 초안입니다.');
  const current = linkDraftSchema.parse(JSON.parse(raw));
  if (
    current.id !== draft.id ||
    current.localRevision !== draft.localRevision ||
    current.ownerId !== draft.ownerId
  )
    throw new Error(
      '다른 탭에서 수정한 초안입니다. 목록을 확인한 뒤 다시 삭제해 주세요.',
    );
  storage.removeItem(prefix + draft.id);
}

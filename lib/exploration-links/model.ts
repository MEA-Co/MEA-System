import { z } from 'zod';

import { type LinkContent, linkContentSchema, type LinkDraft } from './drafts';

export { type LinkContent };
export function confirmedContent(value: LinkContent): LinkContent {
  const content = linkContentSchema.parse(value);
  const connected = new Set(content.graph.edges.flatMap((e) => [e.from, e.to]));
  const used = new Set(content.graph.edges.map((e) => e.skillId));
  if (!content.name.trim() || !connected.size)
    throw new Error('이름과 하나 이상의 탐구활동 연결이 필요합니다.');
  if (!content.description.trim())
    throw new Error('연계 포인트를 입력해 주세요.');
  if (content.graph.edges.some((edge) => !edge.skillId))
    throw new Error('모든 연결에 연계 스킬을 할당해 주세요.');
  return {
    ...content,
    name: content.name.trim(),
    description: content.description.trim(),
    graph: {
      ...content.graph,
      nodes: content.graph.nodes.filter((n) => connected.has(n.explorationId)),
      skills: content.graph.skills.filter((s) => used.has(s.id)),
    },
  };
}
export const confirmLinkSchema = z
  .object({
    content: linkContentSchema,
    expectedRevision: z.number().int().nonnegative(),
    saveId: z.uuid(),
  })
  .refine((v) => !!v.content.name.trim() && v.content.graph.edges.length > 0)
  .refine((v) => !!v.content.description.trim(), {
    message: '연계 포인트를 입력해 주세요.',
    path: ['content', 'description'],
  })
  .refine((v) => v.content.graph.edges.every((edge) => !!edge.skillId), {
    message: '모든 연결에 연계 스킬을 할당해 주세요.',
  });
export type LinkSummary = {
  id: string;
  owner_id: string;
  name: string;
  node_count: number;
  revision: number;
  updated_at: string;
  owner_name: string | null;
};
export type LinkRecord = LinkSummary & {
  description: string;
  graph: Omit<LinkContent['graph'], 'skills'>;
  skills: LinkContent['graph']['skills'];
};
export function recordDraft(record: LinkRecord): LinkDraft {
  return {
    schemaVersion: 1,
    id: record.id,
    ownerId: record.owner_id,
    localRevision: 0,
    serverRevision: record.revision,
    updatedAt: record.updated_at,
    content: {
      name: record.name,
      description: record.description,
      graph: { ...record.graph, skills: record.skills },
    },
  };
}

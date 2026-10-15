import type { QuestionnaireListItem } from './types';

export const questionnaireStages = [
  'draft',
  'published',
  'distributed',
] as const;
export type QuestionnaireListStatus =
  'all' | (typeof questionnaireStages)[number] | 'archived';
export const questionnaireOverviewLimits = {
  draft: 2,
  published: 2,
  distributed: 10,
} as const;
export const QUESTIONNAIRE_LIST_PAGE_SIZE = 10;

export function readQuestionnaireListOptions(
  params: Pick<URLSearchParams, 'get'>,
) {
  const raw = params.get('qStatus');
  const status: QuestionnaireListStatus =
    raw === 'draft' ||
    raw === 'published' ||
    raw === 'distributed' ||
    raw === 'archived'
      ? raw
      : 'all';
  const rawPage = Number(params.get('qPage'));
  return {
    status,
    query: params.get('qSearch') ?? '',
    owner:
      params.get('qOwner') === 'mine' ? ('mine' as const) : ('all' as const),
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function questionnaireListModel(
  source: {
    drafts: QuestionnaireListItem[];
    published: QuestionnaireListItem[];
    distributed: QuestionnaireListItem[];
    archived?: QuestionnaireListItem[];
  },
  options: ReturnType<typeof readQuestionnaireListOptions>,
) {
  // Shared published/distributed rows come from the existing authorized API.
  // Private drafts and archived rows retain the previous author-only list scope.
  const unique = new Map<string, QuestionnaireListItem>();
  for (const item of [
    ...source.drafts,
    ...source.published,
    ...source.distributed,
    ...(source.archived ?? []),
  ]) {
    if ((item.status === 'draft' || item.archivedAt) && !item.isOwner) continue;
    unique.set(item.id, item);
  }
  const query = options.query.trim().toLocaleLowerCase();
  const matches = [...unique.values()].filter(
    (item) =>
      (options.owner !== 'mine' || item.isOwner) &&
      (item.title || '제목 없는 질문지').toLocaleLowerCase().includes(query),
  );
  const forStatus = (status: Exclude<QuestionnaireListStatus, 'all'>) =>
    matches
      .filter((item) =>
        status === 'archived'
          ? !!item.archivedAt
          : !item.archivedAt && item.status === status,
      )
      .sort((a, b) => {
        const dateA =
          status === 'distributed'
            ? (a.distributedAt ?? a.updatedAt)
            : a.updatedAt;
        const dateB =
          status === 'distributed'
            ? (b.distributedAt ?? b.updatedAt)
            : b.updatedAt;
        return dateB.localeCompare(dateA) || a.id.localeCompare(b.id);
      });
  const groups = questionnaireStages.map((status) => {
    const items = forStatus(status);
    return {
      status,
      total: items.length,
      items: items.slice(0, questionnaireOverviewLimits[status]),
    };
  });
  const items = options.status === 'all' ? [] : forStatus(options.status);
  const pages = Math.max(
    1,
    Math.ceil(items.length / QUESTIONNAIRE_LIST_PAGE_SIZE),
  );
  const page = Math.min(options.page, pages);
  return {
    groups,
    total:
      options.status === 'all'
        ? groups.reduce((sum, group) => sum + group.total, 0)
        : items.length,
    page,
    pages,
    items: items.slice(
      (page - 1) * QUESTIONNAIRE_LIST_PAGE_SIZE,
      page * QUESTIONNAIRE_LIST_PAGE_SIZE,
    ),
  };
}

export function questionnaireDetailHref(
  params: { toString(): string },
  id: string,
  responses = false,
) {
  const next = new URLSearchParams(params.toString());
  next.set('view', 'questions');
  next.set('tab', 'questionnaires');
  next.set('draft', id);
  next.delete('questionnaireEditor');
  next.delete('return');
  next.delete('question');
  next.delete('response');
  if (responses) next.set('questionnairePanel', 'responses');
  else next.delete('questionnairePanel');
  return `/dashboard?${next}`;
}

export const questionnaireStages = ['draft', 'in_review', 'published'] as const;
export type QuestionnaireListStatus =
  'all' | (typeof questionnaireStages)[number] | 'archived';
export function readQuestionnaireListOptions(
  params: Pick<URLSearchParams, 'get'>,
) {
  // qStatus was used before published changed meaning. Preserve old bookmarks.
  const legacy = params.get('qStatus');
  const raw =
    params.get('qStage') ??
    (legacy === 'published'
      ? 'in_review'
      : legacy === 'distributed'
        ? 'published'
        : legacy);
  const status: QuestionnaireListStatus =
    raw === 'draft' ||
    raw === 'in_review' ||
    raw === 'published' ||
    raw === 'archived'
      ? raw
      : 'all';
  const rawPage = Number(params.get('qPage'));
  return {
    status,
    query: (params.get('qSearch') ?? '').slice(0, 200),
    response:
      params.get('qResponse') === 'complete'
        ? ('complete' as const)
        : ('pending' as const),
    owner:
      params.get('qOwner') === 'mine' ? ('mine' as const) : ('all' as const),
    page:
      Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000
        ? rawPage
        : 1,
  };
}

export function questionnaireListPath(
  params: Pick<URLSearchParams, 'get'>,
  staff = true,
) {
  const options = readQuestionnaireListOptions(params);
  const query = new URLSearchParams();
  if (staff) {
    if (options.status !== 'all') query.set('qStage', options.status);
    if (options.query.trim()) query.set('qSearch', options.query.trim());
    if (options.owner === 'mine') query.set('qOwner', 'mine');
  } else if (options.response === 'complete')
    query.set('qResponse', 'complete');
  if ((!staff || options.status !== 'all') && options.page > 1)
    query.set('qPage', String(options.page));
  return query.size ? `?${query}` : '';
}

export function emptyQuestionnaireList(): import('./types').QuestionnaireListPage {
  return {
    groups: questionnaireStages.map((status) => ({
      status,
      total: 0,
      items: [],
    })),
    total: 0,
    page: 1,
    pages: 1,
    items: [],
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

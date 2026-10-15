import type { createClient } from '@/lib/supabase/server';

import { QuestionnaireHttpError } from './http-error';
import { readQuestionnaireListOptions } from './list-model';
import type { QuestionnaireListItem, QuestionnaireListPage } from './types';

import 'server-only';

type Client = ReturnType<typeof createClient>;
export async function loadQuestionnaireList(
  client: Client,
  viewRole: string,
  params: URLSearchParams,
) {
  const options = readQuestionnaireListOptions(params);
  const { data, error } = await client.rpc('list_questionnaires', {
    p_status: options.status,
    p_search: options.query.trim(),
    p_owner: options.owner,
    p_page: options.page,
    p_view_role: viewRole,
    p_response: options.response,
  });
  if (error)
    throw new QuestionnaireHttpError(
      error.code === '42501' ? 403 : 503,
      '질문지 목록을 불러오지 못했어요.',
    );
  return data as QuestionnaireListPage;
}

/** A bounded ID lookup; never searches a (possibly filtered or capped) list. */
export async function loadQuestionnaireListItem(
  client: Client,
  viewRole: string,
  id: string,
) {
  const { data, error } = await client.rpc('questionnaire_list_items', {
    p_ids: [id],
    p_view_role: viewRole,
  });
  if (error)
    throw new QuestionnaireHttpError(
      error.code === '42501' ? 403 : 503,
      '질문지를 불러오지 못했어요.',
    );
  return (data as QuestionnaireListItem[] | null)?.[0] ?? null;
}

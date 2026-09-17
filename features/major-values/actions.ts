'use server';

import { cookies } from 'next/headers';

import { getUserAccess, hasRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

import { generateValuesTurn } from './coach';
import {
  validateStateReferences,
  valuesRequestSchema,
  type ValuesState,
} from './domain';
import { loadValuesMetadata } from './metadata-server';

export async function continueMajorValues(
  input: unknown,
): Promise<
  { data: ValuesState; error?: never } | { error: string; data?: never }
> {
  try {
    const access = await getUserAccess();
    if (
      !access.user ||
      !access.isOnboarded ||
      !hasRole(access, ['consultant', 'consultant_lead', 'admin'])
    )
      return { error: '컨설턴트 또는 관리자 로그인이 필요합니다.' };
    const parsed = valuesRequestSchema.safeParse(input);
    if (!parsed.success || !parsed.data.state.pendingTurnId)
      return {
        error: '대화 내용을 확인해주세요. 입력한 답변은 보존되어 있습니다.',
      };
    const state = parsed.data.state;
    validateStateReferences(state);
    const metadata = await loadValuesMetadata(
      createClient(await cookies()),
      state.context,
    );

    return {
      data: await generateValuesTurn(state, metadata),
    };
  } catch {
    return {
      error:
        '탐색 자료나 답변을 확인하지 못했어요. 보낸 답변과 수정 내용은 보존되어 있습니다. 다시 시도해주세요.',
    };
  }
}

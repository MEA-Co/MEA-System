import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  createMaterialBoxCompletionResult,
  parseMaterialBoxCompletionRequest,
} from '@/app/(private)/consulting/material-box/_lib/completion';
import {
  MATERIAL_BOX_CONSULTING_ID,
  MATERIAL_BOX_CONSULTING_TITLE,
  TEMP_STUDENT_CONSULTING_RESULTS_TABLE,
} from '@/features/consulting/completion';
import { getUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_REQUEST_LENGTH = 2_000_000;

export async function POST(request: Request) {
  const access = await getUserAccess();

  if (!access.isAuthenticated || !access.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (access.role !== 'student') {
    return NextResponse.json(
      { error: '학생 계정만 컨설팅 결과를 저장할 수 있습니다.' },
      { status: 403 },
    );
  }

  const rawBody = await request.text();
  if (!rawBody || rawBody.length > MAX_REQUEST_LENGTH) {
    return NextResponse.json(
      { error: '컨설팅 완료 요청 크기가 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: '요청 형식이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  let completionResult: ReturnType<typeof createMaterialBoxCompletionResult>;
  try {
    const completionRequest = parseMaterialBoxCompletionRequest(body);
    completionResult = createMaterialBoxCompletionResult(completionRequest);
  } catch {
    return NextResponse.json(
      { error: '완료된 컨설팅 메모리 형식이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  try {
    const completedAt = new Date().toISOString();
    const supabase = createClient(await cookies());
    const { data, error } = await supabase
      .from(TEMP_STUDENT_CONSULTING_RESULTS_TABLE)
      .upsert(
        {
          student_id: access.user.id,
          consulting_id: MATERIAL_BOX_CONSULTING_ID,
          consulting_title: MATERIAL_BOX_CONSULTING_TITLE,
          agent_memory: completionResult.agentMemory,
          result_data: completionResult.resultData,
          completed_at: completedAt,
          updated_at: completedAt,
        },
        { onConflict: 'student_id,consulting_id' },
      )
      .select('completed_at')
      .single<{ completed_at: string }>();

    if (error || !data) {
      throw new Error('TEMP_CONSULTING_RESULT_UPSERT_FAILED', { cause: error });
    }

    return NextResponse.json(
      { completedAt: data.completed_at },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: '컨설팅 완료 결과를 저장하지 못했습니다. 다시 시도해 주세요.' },
      { status: 500 },
    );
  }
}

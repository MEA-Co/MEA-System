import { NextResponse } from 'next/server';

import { ExplorationRequestSchema } from '@/features/exploration/schemas/exploration';
import {
  handleExplorationTurn,
  startExploration,
} from '@/features/exploration/services/handle-exploration-turn';
import { getUserAccess, hasRole } from '@/lib/auth';
import { MEMBER_ROLES } from '@/lib/profile';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_REQUEST_LENGTH = 120_000;

export async function POST(request: Request) {
  const access = await getUserAccess();

  if (!access.isAuthenticated) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (!hasRole(access, MEMBER_ROLES)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const rawBody = await request.text();
  if (!rawBody || rawBody.length > MAX_REQUEST_LENGTH) {
    return NextResponse.json(
      { error: '탐구 대화 요청 크기가 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: '요청 형식이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  const requestResult = ExplorationRequestSchema.safeParse(parsedBody);
  if (!requestResult.success) {
    return NextResponse.json(
      { error: '탐구 대화 요청값이 올바르지 않습니다.' },
      { status: 400 },
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: '탐구 코치 기능이 아직 설정되지 않았습니다.' },
      { status: 503 },
    );
  }

  try {
    const body = requestResult.data;
    const response =
      body.action === 'start'
        ? await startExploration(body.department)
        : await handleExplorationTurn({
            state: body.state,
            userMessage: body.message,
          });

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (cause) {
    const conversationLimit =
      cause instanceof Error &&
      cause.message === 'EXPLORATION_CONVERSATION_LIMIT';

    return NextResponse.json(
      {
        error: conversationLimit
          ? '대화가 길어졌습니다. 현재 내용을 정리한 뒤 다시 시작해주세요.'
          : '탐구 코치의 응답을 만들지 못했습니다. 잠시 후 다시 시도해주세요.',
      },
      { status: conversationLimit ? 400 : 502 },
    );
  }
}

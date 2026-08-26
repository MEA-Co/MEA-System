import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { isLlmRequest, isLlmResponse } from '@/features/llm';
import { getUserAccess, hasRole } from '@/lib/auth';
import { MEMBER_ROLES } from '@/lib/profile';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_REQUEST_LENGTH = 72_000;

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
      { error: '언어 모델 요청 크기가 올바르지 않습니다.' },
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

  if (!isLlmRequest(body)) {
    return NextResponse.json(
      { error: '언어 모델 요청값이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: '언어 모델 호출 기능이 아직 설정되지 않았습니다.' },
      { status: 503 },
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: body.model,
      instructions: body.instructions,
      input: body.input,
      reasoning: body.reasoningEffort
        ? { effort: body.reasoningEffort }
        : undefined,
      text: body.text,
      max_output_tokens: body.maxOutputTokens,
      store: false,
    });
    const result = { outputText: response.output_text };

    if (!isLlmResponse(result)) {
      throw new Error('OPENAI_INVALID_RESPONSE');
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json(
      {
        error: '언어 모델 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 502 },
    );
  }
}

import { NextResponse } from 'next/server';

import { comparisonRequestSchema } from '@/features/subject-selection/comparison';
import { explainComparison } from '@/features/subject-selection/explain-comparison';
import { getUserAccess, hasRole } from '@/lib/auth';
import { MEMBER_ROLES } from '@/lib/profile';

export const runtime = 'nodejs';
export const maxDuration = 60;
const active = new Set<string>();
const recent = new Map<string, number>();
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });

export async function POST(request: Request) {
  let userId: string | undefined;
  try {
    const access = await getUserAccess();
    if (!access.user) return reply({ error: '로그인이 필요합니다.' }, 401);
    if (!hasRole(access, MEMBER_ROLES))
      return reply({ error: '접근 권한이 없습니다.' }, 403);
    const now = Date.now();
    for (const [id, time] of recent) if (now - time > 60_000) recent.delete(id);
    if (
      active.has(access.user.id) ||
      now - (recent.get(access.user.id) ?? 0) < 5000
    )
      return reply(
        { error: '진행 중인 설명을 기다린 뒤 잠시 후 다시 시도해 주세요.' },
        429,
      );
    if (!process.env.OPENAI_API_KEY)
      return reply(
        {
          error:
            'AI 설명 연결이 설정되지 않았어요. 기본 비교는 계속 사용할 수 있어요.',
        },
        503,
      );
    // Bound chunked requests as well as requests with Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: '비교할 과목이 없습니다.' }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 64_000)
          return reply({ error: '비교 요청이 너무 큽니다.' }, 413);
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    let raw: unknown;
    try {
      raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return reply({ error: '요청 형식을 확인해 주세요.' }, 400);
    }
    const parsed = comparisonRequestSchema.safeParse(raw);
    if (!parsed.success)
      return reply(
        { error: '과목이나 고민 내용의 입력 길이를 확인해 주세요.' },
        400,
      );
    if (
      active.has(access.user.id) ||
      Date.now() - (recent.get(access.user.id) ?? 0) < 5000
    )
      return reply(
        { error: '진행 중인 설명을 기다린 뒤 다시 시도해 주세요.' },
        429,
      );
    userId = access.user.id;
    active.add(userId);
    recent.set(userId, now);
    return reply(await explainComparison(parsed.data, request.signal));
  } catch {
    return reply(
      {
        error:
          'AI 설명을 가져오지 못했어요. 기본 비교를 이용하거나 잠시 후 다시 시도해 주세요.',
      },
      502,
    );
  } finally {
    if (userId) active.delete(userId);
  }
}

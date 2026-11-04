import { recheckSupport } from '@/features/mentor-round/server/comment-support.mjs';
import { questionDraft } from '@/features/mentor-round/server/question-draft.mjs';
import { vote } from '@/features/mentor-round/server/vote.mjs';
import { getViewRole } from '@/lib/admin';
import { getUserAccess } from '@/lib/auth';

export const maxDuration = 90;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ operation: string }> },
) {
  const { operation } = await params;
  if (!['question-draft', 'vote', 'support'].includes(operation)) {
    return Response.json(
      { error: '지원하지 않는 요청입니다.' },
      { status: 404 },
    );
  }
  const access = await getUserAccess();
  if (!access.user) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (
    !access.isOnboarded ||
    !access.role ||
    !['student', 'consultant_lead'].includes(await getViewRole(access.role))
  ) {
    return Response.json(
      { error: '학생 홈 또는 리드의 학생 화면 체험에서 사용할 수 있습니다.' },
      { status: 403 },
    );
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json(
      { error: '멘토라운드의 서버 API 키 설정을 확인해 주세요.' },
      { status: 503 },
    );
  }
  const handler = {
    vote,
    'question-draft': questionDraft,
    support: recheckSupport,
  }[operation]!;
  return handler(request, { OPENAI_API_KEY: key });
}

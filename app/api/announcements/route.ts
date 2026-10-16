import { cookies } from 'next/headers';

import { announcementInput } from '@/lib/announcements/schema';
import { getUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const headers = { 'Cache-Control': 'private, no-store' };
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });

export async function GET() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply({ error: '로그인이 필요합니다.' }, 401);
  const { data, error } = await supabase
    .from('service_announcements')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) return reply({ error: '공지를 불러오지 못했습니다.' }, 503);
  return reply(data);
}

export async function PUT(request: Request) {
  const access = await getUserAccess();
  if (!access.user) return reply({ error: '로그인이 필요합니다.' }, 401);
  if (!access.isOnboarded || access.role !== 'admin')
    return reply({ error: '관리자만 공지를 변경할 수 있습니다.' }, 403);
  const parsed = announcementInput.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return reply(
      {
        error: parsed.error.issues[0]?.message ?? '입력 내용을 확인해 주세요.',
      },
      400,
    );
  const { revision, ...input } = parsed.data;
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('service_announcements')
    .update(input)
    .eq('id', 1)
    .eq('revision', revision)
    .select('*')
    .maybeSingle();
  if (error)
    return reply(
      { error: '공지를 저장하지 못했습니다. 입력은 유지됩니다.' },
      503,
    );
  if (!data)
    return reply(
      {
        error:
          '다른 관리자가 공지를 변경했습니다. 최신 공지를 불러온 뒤 다시 수정해 주세요.',
      },
      409,
    );
  return reply(data);
}

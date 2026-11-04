'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { safeReturnPath } from '@/lib/auth-redirect';
import { createClient } from '@/lib/supabase/server';

export async function localLogin(
  next: string,
  _previous: string,
  data: FormData,
) {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321'
  )
    return '로컬 개발 환경에서만 사용할 수 있습니다.';
  const { error } = await createClient(await cookies()).auth.signInWithPassword(
    {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    },
  );
  if (error) return '로컬 계정의 이메일과 비밀번호를 확인해 주세요.';
  redirect(safeReturnPath(next));
}

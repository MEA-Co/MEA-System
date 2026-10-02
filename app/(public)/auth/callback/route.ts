import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { safeReturnPath, withReturnPath } from '@/lib/auth-redirect';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const nextParam = request.nextUrl.searchParams.get('next');
  const redirectPath = safeReturnPath(nextParam);

  if (code) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
  }

  return NextResponse.redirect(
    new URL(
      `${withReturnPath('/auth/login', redirectPath)}&error=oauth`,
      request.url,
    ),
  );
}

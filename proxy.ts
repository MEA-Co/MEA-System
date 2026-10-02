import { type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  // Always overwrite client-supplied values before forwarding to server pages.
  request.headers.set(
    'x-mea-return-path',
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

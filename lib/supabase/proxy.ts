import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const questionnaireDetail =
  /^\/api\/questionnaires\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\/?$/;

export async function updateSession(request: NextRequest) {
  // These Route Handlers perform getUser + profile authorization themselves,
  // and can write refreshed cookies. Never trust forwarded identity headers.
  if (
    (request.method === 'GET' &&
      questionnaireDetail.test(request.nextUrl.pathname)) ||
    /^\/api\/questionnaires\/[^/]+\/(published-responses|review-responses)\/?$/.test(
      request.nextUrl.pathname,
    )
  ) {
    return NextResponse.next({ request });
  }
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}

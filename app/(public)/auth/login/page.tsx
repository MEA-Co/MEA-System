import { LogInIcon } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserAccess } from '@/lib/auth';
import { safeReturnPath, withReturnPath } from '@/lib/auth-redirect';

import { GoogleLoginButton } from './_components/GoogleLoginButton';
import { LocalLoginForm } from './_components/LocalLoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeReturnPath((await searchParams).next);
  const { user, isOnboarded } = await getUserAccess();

  if (user) {
    redirect(isOnboarded ? next : withReturnPath('/onboarding', next));
  }

  return (
    <main className="flex min-h-svh items-center bg-white px-5 py-10 md:px-8 lg:px-12">
      <section className="mx-auto w-full max-w-md">
        <div className="mb-10">
          <p className="text-2xl font-semibold tracking-wide text-black">
            MEA System
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            입시의 처음부터 끝까지
          </p>
        </div>

        <Card>
          <CardHeader className="gap-2 pb-8">
            <CardTitle className="text-xl font-semibold">
              <div className="flex w-full items-center justify-between">
                <p>로그인</p>
                <LogInIcon color="oklch(70.5% 0.015 286.067)" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GoogleLoginButton next={next} />
            {process.env.NODE_ENV === 'development' &&
              process.env.NEXT_PUBLIC_SUPABASE_URL ===
                'http://127.0.0.1:54321' && <LocalLoginForm next={next} />}
            <p className="mt-5 text-center text-xs text-neutral-500">
              로그인하면 서비스 이용약관에 동의하게 됩니다.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

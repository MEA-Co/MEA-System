import { LogInIcon } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserAccess } from '@/lib/auth';

import { GoogleLoginButton } from './_components/GoogleLoginButton';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const { user, isOnboarded } = await getUserAccess();

  if (user) {
    redirect(isOnboarded ? '/dashboard' : '/onboarding');
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
            <GoogleLoginButton />
            <p className="mt-5 text-center text-xs text-neutral-500">
              로그인하면 서비스 이용약관에 동의하게 됩니다.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

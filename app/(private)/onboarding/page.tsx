import { UserRoundCog } from 'lucide-react';
import { redirect } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getUserAccess } from '@/lib/auth';

import { OnboardingForm } from './_components/OnboardingForm';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const { user, isOnboarded } = await getUserAccess();

  if (!user) redirect('/auth/login');
  if (isOnboarded) redirect('/dashboard');

  const googleName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : '';

  return (
    <main className="flex min-h-svh items-center bg-white px-5 py-10 md:px-8 lg:px-12">
      <section className="mx-auto w-full max-w-2xl">
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
                <p>회원 정보 설정</p>
                <UserRoundCog className="text-muted-foreground" />
              </div>
            </CardTitle>
            <CardDescription>
              서비스 이용에 필요한 기본 정보를 입력해 주세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm defaultName={googleName} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

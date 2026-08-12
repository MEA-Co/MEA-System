import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isProfileComplete, type Profile } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

import { OnboardingForm } from './onboarding-form';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data } = await supabase
    .from('profiles')
    .select('id, role, name, student_period')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  if (isProfileComplete(data)) redirect('/');

  const googleName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : '';

  return (
    <main className="min-h-svh bg-white px-5 py-8 md:px-8 md:py-12 lg:px-12 lg:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 border-b border-neutral-200 pb-6">
          <p className="mb-6 text-sm font-semibold tracking-wide text-black">
            MEA
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-black md:text-4xl">
            회원 정보 설정
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-neutral-600">
            서비스 이용에 필요한 기본 정보를 입력해 주세요.
          </p>
        </div>

        <Card className="gap-0 rounded-lg border border-neutral-200 bg-white py-0 shadow-none ring-0">
          <CardHeader className="border-b border-neutral-200 px-5 py-5 md:px-8">
            <CardTitle className="text-lg font-semibold text-black">
              회원 정보
            </CardTitle>
            <CardDescription className="text-neutral-500">
              한 번만 설정하면 되고, 이름은 나중에도 바꿀 수 있어요.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 py-6 md:px-8 md:py-8">
            <OnboardingForm defaultName={googleName} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

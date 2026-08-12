import { LogOut } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isProfileComplete, type Profile } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function signOut() {
  'use server';

  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function Home() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, name, student_period')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  if (!isProfileComplete(profile)) redirect('/onboarding');

  const isStudent = profile.role === 'student';

  return (
    <main className="min-h-svh bg-white">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 md:px-8 lg:px-10">
          <div className="text-sm font-semibold tracking-wide text-black">
            MEA
          </div>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-black"
            >
              <LogOut className="size-4" />
              로그아웃
            </Button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14 lg:px-10 lg:py-16">
        <p className="text-sm font-medium text-neutral-500">
          {isStudent ? '학생' : '컨설턴트'}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-black md:text-4xl">
          {profile.name}님, 반가워요.
        </h1>
        <p className="mt-3 text-base text-neutral-600">
          {isStudent
            ? '지금의 목표와 할 일을 하나씩 정리해 볼까요?'
            : '학생들의 목표와 상담 일정을 확인해 보세요.'}
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:mt-12">
          <Card className="rounded-lg border border-neutral-200 bg-white shadow-none ring-0">
            <CardContent>
              <p className="text-xs font-medium text-neutral-500">회원 유형</p>
              <p className="mt-2 font-semibold text-black">
                {isStudent ? '학생' : '컨설턴트'}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border border-neutral-200 bg-white shadow-none ring-0">
            <CardContent>
              <p className="text-xs font-medium text-neutral-500">
                {isStudent ? '현재 시기' : '시스템 상태'}
              </p>
              <p className="mt-2 font-semibold text-black">
                {profile.student_period ?? '상담 준비 완료'}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

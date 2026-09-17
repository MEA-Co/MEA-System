import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { signOut } from '../../_actions/sign-out';

import { ConsultingManagement } from './ConsultingManagement';

export function ConsultantDashboard({
  consultantName,
  headerActions,
}: {
  consultantName: string;
  headerActions?: ReactNode;
}) {
  const roleLabel = '컨설턴트';

  return (
    <main className="min-h-svh bg-white">
      {headerActions}
      <header className="border-b border-neutral-200 bg-white">
        <div
          className={`mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8 lg:px-10 ${headerActions ? 'pt-24 sm:pt-3' : ''}`}
        >
          <div className="text-sm font-semibold tracking-wide text-black">
            MEA
          </div>
          <div
            className={`flex flex-wrap items-center gap-2 ${headerActions ? 'mr-auto' : 'ml-auto justify-end'}`}
          >
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
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14 lg:px-10 lg:py-16">
        <p className="text-sm font-medium text-neutral-500">{roleLabel}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-black md:text-4xl">
          {consultantName}님, 반가워요.
        </h1>
        <p className="mt-3 text-base text-neutral-600">
          학생들의 목표와 상담 일정을 확인해 보세요.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:mt-12">
          <Card className="rounded-lg border border-neutral-200 bg-white shadow-none ring-0">
            <CardContent>
              <p className="text-xs font-medium text-neutral-500">회원 유형</p>
              <p className="mt-2 font-semibold text-black">{roleLabel}</p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border border-neutral-200 bg-white shadow-none ring-0">
            <CardContent>
              <p className="text-xs font-medium text-neutral-500">
                시스템 상태
              </p>
              <p className="mt-2 font-semibold text-black">상담 준비 완료</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 border-t pt-10 lg:mt-14 lg:pt-12">
          <ConsultingManagement role="consultant" />
        </div>
      </section>
    </main>
  );
}

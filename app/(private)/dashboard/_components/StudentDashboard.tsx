import { LogOut } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { StudentPeriod } from '@/lib/profile';

import { signOut } from '../../_actions/sign-out';

import { ConsultingManagement } from './ConsultingManagement';

type StudentDashboardProps = {
  studentName: string;
  studentPeriod: StudentPeriod;
  completedConsultingIds: ReadonlyArray<string>;
};

export function StudentDashboard({
  studentName,
  studentPeriod,
  completedConsultingIds,
}: StudentDashboardProps) {
  return (
    <main className="min-h-svh bg-white">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 md:px-8 lg:px-10">
          <p className="text-sm font-semibold tracking-wide">MEA</p>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="size-4" />
              로그아웃
            </Button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14 lg:px-10 lg:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">학생</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
              {studentName}님, 반가워요.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              MEA와 함께 입시 여정을 준비해 보세요.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            {studentPeriod}
          </Badge>
        </div>

        <div className="mt-12 border-t pt-10 lg:mt-14 lg:pt-12">
          <ConsultingManagement
            completedConsultingIds={completedConsultingIds}
          />
        </div>
      </section>
    </main>
  );
}

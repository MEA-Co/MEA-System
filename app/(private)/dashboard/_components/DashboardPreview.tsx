'use client';

import { BriefcaseBusiness, GraduationCap } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';

export function DashboardPreview({
  student,
  consultant,
}: {
  student: ReactNode;
  consultant: ReactNode;
}) {
  const [role, setRole] = useState<'student' | 'consultant'>('student');

  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">운영 관리</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        회원 화면 미리보기
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        예시 회원 정보로 각 역할의 메인 화면을 확인해 보세요. 미리보기 안의
        버튼은 작동하지 않습니다.
      </p>

      <div
        className="mt-6 flex w-fit gap-1 rounded-xl border bg-muted/50 p-1"
        role="group"
        aria-label="미리보기 회원 유형"
      >
        <Button
          type="button"
          variant={role === 'student' ? 'default' : 'ghost'}
          aria-pressed={role === 'student'}
          aria-controls="dashboard-preview"
          onClick={() => setRole('student')}
        >
          <GraduationCap aria-hidden="true" />
          학생 화면
        </Button>
        <Button
          type="button"
          variant={role === 'consultant' ? 'default' : 'ghost'}
          aria-pressed={role === 'consultant'}
          aria-controls="dashboard-preview"
          onClick={() => setRole('consultant')}
        >
          <BriefcaseBusiness aria-hidden="true" />
          컨설턴트 화면
        </Button>
      </div>

      <section
        id="dashboard-preview"
        aria-label={`${role === 'student' ? '학생' : '컨설턴트'} 메인 화면 미리보기`}
        className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm"
      >
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <span className="font-medium text-foreground">
            {role === 'student' ? '학생' : '컨설턴트'} 메인 화면
          </span>
          <span>예시 계정 · 보기 전용</span>
        </div>
        <div inert className="[&_main]:min-h-0">
          {role === 'student' ? student : consultant}
        </div>
      </section>
    </>
  );
}

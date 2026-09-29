'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { MemberRole } from '@/lib/profile';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { QuestionsDashboard } from './components/dashboard/QuestionsDashboard';
import { QuestionLibraryView } from './components/question/QuestionLibraryView';
import { QuestionnaireView } from './components/questionnaire/QuestionnaireView';

export function QuestionsView({
  role,
  requestedId,
}: {
  role: MemberRole;
  requestedId?: string;
}) {
  const params = useSearchParams();
  const staff = role === 'admin' || role === 'consultant_lead';
  const questionnaire =
    !staff ||
    Boolean(params.get('draft')) ||
    params.get('tab') === 'questionnaires';

  const overview =
    staff &&
    !questionnaire &&
    !params.get('question') &&
    params.get('tab') !== 'questions';

  return (
    <div className="space-y-6">
      {overview && (
        <header>
          <DashboardPageCategory view="questions" />
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            질문 관리
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            질문과 질문지를 관리하고, 다른 사람이 공유한 질문지를 살펴보세요.
          </p>
        </header>
      )}
      {staff && !overview && !params.get('draft') && (
        <Link
          href="/dashboard?view=questions"
          prefetch={false}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          질문 관리 대시보드
        </Link>
      )}
      {overview ? (
        <QuestionsDashboard />
      ) : questionnaire ? (
        <QuestionnaireView requestedId={requestedId} />
      ) : (
        <QuestionLibraryView displayRole={role} />
      )}
    </div>
  );
}

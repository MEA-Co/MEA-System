'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { MemberRole } from '@/lib/profile';

import { QuestionLibraryView } from './components/question/QuestionLibraryView';
import { QuestionnaireView } from './components/questionnaire/QuestionnaireView';
import { QuestionResponseForm } from './components/questionnaire/QuestionResponseForm';

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
    (!params.get('question') && params.get('tab') !== 'questions');
  const responseId = staff ? params.get('response') : null;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      {responseId && (
        <Link
          href="/dashboard?view=questions&tab=questionnaires"
          prefetch={false}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          질문지 목록으로
        </Link>
      )}
      {responseId ? (
        <QuestionResponseForm key={responseId} questionnaireId={responseId} />
      ) : questionnaire ? (
        <QuestionnaireView requestedId={requestedId} staff={staff} />
      ) : (
        <QuestionLibraryView displayRole={role} />
      )}
    </div>
  );
}

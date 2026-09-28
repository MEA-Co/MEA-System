'use client';

import { Blocks, FilePenLine } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { MemberRole } from '@/lib/profile';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { QuestionLibraryView } from './components/question/QuestionLibraryView';
import {
  NewPublicationBadge,
  usePublicationNotifications,
} from './components/questionnaire/PublicationNotifications';
import { QuestionnaireView } from './components/questionnaire/QuestionnaireView';

export function QuestionsView({
  role,
  requestedId,
}: {
  role: MemberRole;
  requestedId?: string;
}) {
  const params = useSearchParams();
  const { unreadIds } = usePublicationNotifications();
  const staff = role === 'admin' || role === 'consultant_lead';
  const questionnaire =
    !staff ||
    Boolean(params.get('draft')) ||
    params.get('tab') === 'questionnaires' ||
    params.get('view') === 'questionnaire';
  const editing = Boolean(params.get('draft'));

  return (
    <div className="space-y-6">
      {!editing && (
        <header>
          <DashboardPageCategory view="questions" />
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            질문 관리
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {staff
              ? '질문을 만들고, 질문지를 구성하세요.'
              : '배포된 질문지를 확인하고 답변을 작성하세요.'}
          </p>
        </header>
      )}
      {staff && !editing && (
        <nav
          aria-label="질문 관리"
          className="flex w-fit gap-1 rounded-full bg-muted p-1"
        >
          {[
            {
              active: !questionnaire,
              href: '/dashboard?view=questions',
              label: '질문',
              icon: Blocks,
            },
            {
              active: questionnaire,
              href: '/dashboard?view=questions&tab=questionnaires',
              label: '질문지',
              icon: FilePenLine,
            },
          ].map(({ active, href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
              {label === '질문지' && unreadIds.length > 0 && (
                <NewPublicationBadge count={unreadIds.length} />
              )}
            </Link>
          ))}
        </nav>
      )}
      {questionnaire ? (
        <QuestionnaireView requestedId={requestedId} />
      ) : (
        <QuestionLibraryView />
      )}
    </div>
  );
}

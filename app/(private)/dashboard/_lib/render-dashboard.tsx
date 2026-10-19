import { cookies } from 'next/headers';
import { type ReactNode,Suspense } from 'react';

import {
  type DashboardView,
  resolveDashboardView,
} from '@/app/(private)/dashboard/_lib/dashboard-access';
import {
  TEMP_STUDENT_CONSULTING_RESULTS_TABLE,
  type TempStudentConsultingResultRow,
} from '@/features/consulting/completion';
import type { ManagedMember } from '@/lib/admin';
import { getViewRole } from '@/lib/admin';
import { requireUserAccess } from '@/lib/auth';
import { MEMBER_ROLES,type MemberRole } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

import { AdminRoleTabs } from '../_components/AdminRoleTabs';
import { Dashboard } from '../_components/Dashboard';
import { QuestionnaireNotifications } from '../_views/questions/components/questionnaire/QuestionnaireNotifications';

import 'server-only';

export type DashboardPageProps = {
  searchParams: Promise<{
    view?: string | string[];
    draft?: string | string[];
  }>;
};

export async function renderDashboard({ searchParams }: DashboardPageProps) {
  const access = await requireUserAccess();
  const { profile, role: actualRole, user } = access;
  const role = await getViewRole(actualRole);
  const roleTabs =
    actualRole === 'admin' ? <AdminRoleTabs role={role} /> : null;
  const { view: requestedView, draft } = await searchParams;

  const view = resolveDashboardView(role, requestedView);

  const content = (
    <DashboardData
      access={access}
      role={role}
      roleTabs={roleTabs}
      view={view}
      draft={draft}
    />
  );
  if (view !== 'students' && view !== 'consultants') return content;
  return (
    <Suspense
      key={`${role}:${view}`}
      fallback={
        <Dashboard
          userId={user.id}
          name={profile.name}
          role={role}
          studentPeriod={profile.student_period}
          members={[]}
          membersLoading
          view={view}
          headerActions={roleTabs}
        />
      }
    >
      {content}
    </Suspense>
  );
}

async function DashboardData({
  access,
  role,
  roleTabs,
  view,
  draft,
}: {
  access: Awaited<ReturnType<typeof requireUserAccess>>;
  role: MemberRole;
  roleTabs: ReactNode;
  view: DashboardView;
  draft?: string | string[];
}) {
  const { profile, user } = access;
  let members: ManagedMember[] = [];
  let completedConsultingIds: string[] = [];

  if (role === 'admin' || role === 'consultant_lead') {
    const supabase = createClient(await cookies());
    const memberResult = await supabase
      .from('profiles')
      .select('id, role, name, student_period, created_at')
      .in(
        'role',
        role === 'admin' ? MEMBER_ROLES : ['consultant', 'consultant_lead'],
      )
      .order('created_at', { ascending: false })
      .overrideTypes<ManagedMember[], { merge: false }>();

    if (memberResult.error) {
      throw new Error('Failed to load managed member profiles.', {
        cause: memberResult.error,
      });
    }

    members = memberResult.data ?? [];
  }

  if (role === 'student' && view === 'consulting') {
    const supabase = createClient(await cookies());
    const completionResult = await supabase
      .from(TEMP_STUDENT_CONSULTING_RESULTS_TABLE)
      .select('consulting_id')
      .eq('student_id', user.id)
      .overrideTypes<
        Pick<TempStudentConsultingResultRow, 'consulting_id'>[],
        { merge: false }
      >();

    if (completionResult.error) {
      throw new Error('Failed to load completed consulting results.', {
        cause: completionResult.error,
      });
    }

    completedConsultingIds = (completionResult.data ?? []).map(
      (completion) => completion.consulting_id,
    );
  }

  return (
    <QuestionnaireNotifications
      key={`questionnaire-workflow-2:${user.id}:${role}`}
      enabled={
        role === 'admin' || role === 'consultant_lead' || role === 'consultant'
      }
      userId={user.id}
      realtimeAudience={
        role === 'admin' || role === 'consultant_lead'
          ? 'staff'
          : role === 'consultant'
            ? 'published'
            : null
      }
    >
      <Dashboard
        userId={user.id}
        name={profile.name}
        role={role}
        studentPeriod={profile.student_period}
        members={members}
        completedConsultingIds={completedConsultingIds}
        view={view}
        headerActions={roleTabs}
        questionnaireId={typeof draft === 'string' ? draft : undefined}
      />
    </QuestionnaireNotifications>
  );
}

import { cookies } from 'next/headers';

import {
  TEMP_STUDENT_CONSULTING_RESULTS_TABLE,
  type TempStudentConsultingResultRow,
} from '@/features/consulting/completion';
import type { AdminView, ManagedMember } from '@/lib/admin';
import { getViewRole } from '@/lib/admin';
import { requireUserAccess } from '@/lib/auth';
import { MEMBER_ROLES } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

import { AdminDashboard } from './_components/AdminDashboard';
import { AdminRoleTabs } from './_components/AdminRoleTabs';
import { MemberDashboard } from './_components/MemberDashboard';

export const dynamic = 'force-dynamic';

type HomeProps = {
  searchParams: Promise<{
    view?: string | string[];
  }>;
};

export default async function DashboardPage({ searchParams }: HomeProps) {
  const { profile, role: actualRole, user } = await requireUserAccess();
  const role = await getViewRole(actualRole);
  const roleTabs =
    actualRole === 'admin' ? <AdminRoleTabs role={role} /> : null;
  const { view: requestedView } = await searchParams;

  if (role === 'admin' || role === 'consultant_lead') {
    const view: AdminView =
      requestedView === 'consultants' ||
      (requestedView === 'students' && role === 'admin')
        ? requestedView
        : 'consulting';
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

    return (
      <AdminDashboard
        adminName={profile.name}
        role={role}
        headerActions={roleTabs}
        members={memberResult.data ?? []}
        view={view}
      />
    );
  }

  if (requestedView === 'profile') {
    return (
      <MemberDashboard
        role={role}
        name={profile.name}
        studentPeriod={profile.student_period}
        view="profile"
        headerActions={roleTabs}
      />
    );
  }

  if (role === 'student') {
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

    return (
      <MemberDashboard
        role="student"
        completedConsultingIds={(completionResult.data ?? []).map(
          (completion) => completion.consulting_id,
        )}
        name={profile.name}
        studentPeriod={profile.student_period}
        headerActions={roleTabs}
      />
    );
  }

  return (
    <MemberDashboard
      role="consultant"
      name={profile.name}
      headerActions={roleTabs}
    />
  );
}

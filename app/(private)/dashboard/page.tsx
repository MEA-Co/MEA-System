import { cookies } from 'next/headers';

import {
  TEMP_STUDENT_CONSULTING_RESULTS_TABLE,
  type TempStudentConsultingResultRow,
} from '@/features/consulting/completion';
import { requireUserAccess } from '@/lib/auth';
import type { StudentPeriod } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

import { AdminDashboard } from './_components/AdminDashboard';
import { ConsultantDashboard } from './_components/ConsultantDashboard';
import { StudentDashboard } from './_components/StudentDashboard';
import type { AdminView, ManagedMember } from './_lib/admin';

export const dynamic = 'force-dynamic';

type HomeProps = {
  searchParams: Promise<{
    view?: string | string[];
  }>;
};

export default async function DashboardPage({ searchParams }: HomeProps) {
  const { profile, role, user } = await requireUserAccess();

  if (role === 'admin') {
    const { view: requestedView } = await searchParams;
    const view: AdminView =
      requestedView === 'consultants' ||
      requestedView === 'consulting' ||
      requestedView === 'preview'
        ? requestedView
        : 'students';
    const supabase = createClient(await cookies());
    const memberResult = await supabase
      .from('profiles')
      .select('id, role, name, student_period, created_at')
      .in('role', ['student', 'consultant', 'admin'])
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
        members={memberResult.data ?? []}
        view={view}
      />
    );
  }

  if (role === 'student') {
    const studentPeriod = profile.student_period as StudentPeriod;
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
      <StudentDashboard
        completedConsultingIds={(completionResult.data ?? []).map(
          (completion) => completion.consulting_id,
        )}
        studentName={profile.name}
        studentPeriod={studentPeriod}
      />
    );
  }

  return <ConsultantDashboard consultantName={profile.name} />;
}

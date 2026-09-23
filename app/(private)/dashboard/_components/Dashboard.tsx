import type { ReactNode } from 'react';

import {
  type DashboardView,
  resolveDashboardView,
} from '@/app/(private)/dashboard/_lib/dashboard-access';
import type { ManagedMember } from '@/lib/admin';
import type { MemberRole, StudentPeriod } from '@/lib/profile';

import { renderDashboardView } from '../_lib/dashboard-views';

import { DashboardNavigation } from './DashboardNavigation';
import { DashboardShell } from './DashboardShell';

type DashboardProps = {
  name: string;
  role: MemberRole;
  members: ManagedMember[];
  studentPeriod?: StudentPeriod | null;
  completedConsultingIds?: ReadonlyArray<string>;
  view: DashboardView;
  headerActions?: ReactNode;
  questionnaireId?: string;
};

export function Dashboard({
  name,
  role,
  members,
  view,
  headerActions,
  questionnaireId,
  studentPeriod,
  completedConsultingIds,
}: DashboardProps) {
  const activeView = resolveDashboardView(role, view);
  const students = members.filter((member) => member.role === 'student');
  const consultants = members.filter(
    (member) =>
      member.role === 'consultant' || member.role === 'consultant_lead',
  );

  return (
    <DashboardShell
      name={name}
      role={role}
      floatingControls={headerActions}
      documentBackground={
        activeView === 'questionnaire' && Boolean(questionnaireId)
      }
      navigation={
        <DashboardNavigation
          role={role}
          consultantCount={consultants.length}
          studentCount={students.length}
          view={activeView}
        />
      }
    >
      {renderDashboardView(role, activeView, {
        name,
        studentPeriod,
        students,
        consultants,
        completedConsultingIds,
        questionnaireId,
      })}
    </DashboardShell>
  );
}

import type { ReactNode } from 'react';

import type { AdminView, ManagedMember } from '@/lib/admin';

import { ConsultantManagement } from './ConsultantManagement';
import { ConsultingManagement } from './ConsultingManagement';
import { DashboardNavigation } from './DashboardNavigation';
import { DashboardShell } from './DashboardShell';
import { StudentManagement } from './StudentManagement';

type AdminDashboardProps = {
  adminName: string;
  role?: 'admin' | 'consultant_lead';
  members: ManagedMember[];
  view: AdminView;
  headerActions?: ReactNode;
};

export function AdminDashboard({
  adminName,
  role = 'admin',
  members,
  view,
  headerActions,
}: AdminDashboardProps) {
  const students = members.filter((member) => member.role === 'student');
  const consultants = members.filter(
    (member) =>
      member.role === 'consultant' || member.role === 'consultant_lead',
  );

  return (
    <DashboardShell
      name={adminName}
      role={role}
      floatingControls={headerActions}
      navigation={
        <DashboardNavigation
          role={role}
          consultantCount={consultants.length}
          studentCount={students.length}
          view={view}
        />
      }
    >
      {role === 'admin' && view === 'students' ? (
        <StudentManagement students={students} />
      ) : view === 'consultants' ? (
        <ConsultantManagement
          canManageRoles={role === 'admin'}
          consultants={consultants}
        />
      ) : (
        <ConsultingManagement role={role} />
      )}
    </DashboardShell>
  );
}

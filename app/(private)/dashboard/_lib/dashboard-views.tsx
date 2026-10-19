import type { ReactNode } from 'react';

import type { ManagedMember } from '@/lib/admin';
import type { MemberRole, StudentPeriod } from '@/lib/profile';

import { AnnouncementsView } from '../_views/announcements/AnnouncementsView';
import { ConsultantsView } from '../_views/consultants/ConsultantsView';
import { ConsultingView } from '../_views/consulting/ConsultingView';
import { ExplorationView } from '../_views/exploration/ExplorationView';
import { ProfileView } from '../_views/profile/ProfileView';
import { QuestionsView } from '../_views/questions/QuestionsView';
import { StudentsView } from '../_views/students/StudentsView';
import { StudyView } from '../_views/study/StudyView';

import { type DashboardView, resolveDashboardView } from './dashboard-access';

import 'server-only';

type ViewContext = {
  userId: string;
  name: string;
  role: MemberRole;
  studentPeriod?: StudentPeriod | null;
  students: ManagedMember[];
  membersLoading?: boolean;
  consultants: ManagedMember[];
  completedConsultingIds?: ReadonlyArray<string>;
  questionnaireId?: string;
};

// Keep server view imports out of the policy shared with client navigation.
const DASHBOARD_VIEWS = {
  announcements: () => <AnnouncementsView />,
  profile: ({ name, role, studentPeriod }) => (
    <ProfileView name={name} role={role} studentPeriod={studentPeriod} />
  ),
  students: ({ students, membersLoading }) => (
    <StudentsView students={students} loading={membersLoading} />
  ),
  consultants: ({ role, consultants, membersLoading }) => (
    <ConsultantsView
      canManageRoles={role === 'admin'}
      consultants={consultants}
      loading={membersLoading}
    />
  ),
  consulting: ({ role, completedConsultingIds }) => (
    <ConsultingView
      role={role}
      completedConsultingIds={completedConsultingIds}
    />
  ),
  questions: ({ role, questionnaireId }) => (
    <QuestionsView role={role} requestedId={questionnaireId} />
  ),
  exploration: ({ userId, role }) => (
    <ExplorationView
      key={`${userId}:${role}`}
      userId={userId}
      canViewOthers={role === 'admin' || role === 'consultant_lead'}
    />
  ),
  study: ({ userId, role }) => (
    <StudyView
      key={`${userId}:${role}`}
      userId={userId}
      canViewOthers={role === 'admin' || role === 'consultant_lead'}
    />
  ),
} satisfies Record<DashboardView, (context: ViewContext) => ReactNode>;

export function renderDashboardView(
  role: MemberRole,
  requested: DashboardView,
  context: Omit<ViewContext, 'role'>,
) {
  const view = resolveDashboardView(role, requested);
  return DASHBOARD_VIEWS[view]({ ...context, role });
}

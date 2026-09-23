import type { ReactNode } from 'react';

import type { ManagedMember } from '@/lib/admin';
import type { MemberRole, StudentPeriod } from '@/lib/profile';

import { ConsultantsView } from '../_views/consultants/ConsultantsView';
import { ConsultingView } from '../_views/consulting/ConsultingView';
import { ExplorationView } from '../_views/exploration/ExplorationView';
import { ProfileView } from '../_views/profile/ProfileView';
import { QuestionnaireView } from '../_views/questionnaire/QuestionnaireView';
import { QuestionsView } from '../_views/questions/QuestionsView';
import { StudentsView } from '../_views/students/StudentsView';

import { type DashboardView, resolveDashboardView } from './dashboard-access';

import 'server-only';

type ViewContext = {
  name: string;
  role: MemberRole;
  studentPeriod?: StudentPeriod | null;
  students: ManagedMember[];
  consultants: ManagedMember[];
  completedConsultingIds?: ReadonlyArray<string>;
  questionnaireId?: string;
};

// Keep server view imports out of the policy shared with client navigation.
const DASHBOARD_VIEWS = {
  profile: ({ name, role, studentPeriod }) => (
    <ProfileView name={name} role={role} studentPeriod={studentPeriod} />
  ),
  students: ({ students }) => <StudentsView students={students} />,
  consultants: ({ role, consultants }) => (
    <ConsultantsView
      canManageRoles={role === 'admin'}
      consultants={consultants}
    />
  ),
  consulting: ({ role, completedConsultingIds }) => (
    <ConsultingView
      role={role}
      completedConsultingIds={completedConsultingIds}
    />
  ),
  questions: () => <QuestionsView />,
  questionnaire: ({ questionnaireId }) => (
    <QuestionnaireView requestedId={questionnaireId} />
  ),
  exploration: () => <ExplorationView />,
} satisfies Record<DashboardView, (context: ViewContext) => ReactNode>;

export function renderDashboardView(
  role: MemberRole,
  requested: DashboardView,
  context: Omit<ViewContext, 'role'>,
) {
  const view = resolveDashboardView(role, requested);
  return DASHBOARD_VIEWS[view]({ ...context, role });
}

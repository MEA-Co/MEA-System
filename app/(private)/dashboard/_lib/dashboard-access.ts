import type { MemberRole } from '@/lib/profile';

export const DASHBOARD_PAGES = {
  profile: { label: '내 정보', group: 'personal' },
  students: { label: '학생 관리', group: 'members' },
  consultants: { label: '컨설턴트 관리', group: 'members' },
  questionnaire: { label: '질문지 관리', group: 'operations' },
  exploration: { label: '탐구활동 관리', group: 'operations' },
  consulting: { label: '컨설팅 관리', group: 'operations' },
} as const;

export type DashboardView = keyof typeof DASHBOARD_PAGES;

type RolePages = Partial<Record<DashboardView, { sidebar: boolean }>>;

// An entry grants page access. sidebar only controls menu visibility.
// This is display policy; server actions and RLS authorize the actual account.
export const DASHBOARD_ROLES = {
  student: {
    profile: { sidebar: true },
    consulting: { sidebar: false },
  },
  consultant: {
    profile: { sidebar: true },
    exploration: { sidebar: true },
    consulting: { sidebar: false },
  },
  consultant_lead: {
    consultants: { sidebar: true },
    questionnaire: { sidebar: true },
    exploration: { sidebar: true },
    consulting: { sidebar: true },
  },
  admin: {
    students: { sidebar: true },
    consultants: { sidebar: true },
    questionnaire: { sidebar: true },
    consulting: { sidebar: true },
  },
} as const satisfies Record<
  MemberRole,
  RolePages & { consulting: { sidebar: boolean } }
>;

export function canAccessDashboardView(role: MemberRole, view: DashboardView) {
  return Object.hasOwn(DASHBOARD_ROLES[role], view);
}

export function resolveDashboardView(
  role: MemberRole,
  requested: string | string[] | undefined,
): DashboardView {
  if (
    typeof requested !== 'string' ||
    !Object.hasOwn(DASHBOARD_PAGES, requested)
  )
    return 'consulting';
  const view = requested as DashboardView;
  return canAccessDashboardView(role, view) ? view : 'consulting';
}

export function getDashboardNavigation(role: MemberRole) {
  const pages: RolePages = DASHBOARD_ROLES[role];
  return (Object.keys(pages) as DashboardView[])
    .filter((view) => pages[view]?.sidebar)
    .map((view) => ({ view, ...DASHBOARD_PAGES[view] }));
}

import {
  DASHBOARD_GROUPS,
  DASHBOARD_PAGES,
  type DashboardView,
} from '../_lib/dashboard-access';

export function DashboardPageCategory({ view }: { view: DashboardView }) {
  const label = DASHBOARD_GROUPS.find(
    (group) => group.id === DASHBOARD_PAGES[view].group,
  )?.label;
  return label ? (
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
  ) : null;
}

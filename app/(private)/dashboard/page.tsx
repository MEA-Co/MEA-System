import {
  type DashboardPageProps,
  renderDashboard,
} from './_lib/render-dashboard';

export const dynamic = 'force-dynamic';

export default function DashboardPage(props: DashboardPageProps) {
  return renderDashboard(props);
}

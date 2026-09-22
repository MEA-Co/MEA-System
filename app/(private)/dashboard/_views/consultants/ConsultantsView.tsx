import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ManagedMember } from '@/lib/admin';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { ConsultantManagementTable } from './components/ConsultantManagementTable';

type ConsultantsViewProps = {
  canManageRoles?: boolean;
  consultants: ManagedMember[];
};

export function ConsultantsView({
  canManageRoles = false,
  consultants,
}: ConsultantsViewProps) {
  return (
    <>
      <div>
        <DashboardPageCategory view="consultants" />
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          컨설턴트 관리
        </h1>
      </div>

      <Card className="mt-6 gap-0 rounded-lg border shadow-none ring-0">
        <CardHeader className="pb-5">
          <CardTitle>컨설턴트 관리 목록</CardTitle>
          <CardDescription>
            총 {consultants.length}명의 회원이 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ConsultantManagementTable
            consultants={consultants}
            canManageRoles={canManageRoles}
          />
        </CardContent>
      </Card>
    </>
  );
}

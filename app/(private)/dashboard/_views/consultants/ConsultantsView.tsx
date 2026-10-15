import { CollectionHeader } from '@/components/patterns/collection';
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
    <section aria-labelledby="consultants-title" className="space-y-6">
      <CollectionHeader
        id="consultants-title"
        category={<DashboardPageCategory view="consultants" />}
        title="컨설턴트 관리"
        description="등록된 컨설턴트의 정보와 직책을 확인하세요."
      />
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          등록된 컨설턴트 {consultants.length}명
        </p>
        <ConsultantManagementTable
          consultants={consultants}
          canManageRoles={canManageRoles}
        />
      </div>
    </section>
  );
}

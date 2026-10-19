import { CollectionHeader } from '@/components/patterns/collection';
import { Skeleton } from '@/components/ui/skeleton';
import type { ManagedMember } from '@/lib/admin';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { ConsultantManagementTable } from './components/ConsultantManagementTable';

type ConsultantsViewProps = {
  canManageRoles?: boolean;
  consultants: ManagedMember[];
  loading?: boolean;
};

export function ConsultantsView({
  loading = false,
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
        <div className="text-sm text-muted-foreground">
          {loading ? (
            <Skeleton className="h-5 w-32" />
          ) : (
            <>등록된 컨설턴트 {consultants.length}명</>
          )}
        </div>
        <ConsultantManagementTable
          consultants={consultants}
          loading={loading}
          canManageRoles={canManageRoles}
        />
      </div>
    </section>
  );
}

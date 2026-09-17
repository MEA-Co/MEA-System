import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MEMBER_ROLE_LABELS } from '@/lib/profile';

import type { ManagedMember } from '../_lib/admin';

import { ConsultantRoleSelect } from './ConsultantRoleSelect';
import { MemberManagementTable } from './MemberManagementTable';

type ConsultantManagementProps = {
  canManageRoles?: boolean;
  consultants: ManagedMember[];
};

export function ConsultantManagement({
  canManageRoles = false,
  consultants,
}: ConsultantManagementProps) {
  return (
    <>
      <div>
        <p className="text-sm font-medium text-muted-foreground">회원 관리</p>
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
          <MemberManagementTable
            emptyMemberLabel="컨설턴트"
            members={consultants}
            secondaryColumnLabel="직책"
            secondaryValue={(consultant) => MEMBER_ROLE_LABELS[consultant.role]}
            secondaryContent={
              canManageRoles
                ? (consultant) =>
                    consultant.role === 'consultant' ||
                    consultant.role === 'consultant_lead' ? (
                      <ConsultantRoleSelect
                        memberId={consultant.id}
                        memberName={consultant.name}
                        role={consultant.role}
                      />
                    ) : null
                : undefined
            }
          />
        </CardContent>
      </Card>
    </>
  );
}

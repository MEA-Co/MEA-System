import { MemberManagementTable } from '@/app/_components/MemberManagementTable';
import type { ManagedMember } from '@/app/_lib/admin';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type ConsultantManagementProps = {
  consultants: ManagedMember[];
};

export function ConsultantManagement({
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
            secondaryColumnLabel="회원 유형"
            secondaryValue={(consultant) =>
              consultant.role === 'admin' ? '관리자' : '컨설턴트'
            }
          />
        </CardContent>
      </Card>
    </>
  );
}

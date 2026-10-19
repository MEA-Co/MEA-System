import { CollectionTable } from '@/components/patterns/collection-table';
import { CollectionTableState } from '@/components/patterns/collection-table-state';
import { Badge } from '@/components/ui/badge';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ManagedMember } from '@/lib/admin';
import { MEMBER_ROLE_LABELS } from '@/lib/profile';

import { ConsultantRoleSelect } from './ConsultantRoleSelect';

const joinedDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
});

export function ConsultantManagementTable({
  consultants,
  loading = false,
  canManageRoles = false,
}: {
  consultants: ManagedMember[];
  loading?: boolean;
  canManageRoles?: boolean;
}) {
  return (
    <CollectionTable
      aria-label="컨설턴트 목록"
      aria-busy={loading}
      className="block sm:table"
    >
      <TableHeader className="hidden sm:table-header-group">
        <TableRow className="hover:bg-transparent">
          <TableHead>이름</TableHead>
          <TableHead className="w-44 sm:w-64">직책</TableHead>
          <TableHead className="hidden w-36 text-right md:table-cell">
            가입일
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="block sm:table-row-group max-sm:[&>tr]:block max-sm:[&>tr>td:not(.hidden)]:block">
        {(loading || consultants.length === 0) && (
          <CollectionTableState
            colSpan={3}
            loading={loading}
            title={
              loading
                ? '컨설턴트 목록을 불러오는 중입니다'
                : '등록된 컨설턴트가 없습니다'
            }
            description="회원가입을 완료한 회원이 여기에 표시됩니다."
          />
        )}
        {!loading &&
          consultants.map((consultant) => (
            <TableRow key={consultant.id}>
              <TableCell>
                <div className="min-w-0 space-y-1.5">
                  <p className="wrap-anywhere font-semibold text-foreground">
                    {consultant.name || '이름 미입력'}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground md:hidden">
                    가입{' '}
                    {joinedDateFormatter.format(
                      new Date(consultant.created_at),
                    )}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <span className="mb-2 block text-xs text-muted-foreground sm:hidden">
                  직책
                </span>
                {canManageRoles &&
                (consultant.role === 'consultant' ||
                  consultant.role === 'consultant_lead') ? (
                  <ConsultantRoleSelect
                    memberId={consultant.id}
                    memberName={consultant.name}
                    role={consultant.role}
                  />
                ) : (
                  <Badge variant="secondary">
                    {MEMBER_ROLE_LABELS[consultant.role]}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                {joinedDateFormatter.format(new Date(consultant.created_at))}
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </CollectionTable>
  );
}

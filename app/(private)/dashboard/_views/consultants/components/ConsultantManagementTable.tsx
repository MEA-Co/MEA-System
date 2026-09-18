import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Table,
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
  canManageRoles = false,
}: {
  consultants: ManagedMember[];
  canManageRoles?: boolean;
}) {
  if (consultants.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center border-t text-center">
        <div>
          <p className="text-sm font-medium text-foreground">
            등록된 컨설턴트이 없습니다.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            회원가입을 완료한 회원이 여기에 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>이름</TableHead>
          <TableHead>직책</TableHead>
          <TableHead className="hidden text-right md:table-cell">
            가입일
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {consultants.map((consultant) => (
          <TableRow key={consultant.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarFallback>
                    {consultant.name.trim().charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">
                  {consultant.name}
                </span>
              </div>
            </TableCell>
            <TableCell>
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
    </Table>
  );
}

import type { ManagedMember } from '@/app/_lib/admin';
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

type MemberManagementTableProps = {
  emptyMemberLabel: string;
  members: ManagedMember[];
  secondaryColumnLabel: string;
  secondaryValue: (member: ManagedMember) => string;
};

const joinedDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
});

export function MemberManagementTable({
  emptyMemberLabel,
  members,
  secondaryColumnLabel,
  secondaryValue,
}: MemberManagementTableProps) {
  if (members.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center border-t text-center">
        <div>
          <p className="text-sm font-medium text-foreground">
            등록된 {emptyMemberLabel}이 없습니다.
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
          <TableHead>{secondaryColumnLabel}</TableHead>
          <TableHead className="hidden text-right md:table-cell">
            가입일
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarFallback>
                    {member.name.trim().charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">
                  {member.name}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{secondaryValue(member)}</Badge>
            </TableCell>
            <TableCell className="hidden text-right text-muted-foreground md:table-cell">
              {joinedDateFormatter.format(new Date(member.created_at))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

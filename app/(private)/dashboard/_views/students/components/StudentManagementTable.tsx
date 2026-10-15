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

const joinedDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
});

export function StudentManagementTable({
  students,
}: {
  students: ManagedMember[];
}) {
  return (
    <CollectionTable aria-label="학생 목록">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>이름</TableHead>
          <TableHead className="w-28 sm:w-40">학년·학기</TableHead>
          <TableHead className="hidden w-36 text-right md:table-cell">
            가입일
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.length === 0 && (
          <CollectionTableState
            colSpan={3}
            title="등록된 학생가 없습니다"
            description="회원가입을 완료한 회원이 여기에 표시됩니다."
          />
        )}
        {students.map((student) => (
          <TableRow key={student.id}>
            <TableCell>
              <div className="min-w-0 space-y-1.5">
                <p className="wrap-anywhere font-semibold text-foreground">
                  {student.name || '이름 미입력'}
                </p>
                <p className="text-xs leading-5 text-muted-foreground md:hidden">
                  가입{' '}
                  {joinedDateFormatter.format(new Date(student.created_at))}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {student.student_period ?? '미입력'}
              </Badge>
            </TableCell>
            <TableCell className="hidden text-right text-muted-foreground md:table-cell">
              {joinedDateFormatter.format(new Date(student.created_at))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </CollectionTable>
  );
}

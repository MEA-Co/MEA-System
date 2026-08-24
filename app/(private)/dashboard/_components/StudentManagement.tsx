import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import type { ManagedMember } from '../_lib/admin';

import { MemberManagementTable } from './MemberManagementTable';

type StudentManagementProps = {
  students: ManagedMember[];
};

export function StudentManagement({ students }: StudentManagementProps) {
  return (
    <>
      <div>
        <p className="text-sm font-medium text-muted-foreground">회원 관리</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          학생 관리
        </h1>
      </div>

      <Card className="mt-6 gap-0 rounded-lg border shadow-none ring-0">
        <CardHeader className="pb-5">
          <CardTitle>학생 관리 목록</CardTitle>
          <CardDescription>
            총 {students.length}명의 회원이 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <MemberManagementTable
            emptyMemberLabel="학생"
            members={students}
            secondaryColumnLabel="현재 시기"
            secondaryValue={(student) => student.student_period ?? '미입력'}
          />
        </CardContent>
      </Card>
    </>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ManagedMember } from '@/lib/admin';

import { StudentManagementTable } from './components/StudentManagementTable';

type StudentsViewProps = {
  students: ManagedMember[];
};

export function StudentsView({ students }: StudentsViewProps) {
  return (
    <>
      <div>
        <p className="text-sm font-medium text-muted-foreground">구성원 관리</p>
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
          <StudentManagementTable students={students} />
        </CardContent>
      </Card>
    </>
  );
}

import { CollectionHeader } from '@/components/patterns/collection';
import type { ManagedMember } from '@/lib/admin';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { StudentManagementTable } from './components/StudentManagementTable';

type StudentsViewProps = {
  students: ManagedMember[];
};

export function StudentsView({ students }: StudentsViewProps) {
  return (
    <section aria-labelledby="students-title" className="space-y-6">
      <CollectionHeader
        id="students-title"
        category={<DashboardPageCategory view="students" />}
        title="학생 관리"
        description="등록된 학생의 정보와 학년·학기를 확인하세요."
      />
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          등록된 학생 {students.length}명
        </p>
        <StudentManagementTable students={students} />
      </div>
    </section>
  );
}

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { MEMBER_ROLE_LABELS, type StudentPeriod } from '@/lib/profile';

import { ExplorationWorkspace } from './exploration/ExplorationWorkspace';
import { ConsultingManagement } from './ConsultingManagement';
import { DashboardNavigation } from './DashboardNavigation';
import { DashboardShell } from './DashboardShell';

type MemberDashboardProps = {
  name: string;
  role: 'student' | 'consultant';
  studentPeriod?: StudentPeriod | null;
  completedConsultingIds?: ReadonlyArray<string>;
  headerActions?: ReactNode;
  view?: 'profile' | 'exploration';
};

export function MemberDashboard({
  name,
  role,
  studentPeriod,
  completedConsultingIds,
  headerActions,
  view,
}: MemberDashboardProps) {
  return (
    <DashboardShell
      name={name}
      role={role}
      navigation={<DashboardNavigation role={role} view={view} />}
      floatingControls={headerActions}
    >
      {view === 'profile' ? (
        <section aria-labelledby="my-profile-title">
          <Button
            render={<Link href="/dashboard" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="mb-4"
          >
            <ArrowLeft aria-hidden="true" />
            이전으로
          </Button>
          <h1
            id="my-profile-title"
            className="text-2xl font-semibold tracking-tight"
          >
            내 정보
          </h1>
          <dl className="mt-6 max-w-xl divide-y rounded-xl border px-5">
            <div className="grid grid-cols-[6rem_1fr] gap-4 py-4">
              <dt className="text-sm text-muted-foreground">이름</dt>
              <dd className="break-words text-sm font-medium">{name}</dd>
            </div>
            <div className="grid grid-cols-[6rem_1fr] gap-4 py-4">
              <dt className="text-sm text-muted-foreground">회원 유형</dt>
              <dd className="text-sm font-medium">
                {MEMBER_ROLE_LABELS[role]}
              </dd>
            </div>
            {role === 'student' && studentPeriod ? (
              <div className="grid grid-cols-[6rem_1fr] gap-4 py-4">
                <dt className="text-sm text-muted-foreground">학년·학기</dt>
                <dd className="text-sm font-medium">{studentPeriod}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : role === 'consultant' && view === 'exploration' ? (
        <ExplorationWorkspace />
      ) : (
        <ConsultingManagement
          role={role}
          completedConsultingIds={completedConsultingIds}
        />
      )}
    </DashboardShell>
  );
}

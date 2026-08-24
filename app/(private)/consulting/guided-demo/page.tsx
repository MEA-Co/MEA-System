import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { StudyRoutineDemo } from '@/features/guided-consulting/examples/study-routine/StudyRoutineDemo';
import { requireUserAccess } from '@/lib/auth';
import { MEMBER_ROLES } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export default async function GuidedConsultingDemoPage() {
  await requireUserAccess({ allowedRoles: MEMBER_ROLES });

  return (
    <main className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
          <Button
            render={<Link href="/dashboard?view=consulting" />}
            nativeButton={false}
            variant="ghost"
            size="icon-sm"
            aria-label="컨설팅 목록으로 돌아가기"
          >
            <ArrowLeft />
          </Button>
          <div>
            <p className="text-sm font-semibold">단순 Step 컨설팅 데모</p>
            <p className="text-xs text-muted-foreground">
              가이드 → 입력 → 처리 구조 체험
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <StudyRoutineDemo />
      </div>
    </main>
  );
}

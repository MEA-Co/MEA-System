import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { SUBJECT_SELECTION_CONSULTING_TITLE } from '@/features/consulting/completion';
import { requireUserAccess } from '@/lib/auth';
import { MEMBER_ROLES } from '@/lib/profile';

import { SubjectSelectionWorkspace } from './_components/SubjectSelectionWorkspace';

export const dynamic = 'force-dynamic';

export default async function SubjectSelectionConsultingPage() {
  await requireUserAccess({ allowedRoles: MEMBER_ROLES });

  return (
    <main className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              render={<Link href="/dashboard?view=consulting" />}
              nativeButton={false}
              variant="ghost"
              size="icon-sm"
              aria-label="컨설팅 목록으로 돌아가기"
            >
              <ArrowLeft />
            </Button>
            <p className="truncate text-sm font-semibold">
              {SUBJECT_SELECTION_CONSULTING_TITLE}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 md:px-6 md:py-7 lg:px-8">
        <section className="bg-background">
          <div className="border-b px-5 py-5 md:px-7">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <BookOpenCheck className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {SUBJECT_SELECTION_CONSULTING_TITLE}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  학교 편제 기반 과목 선택
                </p>
              </div>
            </div>
          </div>
          <div className="p-5 md:p-7">
            <SubjectSelectionWorkspace />
          </div>
        </section>
      </div>
    </main>
  );
}

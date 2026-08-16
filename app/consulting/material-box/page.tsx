import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { MaterialBoxFlow } from '@/app/consulting/material-box/_components/MaterialBoxFlow';
import { Button } from '@/components/ui/button';
import { ConsultingAdvice } from '@/features/consulting/components/ConsultingAdvice';
import { requireUserAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MaterialBoxConsultingPage() {
  await requireUserAccess({ allowedRoles: ['admin'] });

  return (
    <main className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              render={<Link href="/?view=consulting" />}
              nativeButton={false}
              variant="ghost"
              size="icon-sm"
              aria-label="컨설팅 목록으로 돌아가기"
            >
              <ArrowLeft />
            </Button>
            <p className="truncate text-sm font-semibold">
              생활기록부 브랜딩 컨설팅 [재료함 설계]
            </p>
          </div>
          <ConsultingAdvice />
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7 lg:px-8">
        <MaterialBoxFlow />
      </div>
    </main>
  );
}

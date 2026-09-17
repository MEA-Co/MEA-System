import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { BrandingConsulting } from '@/app/(private)/consulting/branding/_components/BrandingConsulting';
import { Button } from '@/components/ui/button';
import { requireUserAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function BrandingPage() {
  const { role, user } = await requireUserAccess({
    allowedRoles: ['consultant', 'consultant_lead', 'admin'],
    unauthorizedRedirectTo: '/dashboard?view=consulting',
  });
  return (
    <main className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 md:px-6 lg:px-8">
          <Button
            render={<Link href="/dashboard?view=consulting" />}
            nativeButton={false}
            variant="ghost"
            size="icon-sm"
            aria-label="컨설팅 목록으로 돌아가기"
          >
            <ArrowLeft />
          </Button>
          <p className="text-sm font-semibold">생활기록부 브랜딩 컨설팅</p>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7 lg:px-8">
        <BrandingConsulting role={role} userId={user.id} />
      </div>
    </main>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/lib/profile';

import { setAdminView } from '../_actions/set-admin-view';

const roles = ['student', 'consultant', 'consultant_lead', 'admin'] as const;

export function AdminRoleTabs({ role }: { role: MemberRole }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label="역할 화면 전환"
      aria-busy={pending}
      className="fixed top-3 right-3 z-40 flex max-w-[calc(100vw-5rem)] flex-wrap items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-lg backdrop-blur-sm sm:top-4 sm:right-4"
    >
      {roles.map((candidate) => (
        <Button
          key={candidate}
          type="button"
          size="sm"
          variant={candidate === role ? 'default' : 'ghost'}
          className="rounded-lg"
          aria-pressed={candidate === role}
          disabled={pending}
          onClick={() => {
            if (candidate === role) return;
            startTransition(async () => {
              try {
                const result = await setAdminView(candidate);
                if (result.error) {
                  toast.add({ type: 'error', title: result.error });
                  return;
                }
                router.replace('/dashboard');
              } catch {
                toast.add({
                  type: 'error',
                  title: '화면을 전환하지 못했어요. 다시 시도해 주세요.',
                });
              }
            });
          }}
        >
          {MEMBER_ROLE_LABELS[candidate]}
        </Button>
      ))}
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/lib/profile';

import { setAdminView } from '../_actions/set-admin-view';

const roles = ['student', 'consultant', 'consultant_lead', 'admin'] as const;

export function AdminRoleTabs({ role }: { role: MemberRole }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchRole(candidate: MemberRole) {
    if (candidate === role || pending) return;
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
  }

  return (
    <div
      aria-busy={pending}
      className="fixed top-[calc(var(--service-announcement-height,0px)+0.5rem)] right-4 z-40 max-w-[calc(100vw-5rem)] md:top-[calc(var(--service-announcement-height,0px)+1rem)]"
    >
      <div className="md:hidden">
        <Select
          value={role}
          disabled={pending}
          onValueChange={(value) => {
            if (roles.some((candidate) => candidate === value)) {
              switchRole(value as MemberRole);
            }
          }}
        >
          <SelectTrigger aria-label="역할 화면 전환" className="max-w-full">
            <SelectValue>{MEMBER_ROLE_LABELS[role]}</SelectValue>
          </SelectTrigger>
          <SelectContent
            align="end"
            alignItemWithTrigger={false}
            className="md:hidden"
          >
            {roles.map((candidate) => (
              <SelectItem key={candidate} value={candidate}>
                {MEMBER_ROLE_LABELS[candidate]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div
        role="group"
        aria-label="역할 화면 전환"
        className="hidden flex-wrap items-center gap-1 rounded-lg border bg-control-track p-1 md:flex"
      >
        {roles.map((candidate) => (
          <Button
            key={candidate}
            type="button"
            size="sm"
            variant="filter"
            aria-pressed={candidate === role}
            disabled={pending}
            onClick={() => switchRole(candidate)}
          >
            {MEMBER_ROLE_LABELS[candidate]}
          </Button>
        ))}
      </div>
    </div>
  );
}

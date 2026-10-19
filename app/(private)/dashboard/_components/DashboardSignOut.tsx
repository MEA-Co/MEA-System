'use client';

import { LogOut } from 'lucide-react';
import { unstable_rethrow } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { navigationExitFailed } from '@/lib/navigation/exit-request';

import { signOut } from '../../_actions/sign-out';

export function DashboardSignOut() {
  return (
    <form
      data-navigation-exit
      action={async () => {
        try {
          await signOut();
        } catch (error) {
          unstable_rethrow(error);
          navigationExitFailed();
          toast.add({
            type: 'error',
            title: '로그아웃하지 못했어요. 다시 시도해 주세요.',
          });
        }
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        className="rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        aria-label="로그아웃"
      >
        <LogOut />
      </Button>
    </form>
  );
}

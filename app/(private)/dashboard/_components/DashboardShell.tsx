import { LayoutDashboard, LogOut } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/lib/profile';

import { signOut } from '../../_actions/sign-out';

type DashboardShellProps = {
  name: string;
  role: MemberRole;
  navigation: ReactNode;
  floatingControls?: ReactNode;
  documentBackground?: boolean;
  children: ReactNode;
};

export function DashboardShell({
  name,
  role,
  navigation,
  floatingControls,
  documentBackground = false,
  children,
}: DashboardShellProps) {
  return (
    <SidebarProvider>
      {floatingControls}
      <Sidebar>
        <SidebarHeader className="border-b p-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="MEA 컨설팅 홈"
          >
            <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
              <LayoutDashboard className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">MEA</p>
              <p className="truncate text-xs text-muted-foreground">
                {MEMBER_ROLE_LABELS[role]} 페이지
              </p>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent>{navigation}</SidebarContent>

        <SidebarFooter className="border-t p-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <Avatar size="sm">
              <AvatarFallback>{name.trim().charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">
                {MEMBER_ROLE_LABELS[role]}
              </p>
            </div>
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                aria-label="로그아웃"
              >
                <LogOut />
              </Button>
            </form>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center px-4 md:px-6 md:hidden">
          <SidebarTrigger className="-ml-1 md:hidden" aria-label="메뉴 열기" />
        </header>

        <div
          className={`flex-1 p-4 md:p-6 lg:p-8 ${documentBackground ? 'bg-neutral-100 dark:bg-neutral-950' : ''} ${floatingControls ? 'pt-20 md:pt-20 lg:pt-20' : ''}`}
        >
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

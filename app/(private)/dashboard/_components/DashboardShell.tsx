import Link from 'next/link';
import type { ReactNode } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

import { DashboardSignOut } from './DashboardSignOut';

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
        <SidebarHeader>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-sidebar-ring"
            aria-label="MEA 홈"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-3xl font-black tracking-tighter">
                MEA
                <span
                  aria-hidden="true"
                  className="size-2 bg-sidebar-primary"
                />
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {MEMBER_ROLE_LABELS[role]} 페이지
              </p>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent>{navigation}</SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-3 px-2 py-1">
            <Avatar size="sm">
              <AvatarFallback className="rounded-md bg-sidebar-accent text-sidebar-foreground">
                {name.trim().charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="text-xs text-sidebar-foreground/60">
                {MEMBER_ROLE_LABELS[role]}
              </p>
            </div>
            <DashboardSignOut />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 has-data-question-editor:bg-neutral-100 dark:has-data-question-editor:bg-neutral-950">
        <header className="flex h-14 shrink-0 items-center px-4 md:px-6 md:hidden">
          <SidebarTrigger className="-ml-1 md:hidden" aria-label="메뉴 열기" />
        </header>

        <div
          className={`min-w-0 flex-1 p-4 md:p-6 lg:p-8 ${documentBackground ? 'bg-neutral-100 dark:bg-neutral-950' : ''} ${floatingControls ? 'md:pt-20 lg:pt-20' : ''}`}
        >
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

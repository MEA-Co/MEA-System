'use client';

import {
  BriefcaseBusiness,
  FilePenLine,
  GraduationCap,
  MessagesSquare,
  NotebookPen,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';

import {
  type DashboardView,
  getDashboardNavigation,
} from '@/app/(private)/dashboard/_lib/dashboard-access';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import type { MemberRole } from '@/lib/profile';

const icons = {
  profile: UserRound,
  students: GraduationCap,
  consultants: BriefcaseBusiness,
  questionnaire: FilePenLine,
  exploration: NotebookPen,
  consulting: MessagesSquare,
};
const groups = [
  { id: 'personal', label: null },
  { id: 'members', label: '구성원 관리' },
  { id: 'operations', label: '운영 관리' },
] as const;

type DashboardNavigationProps = {
  role: MemberRole;
  consultantCount?: number;
  studentCount?: number;
  view?: DashboardView;
};

export function DashboardNavigation({
  role,
  consultantCount,
  studentCount,
  view,
}: DashboardNavigationProps) {
  const { setOpenMobile } = useSidebar();
  const pages = getDashboardNavigation(role);
  return (
    <>
      {groups.map((group) => {
        const items = pages.filter((page) => page.group === group.id);
        if (!items.length) return null;
        return (
          <SidebarGroup key={group.id}>
            {group.label ? (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((page) => {
                  const Icon = icons[page.view];
                  const count =
                    page.view === 'students'
                      ? studentCount
                      : page.view === 'consultants'
                        ? consultantCount
                        : undefined;
                  return (
                    <SidebarMenuItem key={page.view}>
                      <SidebarMenuButton
                        render={
                          <Link
                            href={`/dashboard?view=${page.view}`}
                            onClick={() => setOpenMobile(false)}
                          />
                        }
                        isActive={view === page.view}
                      >
                        <Icon />
                        <span>{page.label}</span>
                      </SidebarMenuButton>
                      {count !== undefined ? (
                        <SidebarMenuBadge>{count}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );
}

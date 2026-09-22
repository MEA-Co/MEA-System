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
  DASHBOARD_GROUPS,
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

import {
  NewPublicationBadge,
  usePublicationNotifications,
} from '../_views/questionnaire/components/PublicationNotifications';

const icons = {
  profile: UserRound,
  students: GraduationCap,
  consultants: BriefcaseBusiness,
  questionnaire: FilePenLine,
  exploration: NotebookPen,
  consulting: MessagesSquare,
};

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
  const { unreadIds } = usePublicationNotifications();
  return (
    <>
      {DASHBOARD_GROUPS.map((group) => {
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
                        {page.view === 'questionnaire' &&
                          unreadIds.length > 0 && (
                            <NewPublicationBadge count={unreadIds.length} />
                          )}
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

'use client';

import {
  Blocks,
  BriefcaseBusiness,
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
} from '../_views/questions/components/questionnaire/PublicationNotifications';

const icons = {
  profile: UserRound,
  students: GraduationCap,
  consultants: BriefcaseBusiness,
  questions: Blocks,
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
  const { unreadIds, hasUnreadReviews } = usePublicationNotifications();
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
                        {page.view === 'questions' && hasUnreadReviews && (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-300"
                            aria-label="새 검토 요청"
                          >
                            검토 요청
                          </span>
                        )}
                        {page.view === 'questions' && unreadIds.length > 0 && (
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

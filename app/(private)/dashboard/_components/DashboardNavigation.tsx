'use client';

import {
  BriefcaseBusiness,
  GraduationCap,
  MessagesSquare,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';

import {
  DASHBOARD_GROUPS,
  type DashboardView,
  getDashboardNavigation,
} from '@/app/(private)/dashboard/_lib/dashboard-access';
import {
  ExplorationIcon,
  QuestionsIcon,
  StudyIcon,
} from '@/components/feature-icons';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLabel,
  useSidebar,
} from '@/components/ui/sidebar';
import type { MemberRole } from '@/lib/profile';

import { useQuestionnaireNotifications } from '../_views/questions/components/questionnaire/QuestionnaireNotifications';

const icons = {
  profile: UserRound,
  students: GraduationCap,
  consultants: BriefcaseBusiness,
  questions: QuestionsIcon,
  exploration: ExplorationIcon,
  study: StudyIcon,
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
  const { unreadIds, hasUnreadReviews } = useQuestionnaireNotifications();
  return (
    <nav aria-label="주 메뉴">
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
                            aria-current={
                              view === page.view ? 'page' : undefined
                            }
                            onClick={() => setOpenMobile(false)}
                          />
                        }
                        isActive={view === page.view}
                      >
                        <Icon />
                        <SidebarMenuLabel>{page.label}</SidebarMenuLabel>
                        {page.view === 'questions' && hasUnreadReviews && (
                          <SidebarMenuBadge
                            tone="notification"
                            aria-label="새 검토 요청"
                          >
                            검토 요청
                          </SidebarMenuBadge>
                        )}
                        {page.view === 'questions' && unreadIds.length > 0 && (
                          <SidebarMenuBadge
                            tone="notification"
                            aria-label={`새 질문지 ${unreadIds.length}개`}
                          >
                            NEW {unreadIds.length}
                          </SidebarMenuBadge>
                        )}
                        {count !== undefined ? (
                          <SidebarMenuBadge>{count}</SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </nav>
  );
}

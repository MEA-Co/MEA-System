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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import type { AdminView } from '@/lib/admin';
import type { MemberRole } from '@/lib/profile';

type DashboardNavigationProps = {
  role: MemberRole;
  consultantCount?: number;
  studentCount?: number;
  view?: AdminView | 'profile';
};

export function DashboardNavigation({
  role = 'admin',
  consultantCount,
  studentCount,
  view,
}: DashboardNavigationProps) {
  const { setOpenMobile } = useSidebar();

  if (role === 'student' || role === 'consultant') {
    return (
      <>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      href="/dashboard?view=profile"
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                  isActive={view === 'profile'}
                >
                  <UserRound />
                  <span>내 정보</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {role === 'consultant' && (
          <SidebarGroup>
            <SidebarGroupLabel>운영 관리</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <Link
                        href="/dashboard?view=exploration"
                        onClick={() => setOpenMobile(false)}
                      />
                    }
                    isActive={view === 'exploration'}
                  >
                    <NotebookPen />
                    <span>탐구활동 관리</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </>
    );
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>구성원 관리</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {role === 'admin' && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      href="/dashboard?view=students"
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                  isActive={view === 'students'}
                >
                  <GraduationCap />
                  <span>학생 관리</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{studentCount}</SidebarMenuBadge>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    href="/dashboard?view=consultants"
                    onClick={() => setOpenMobile(false)}
                  />
                }
                isActive={view === 'consultants'}
              >
                <BriefcaseBusiness />
                <span>컨설턴트 관리</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{consultantCount}</SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>운영 관리</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {role === 'consultant_lead' && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      href="/dashboard?view=questionnaire"
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                  isActive={view === 'questionnaire'}
                >
                  <FilePenLine />
                  <span>질문지 관리</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {role === 'consultant_lead' && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      href="/dashboard?view=exploration"
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                  isActive={view === 'exploration'}
                >
                  <NotebookPen />
                  <span>탐구활동 관리</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    href="/dashboard?view=consulting"
                    onClick={() => setOpenMobile(false)}
                  />
                }
                isActive={view === 'consulting'}
              >
                <MessagesSquare />
                <span>컨설팅 관리</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

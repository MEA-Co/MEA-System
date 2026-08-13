'use client';

import { BriefcaseBusiness, GraduationCap, Target } from 'lucide-react';
import Link from 'next/link';

import type { AdminView } from '@/app/_lib/admin';
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

type AdminNavigationProps = {
  consultantCount: number;
  questCount: number;
  studentCount: number;
  view: AdminView;
};

export function AdminNavigation({
  consultantCount,
  questCount,
  studentCount,
  view,
}: AdminNavigationProps) {
  const { setOpenMobile } = useSidebar();

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>회원 관리</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    href="/?view=students"
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
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    href="/?view=consultants"
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
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    href="/?view=quests"
                    onClick={() => setOpenMobile(false)}
                  />
                }
                isActive={view === 'quests'}
              >
                <Target />
                <span>목표 관리</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{questCount}</SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

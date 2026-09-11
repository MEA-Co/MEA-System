'use client';

import {
  BriefcaseBusiness,
  GraduationCap,
  MessagesSquare,
  PanelsTopLeft,
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

import type { AdminView } from '../_lib/admin';

type AdminNavigationProps = {
  consultantCount: number;
  studentCount: number;
  view: AdminView;
};

export function AdminNavigation({
  consultantCount,
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
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    href="/dashboard?view=preview"
                    onClick={() => setOpenMobile(false)}
                  />
                }
                isActive={view === 'preview'}
              >
                <PanelsTopLeft />
                <span>회원 화면 미리보기</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

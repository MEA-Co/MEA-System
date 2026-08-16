'use client';

import { BriefcaseBusiness, GraduationCap, MessagesSquare } from 'lucide-react';
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
                    href="/?view=consulting"
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

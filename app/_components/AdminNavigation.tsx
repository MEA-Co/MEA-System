'use client';

import { BriefcaseBusiness, GraduationCap } from 'lucide-react';
import Link from 'next/link';

import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

type AdminNavigationProps = {
  consultantCount: number;
  studentCount: number;
  view: 'students' | 'consultants';
};

export function AdminNavigation({
  consultantCount,
  studentCount,
  view,
}: AdminNavigationProps) {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={
            <Link href="/?view=students" onClick={() => setOpenMobile(false)} />
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
  );
}

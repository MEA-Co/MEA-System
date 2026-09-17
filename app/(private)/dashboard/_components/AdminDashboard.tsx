import { LayoutDashboard, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import type { AdminView, ManagedMember } from '@/lib/admin';
import { MEMBER_ROLE_LABELS } from '@/lib/profile';

import { signOut } from '../../_actions/sign-out';

import { AdminNavigation } from './AdminNavigation';
import { ConsultantManagement } from './ConsultantManagement';
import { ConsultingManagement } from './ConsultingManagement';
import { StudentManagement } from './StudentManagement';

type AdminDashboardProps = {
  adminName: string;
  role?: 'admin' | 'consultant_lead';
  members: ManagedMember[];
  view: AdminView;
  headerActions?: ReactNode;
};

export function AdminDashboard({
  adminName,
  role = 'admin',
  members,
  view,
  headerActions,
}: AdminDashboardProps) {
  const students = members.filter((member) => member.role === 'student');
  const consultants = members.filter(
    (member) =>
      member.role === 'consultant' || member.role === 'consultant_lead',
  );

  return (
    <SidebarProvider>
      {headerActions}
      <Sidebar>
        <SidebarHeader className="border-b p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
              <LayoutDashboard className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">MEA</p>
              <p className="truncate text-xs text-muted-foreground">
                {MEMBER_ROLE_LABELS[role]} 페이지
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <AdminNavigation
            role={role}
            consultantCount={consultants.length}
            studentCount={students.length}
            view={view}
          />
        </SidebarContent>

        <SidebarFooter className="border-t p-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <Avatar size="sm">
              <AvatarFallback>{adminName.trim().charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{adminName}</p>
              <p className="text-xs text-muted-foreground">
                {MEMBER_ROLE_LABELS[role]}
              </p>
            </div>
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                aria-label="로그아웃"
              >
                <LogOut />
              </Button>
            </form>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center px-4 md:px-6 md:hidden">
          <SidebarTrigger className="-ml-1 md:hidden" aria-label="메뉴 열기" />
        </header>

        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            {role === 'admin' && view === 'students' ? (
              <StudentManagement students={students} />
            ) : view === 'consultants' ? (
              <ConsultantManagement
                canManageRoles={role === 'admin'}
                consultants={consultants}
              />
            ) : (
              <ConsultingManagement role={role} />
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

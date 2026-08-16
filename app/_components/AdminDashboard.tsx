import { LayoutDashboard, LogOut } from 'lucide-react';

import { AdminNavigation } from '@/app/_components/AdminNavigation';
import { ConsultantManagement } from '@/app/_components/ConsultantManagement';
import { ConsultingManagement } from '@/app/_components/ConsultingManagement';
import { StudentManagement } from '@/app/_components/StudentManagement';
import { signOut } from '@/app/_lib/actions';
import type { AdminView, ManagedMember } from '@/app/_lib/admin';
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

type AdminDashboardProps = {
  adminName: string;
  members: ManagedMember[];
  view: AdminView;
};

export function AdminDashboard({
  adminName,
  members,
  view,
}: AdminDashboardProps) {
  const students = members.filter((member) => member.role === 'student');
  const consultants = members.filter((member) => member.role !== 'student');

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
              <LayoutDashboard className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">MEA</p>
              <p className="truncate text-xs text-muted-foreground">
                관리자 페이지
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <AdminNavigation
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
              <p className="text-xs text-muted-foreground">관리자</p>
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
          <SidebarTrigger className="-ml-1" aria-label="메뉴 열기" />
        </header>

        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            {view === 'students' ? (
              <StudentManagement students={students} />
            ) : view === 'consultants' ? (
              <ConsultantManagement consultants={consultants} />
            ) : (
              <ConsultingManagement />
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

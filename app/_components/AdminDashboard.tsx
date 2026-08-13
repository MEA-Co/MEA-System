import { LayoutDashboard, LogOut } from 'lucide-react';

import { AdminNavigation } from '@/app/_components/AdminNavigation';
import { QuestManagement } from '@/app/_components/QuestManagement';
import { signOut } from '@/app/_lib/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StudentPeriod } from '@/lib/profile';
import type { Quest } from '@/lib/quest';

export type ManagedMember = {
  id: string;
  role: 'student' | 'consultant' | 'admin';
  name: string;
  student_period: StudentPeriod | null;
  created_at: string;
};

export type AdminView = 'students' | 'consultants' | 'quests';

type AdminDashboardProps = {
  adminName: string;
  members: ManagedMember[];
  quests: Quest[];
  view: AdminView;
};

const joinedDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
});

function MemberTable({
  members,
  view,
}: Pick<AdminDashboardProps, 'members' | 'view'>) {
  const isStudentView = view === 'students';

  if (members.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center border-t text-center">
        <div>
          <p className="text-sm font-medium text-foreground">
            등록된 {isStudentView ? '학생' : '컨설턴트'}이 없습니다.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            회원가입을 완료한 회원이 여기에 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>이름</TableHead>
          <TableHead>{isStudentView ? '현재 시기' : '회원 유형'}</TableHead>
          <TableHead className="hidden text-right md:table-cell">
            가입일
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarFallback>
                    {member.name.trim().charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">
                  {member.name}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {isStudentView
                  ? (member.student_period ?? '미입력')
                  : member.role === 'admin'
                    ? '관리자'
                    : '컨설턴트'}
              </Badge>
            </TableCell>
            <TableCell className="hidden text-right text-muted-foreground md:table-cell">
              {joinedDateFormatter.format(new Date(member.created_at))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AdminDashboard({
  adminName,
  members,
  quests,
  view,
}: AdminDashboardProps) {
  const students = members.filter((member) => member.role === 'student');
  const consultants = members.filter((member) => member.role !== 'student');
  const selectedMembers = view === 'students' ? students : consultants;
  const title =
    view === 'students'
      ? '학생 관리'
      : view === 'consultants'
        ? '컨설턴트 관리'
        : '목표 관리';

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
            questCount={quests.length}
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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6">
          <SidebarTrigger className="-ml-1 md:hidden" aria-label="메뉴 열기" />
          <Separator orientation="vertical" className="h-4 md:hidden" />
          <p className="text-sm font-medium">{title}</p>
        </header>

        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            {view === 'quests' ? (
              <QuestManagement quests={quests} />
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    회원 관리
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
                    {title}
                  </h1>
                </div>

                <Card className="mt-6 gap-0 rounded-lg border shadow-none ring-0">
                  <CardHeader className="pb-5">
                    <CardTitle>{title} 목록</CardTitle>
                    <CardDescription>
                      총 {selectedMembers.length}명의 회원이 있습니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-0">
                    <MemberTable members={selectedMembers} view={view} />
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { ClipboardList, LogOut } from 'lucide-react';

import { StudentQuestCard } from '@/app/_components/StudentQuestCard';
import { signOut } from '@/app/_lib/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { StudentPeriod } from '@/lib/profile';
import type { Quest, QuestResponse } from '@/lib/quest';

type StudentDashboardProps = {
  studentName: string;
  studentPeriod: StudentPeriod;
  quests: Quest[];
  responses: QuestResponse[];
};

export function StudentDashboard({
  studentName,
  studentPeriod,
  quests,
  responses,
}: StudentDashboardProps) {
  const responseByQuestId = new Map(
    responses.map((response) => [response.quest_id, response]),
  );

  return (
    <main className="min-h-svh bg-white">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 md:px-8 lg:px-10">
          <p className="text-sm font-semibold tracking-wide">MEA</p>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="size-4" />
              로그아웃
            </Button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14 lg:px-10 lg:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">학생</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
              {studentName}님의 Quest
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              현재 시기에 맞는 질문에 답변해 주세요.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            {studentPeriod}
          </Badge>
        </div>

        <div className="mt-10 flex items-center justify-between">
          <h2 className="font-medium">나의 Quest</h2>
          <span className="text-sm text-muted-foreground">
            총 {quests.length}개
          </span>
        </div>

        {quests.length === 0 ? (
          <Card className="mt-4 rounded-lg border shadow-none ring-0">
            <CardContent className="flex min-h-64 items-center justify-center text-center">
              <div>
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                  <ClipboardList className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm font-medium">
                  등록된 Quest가 없습니다.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  현재 시기의 Quest가 등록되면 이곳에 표시됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 space-y-4">
            {quests.map((quest, index) => (
              <StudentQuestCard
                key={quest.id}
                quest={quest}
                number={index + 1}
                initialResponse={responseByQuestId.get(quest.id)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

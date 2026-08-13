import { ListChecks } from 'lucide-react';

import { QuestFormDialog } from '@/app/_components/QuestFormDialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { STUDENT_PERIODS } from '@/lib/profile';
import type { Quest } from '@/lib/quest';

type QuestManagementProps = {
  quests: Quest[];
};

function AnswerPreview({ quest }: { quest: Quest }) {
  if (quest.answer_type === 'text') {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        학생이 텍스트로 답변합니다.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {quest.table_columns.map((column) => (
              <TableHead key={column} className="h-10 text-xs">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="hover:bg-transparent">
            {quest.table_columns.map((column) => (
              <TableCell
                key={column}
                className="h-10 text-xs text-muted-foreground"
              >
                답변 입력
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export function QuestManagement({ quests }: QuestManagementProps) {
  const groups = STUDENT_PERIODS.map((period) => ({
    period,
    quests: quests.filter((quest) => quest.student_period === period),
  })).filter((group) => group.quests.length > 0);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">운영 관리</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            목표 관리
          </h1>
        </div>
        <QuestFormDialog />
      </div>

      {groups.length === 0 ? (
        <Card className="mt-6 rounded-lg border shadow-none ring-0">
          <CardContent className="flex min-h-64 items-center justify-center text-center">
            <div>
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                <ListChecks className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium">
                등록된 Quest가 없습니다.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                첫 Quest를 추가해 학생의 목표를 구성해 보세요.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {groups.map((group) => (
            <Card
              key={group.period}
              className="gap-0 rounded-lg border py-0 shadow-none ring-0"
            >
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h2 className="font-medium">{group.period}</h2>
                <Badge variant="outline">{group.quests.length}개</Badge>
              </div>
              <CardContent className="divide-y px-0">
                {group.quests.map((quest, index) => (
                  <article key={quest.id} className="space-y-4 px-5 py-5">
                    <div className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium leading-6">
                            {quest.question}
                          </p>
                          <Badge variant="secondary">
                            {quest.answer_type === 'text' ? '텍스트' : '표'}
                          </Badge>
                        </div>
                        <div className="mt-3">
                          <AnswerPreview quest={quest} />
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

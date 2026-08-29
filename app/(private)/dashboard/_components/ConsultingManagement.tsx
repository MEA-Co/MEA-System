import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MATERIAL_BOX_CONSULTING_ID } from '@/features/consulting/completion';

const consultingItems = [
  {
    id: MATERIAL_BOX_CONSULTING_ID,
    title: '생활기록부 브랜딩 컨설팅 [재료함 설계]',
    href: '/consulting/material-box',
  },
] as const;

export function ConsultingManagement({
  completedConsultingIds = [],
}: {
  completedConsultingIds?: ReadonlyArray<string>;
}) {
  return (
    <>
      <div>
        <p className="text-sm font-medium text-muted-foreground">운영 관리</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          컨설팅 관리
        </h1>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {consultingItems.map((consulting) => {
          const isCompleted = completedConsultingIds.includes(consulting.id);
          const href = isCompleted
            ? `${consulting.href}/result`
            : consulting.href;

          return (
            <Card
              key={consulting.href}
              className="gap-0 rounded-xl border py-0 shadow-none ring-0"
            >
              <CardHeader className="py-5">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="leading-6">
                    {consulting.title}
                  </CardTitle>
                  {isCompleted ? (
                    <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      완료
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardFooter className="border-t px-6 py-4">
                <Button
                  render={<Link href={href} />}
                  nativeButton={false}
                  className="w-full"
                >
                  {isCompleted ? '결과 보기' : '시작하기'}
                  <ArrowUpRight />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </>
  );
}

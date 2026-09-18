import { ArrowRight, ArrowUpRight, Clock3, Compass } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MATERIAL_BOX_CONSULTING_ID } from '@/features/consulting/completion';
import type { MemberRole } from '@/lib/profile';

const consultingItems: ReadonlyArray<{
  id: string;
  title: string;
  href: string;
  estimatedDuration?: string;
}> = [
  {
    id: 'branding-consulting',
    title: '생활기록부 브랜딩 컨설팅',
    href: '/consulting/branding',
    estimatedDuration: '20~30분',
  },
  {
    id: MATERIAL_BOX_CONSULTING_ID,
    title: '생활기록부 브랜딩 컨설팅 [재료함 설계]',
    href: '/consulting/material-box',
  },
];

function BrandingConsultingCard({
  href,
  isCompleted,
  estimatedDuration,
}: {
  href: string;
  isCompleted: boolean;
  estimatedDuration?: string;
}) {
  return (
    <Card className="gap-0 rounded-2xl border border-violet-900/15 bg-white py-0 shadow-sm ring-0 transition-shadow hover:shadow-md">
      <div className="border-b border-violet-900/10 bg-linear-to-br from-violet-50 via-violet-50/60 to-amber-50/70 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-violet-800/10 bg-white/80 text-violet-800">
              <Compass className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-violet-700">
                STEP 01
              </p>
              <p className="mt-0.5 text-sm font-medium text-violet-950">
                나만의 방향 찾기
              </p>
            </div>
          </div>
          {isCompleted ? (
            <Badge className="bg-emerald-100 text-emerald-800">완료</Badge>
          ) : null}
        </div>
      </div>

      <CardHeader className="gap-3 pt-6 pb-5">
        <h2 className="text-xl leading-7 font-semibold tracking-tight text-slate-900">
          생활기록부 브랜딩 컨설팅
        </h2>
        <p className="text-sm leading-6 break-keep text-slate-600">
          나의 관심과 강점을 연결해,
          <br />
          생활기록부에 담을 나만의 이야기를 만들어요.
        </p>
        <Badge
          variant="outline"
          className="mt-1 h-auto gap-1.5 rounded-full border-violet-100 bg-violet-50 px-2.5 py-1 text-violet-800"
        >
          <Clock3 aria-hidden="true" />
          <span>예상 소요 시간</span>
          <span className="ml-0.5 font-semibold tabular-nums">
            {estimatedDuration}
          </span>
        </Badge>
      </CardHeader>

      <div className="mx-6 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
        <p className="mb-3 text-xs font-semibold text-slate-600">
          함께 완성할 4가지
        </p>
        <ol className="grid grid-cols-2 gap-x-3 gap-y-3">
          {[
            '전공 세부 키워드',
            '전공 가치관',
            '계열 적합 역량',
            '한 줄 서사',
          ].map((output, index) => (
            <li key={output} className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-semibold text-violet-700 ring-1 ring-slate-200/70">
                {index + 1}
              </span>
              <span className="text-xs font-medium text-slate-700">
                {output}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <CardFooter className="mt-auto px-6 py-5">
        <Button
          render={<Link href={href} />}
          nativeButton={false}
          className="h-11 w-full justify-between rounded-xl bg-violet-800 px-4 text-white hover:bg-violet-900 focus-visible:ring-violet-600/30"
        >
          {isCompleted ? '결과 보기' : '브랜딩 시작하기'}
          <ArrowRight aria-hidden="true" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ConsultingView({
  role,
  completedConsultingIds = [],
}: {
  completedConsultingIds?: ReadonlyArray<string>;
  role: MemberRole;
}) {
  return (
    <>
      <div>
        {role !== 'consultant' && (
          <p className="text-sm font-medium text-muted-foreground">운영 관리</p>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          {role === 'consultant' ? '컨설팅 목록' : '컨설팅 관리'}
        </h1>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {consultingItems
          .filter(
            (item) =>
              item.id !== 'branding-consulting' ||
              role === 'consultant' ||
              role === 'consultant_lead' ||
              role === 'admin',
          )
          .map((consulting) => {
            const isCompleted = completedConsultingIds.includes(consulting.id);
            const href = isCompleted
              ? `${consulting.href}/result`
              : consulting.href;

            if (consulting.id === 'branding-consulting') {
              return (
                <BrandingConsultingCard
                  key={consulting.id}
                  href={href}
                  isCompleted={isCompleted}
                  estimatedDuration={consulting.estimatedDuration}
                />
              );
            }

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

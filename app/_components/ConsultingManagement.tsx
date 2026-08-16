import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export function ConsultingManagement() {
  return (
    <>
      <div>
        <p className="text-sm font-medium text-muted-foreground">운영 관리</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          컨설팅 관리
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          학생에게 제공할 컨설팅을 확인하고 저장 없이 미리 체험할 수 있습니다.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="gap-0 rounded-xl border py-0 shadow-none ring-0">
          <CardHeader className="py-5">
            <CardTitle className="leading-6">
              생활기록부 브랜딩 컨설팅 [재료함 설계]
            </CardTitle>
          </CardHeader>
          <CardFooter className="border-t px-6 py-4">
            <Button
              render={<Link href="/consulting/material-box" />}
              nativeButton={false}
              className="w-full"
            >
              체험하기
              <ArrowUpRight />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}

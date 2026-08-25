'use client';

import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function ConsultingResultCard({
  children,
  onReset,
}: {
  children: ReactNode;
  onReset: () => void;
}) {
  return (
    <Card className="mx-auto w-full max-w-3xl gap-0 rounded-2xl bg-background/90 py-0 shadow-sm ring-0">
      <CardContent className="p-5 md:p-7">
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              컨설팅 완료
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-[-0.03em] md:text-2xl">
              컨설팅 결과
            </h1>
          </div>
          <Button type="button" variant="outline" onClick={onReset}>
            <RotateCcw aria-hidden="true" />
            다시 체험하기
          </Button>
        </div>
        <div className="mt-5">{children}</div>
      </CardContent>
    </Card>
  );
}

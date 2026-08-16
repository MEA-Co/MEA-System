import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';

type ConsultingMainProps = {
  children?: ReactNode;
};

export function ConsultingMain({ children }: ConsultingMainProps) {
  return (
    <Card className="min-h-120 gap-0 rounded-xl border py-0 shadow-none ring-0">
      <CardContent className="p-5 md:p-8">
        <p className="text-sm font-medium">메인 화면</p>
        {children}
      </CardContent>
    </Card>
  );
}

import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';

type ConsultingPrompterProps = {
  children?: ReactNode;
};

export function ConsultingPrompter({ children }: ConsultingPrompterProps) {
  return (
    <Card className="min-h-32 gap-0 rounded-xl border py-0 shadow-none ring-0">
      <CardContent className="p-5 md:p-6">
        <p className="text-sm font-medium">프롬프터</p>
        {children}
      </CardContent>
    </Card>
  );
}

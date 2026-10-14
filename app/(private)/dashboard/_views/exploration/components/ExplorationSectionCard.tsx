import { type ReactNode, useId } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function ExplorationSectionCard({
  title,
  index,
  children,
}: {
  title: string;
  index: number;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <Card variant="accent" size="sm" aria-labelledby={headingId}>
      <CardHeader variant="emphasis">
        <h2
          id={headingId}
          className="flex items-center gap-3 text-base font-bold"
        >
          <span
            aria-hidden="true"
            className="text-sm tabular-nums text-muted-foreground"
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          {title}
        </h2>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

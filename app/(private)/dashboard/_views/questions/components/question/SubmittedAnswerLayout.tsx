import type { ReactNode } from 'react';

import { DetailValue } from '@/components/ui/detail-value';

export function SubmittedAnswerGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background">
      {title && (
        <h4 className="border-b border-border bg-muted px-4 py-3 text-sm font-bold text-foreground">
          {title}
        </h4>
      )}
      <dl className="space-y-4 p-4">{children}</dl>
    </section>
  );
}

export function SubmittedAnswerField({
  label,
  multiple,
  children,
}: {
  label: string;
  multiple: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid min-w-0 items-start gap-2 ${multiple ? 'sm:grid-cols-[minmax(10rem,28%)_minmax(0,1fr)] sm:gap-6' : ''}`}
    >
      <dt className="text-sm font-semibold break-keep wrap-anywhere">
        {label}
      </dt>
      <DetailValue className="px-4 py-3 wrap-anywhere">{children}</DetailValue>
    </div>
  );
}

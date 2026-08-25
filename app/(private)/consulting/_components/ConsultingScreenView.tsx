import type { ReactNode } from 'react';

export function ConsultingScreenView({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-120 grid-rows-[1fr_auto] gap-6">{children}</div>
  );
}

'use client';

import { useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import type { ValuesState } from '@/features/major-values/domain';
import { lastValuesSession } from '@/features/major-values/session';

const subscribe = () => () => {};
export function ValuesResumeNotice(props: {
  ownerId: string;
  onResume: (state: ValuesState) => void;
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return hydrated ? <SavedNotice {...props} /> : null;
}
function SavedNotice({
  ownerId,
  onResume,
}: {
  ownerId: string;
  onResume: (state: ValuesState) => void;
}) {
  const [saved] = useState(() => {
    try {
      return lastValuesSession(window.sessionStorage, ownerId);
    } catch {
      return null;
    }
  });
  const [dismissed, setDismissed] = useState(false);
  if (!saved || dismissed) return null;
  return (
    <aside className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm">
      <p>
        이 탭에 저장된 가치관 탐색이 있어요. 전공과 키워드를 다시 입력하지 않고
        이어갈 수 있어요.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            setDismissed(true);
            onResume(saved);
          }}
        >
          가치관 탐색 이어하기
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          처음부터 진행
        </Button>
      </div>
    </aside>
  );
}

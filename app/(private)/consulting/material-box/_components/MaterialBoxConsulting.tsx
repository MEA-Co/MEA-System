'use client';

import { Eye, Play } from 'lucide-react';
import { useState } from 'react';

import { ConsultingFlow } from '@/app/(private)/consulting/_components/ConsultingFlow';
import { ConsultingReview } from '@/app/(private)/consulting/_components/ConsultingReview';
import { materialBoxPlan } from '@/app/(private)/consulting/material-box/_lib/plan';
import { materialBoxRenderer } from '@/app/(private)/consulting/material-box/_lib/renderer';
import { materialBoxReviewPlan } from '@/app/(private)/consulting/material-box/_lib/review';
import { materialBoxTools } from '@/app/(private)/consulting/material-box/_lib/tools';
import type { MaterialBoxContext } from '@/app/(private)/consulting/material-box/_lib/types';
import { Button } from '@/components/ui/button';
import type { ConsultingMemory } from '@/features/consulting/core/agent';
import type { MemberRole } from '@/lib/profile';

type MaterialBoxConsultingProps = {
  role: MemberRole;
  debug?: boolean;
  reviewEnabled?: boolean;
};

async function saveMaterialBoxCompletion({
  planId,
  memory,
}: {
  planId: string;
  memory: ConsultingMemory<MaterialBoxContext>;
}) {
  const response = await fetch('/api/consulting/material-box/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, memory }),
  });

  if (response.ok) return;

  let message = '완료 결과를 저장하지 못했습니다. 다시 시도해 주세요.';
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) {
      message = body.error;
    }
  } catch {
    // 응답 본문을 읽지 못해도 학생에게 재시도 가능한 메시지를 보여준다.
  }
  throw new Error(message);
}

export function MaterialBoxConsulting({
  role,
  debug = false,
  reviewEnabled = false,
}: MaterialBoxConsultingProps) {
  const [mode, setMode] = useState<'experience' | 'review'>('experience');

  return (
    <div className="space-y-4">
      {reviewEnabled ? (
        <div
          className="flex w-fit rounded-xl border bg-background p-1 shadow-sm"
          role="group"
          aria-label="컨설팅 확인 방식"
        >
          <Button
            type="button"
            variant={mode === 'experience' ? 'default' : 'ghost'}
            size="sm"
            aria-pressed={mode === 'experience'}
            onClick={() => setMode('experience')}
          >
            <Play aria-hidden="true" />
            직접 체험
          </Button>
          <Button
            type="button"
            variant={mode === 'review' ? 'default' : 'ghost'}
            size="sm"
            aria-pressed={mode === 'review'}
            onClick={() => setMode('review')}
          >
            <Eye aria-hidden="true" />
            전체 검토
          </Button>
        </div>
      ) : null}

      {mode === 'review' && reviewEnabled ? (
        <ConsultingReview
          plan={materialBoxPlan}
          review={materialBoxReviewPlan}
          renderer={materialBoxRenderer}
          viewerRole={role}
        />
      ) : (
        <ConsultingFlow
          debug={debug}
          onComplete={
            role === 'student' ? saveMaterialBoxCompletion : undefined
          }
          plan={materialBoxPlan}
          renderer={materialBoxRenderer}
          tools={materialBoxTools}
          viewerRole={role}
        />
      )}
    </div>
  );
}

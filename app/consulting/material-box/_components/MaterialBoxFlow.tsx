'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConsultingMain } from '@/features/consulting/components/ConsultingMain';
import { ConsultingPrompter } from '@/features/consulting/components/ConsultingPrompter';
import { useConsultingTurn } from '@/features/consulting/hooks/useConsultingTurn';

const openingMessage =
  '안녕하세요. 지금부터 생활기록부 브랜딩에 활용할 재료함을 함께 만들어 볼게요. 먼저 최근 학교생활에서 가장 기억에 남는 경험 하나를 떠올려 주세요.';

export function MaterialBoxFlow() {
  const { turn, startUserTurn } = useConsultingTurn();

  if (turn === 'service') {
    return (
      <div className="space-y-4">
        <ConsultingMain>
          <div className="flex min-h-96 items-center justify-center">
            <div className="max-w-md space-y-2 text-center">
              <p className="text-lg font-semibold">재료함 설계를 시작합니다</p>
              <p className="text-sm leading-6 text-muted-foreground">
                화면 아래의 안내를 읽고 준비가 되면 답변을 시작해 주세요.
              </p>
            </div>
          </div>
        </ConsultingMain>

        <ConsultingPrompter>
          <div className="mt-3 space-y-4">
            <p className="max-w-3xl text-base leading-7">{openingMessage}</p>
            <Button onClick={startUserTurn}>답변 시작하기</Button>
          </div>
        </ConsultingPrompter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConsultingMain>
        <div className="mx-auto flex min-h-96 w-full max-w-2xl flex-col justify-center gap-3">
          <label
            htmlFor="memorable-experience"
            className="text-base font-semibold"
          >
            가장 기억에 남는 경험은 무엇인가요?
          </label>
          <Textarea
            id="memorable-experience"
            name="memorableExperience"
            className="min-h-40 resize-y"
            placeholder="떠오르는 경험을 자유롭게 적어 주세요."
            autoFocus
          />
        </div>
      </ConsultingMain>

      <ConsultingPrompter>
        <p className="mt-3 max-w-3xl text-base leading-7">
          잘 정리된 문장이 아니어도 괜찮아요. 어떤 일이었는지, 내가 무엇을
          했는지부터 편하게 적어 보세요.
        </p>
      </ConsultingPrompter>
    </div>
  );
}

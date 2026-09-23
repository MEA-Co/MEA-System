import { CircleHelp } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const types = [
  {
    name: '이론형',
    question: '무엇이며, 왜·어떻게 그러한가?',
    description:
      '개념이나 원리, 현상의 원인과 관계를 이해하고 설명하는 데 목적이 있습니다.',
    examples: [
      '노이즈 캔슬링은 어떤 원리로 작동하는가?',
      '수면은 기억 형성에 어떤 영향을 미치는가?',
    ],
  },
  {
    name: '사례/응용형',
    question: '실제 상황에서 어떻게 나타나거나 활용될 수 있는가?',
    description:
      '개념·이론을 구체적인 사례에 적용해 해석하거나, 실제 문제의 해결 방안을 찾는 데 목적이 있습니다.',
    examples: [
      '행동경제학의 ‘넛지’는 학교 급식의 잔반 줄이기에 어떻게 활용될 수 있는가?',
      '전통 가옥의 구조에는 자연 냉방 원리가 어떻게 적용되어 있는가?',
    ],
  },
  {
    name: '가치판단형',
    question: '무엇이 바람직하며, 어떤 기준으로 판단해야 하는가?',
    description:
      '서로 다른 가치와 입장을 검토하고, 근거를 들어 판단이나 선택을 정당화하는 데 목적이 있습니다.',
    examples: [
      '학교에서 AI를 활용한 과제를 어디까지 허용해야 하는가?',
      '도시 개발과 생태계 보전이 충돌할 때 무엇을 기준으로 결정해야 하는가?',
    ],
  },
];

export function ExplorationTypeHelp() {
  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={<DialogTrigger />}
            type="button"
            aria-label="탐구 유형 설명 보기"
            className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <CircleHelp className="size-4" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>클릭하여 설명 확인</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle>탐구 유형 안내</DialogTitle>
          <DialogDescription>
            각 유형의 설명과 예시를 확인하고 탐구에 맞는 유형을 선택해 주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {types.map((type) => (
            <section
              key={type.name}
              className="space-y-3 rounded-xl border p-4"
            >
              <h3 className="font-semibold">{type.name}</h3>
              <p className="leading-6">
                <span className="font-medium">“{type.question}”</span>에 답하는
                탐구입니다. {type.description}
              </p>
              <div className="space-y-1.5 rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  예시
                </p>
                <ol className="list-decimal space-y-1 pl-5 leading-6">
                  {type.examples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ol>
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

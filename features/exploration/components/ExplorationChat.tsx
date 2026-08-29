'use client';

import {
  Check,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Send,
} from 'lucide-react';
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  type ExplorationResponse,
  ExplorationResponseSchema,
  type ExplorationState,
} from '@/features/exploration/schemas/exploration';
import { cn } from '@/lib/utils';

type RequestStatus = 'idle' | 'loading' | 'ready' | 'error';

function replaceAt<T>(current: ReadonlyArray<T>, index: number, value: T) {
  return current.map((item, itemIndex) => (itemIndex === index ? value : item));
}

async function requestExploration(body: unknown): Promise<ExplorationResponse> {
  const response = await fetch('/api/exploration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : '탐구 코치의 응답을 불러오지 못했습니다.';
    throw new Error(message);
  }

  return ExplorationResponseSchema.parse(payload);
}

export function ExplorationChat({
  departments,
  initialStates = [],
  onComplete,
}: {
  departments: ReadonlyArray<string>;
  initialStates?: ReadonlyArray<ExplorationState>;
  onComplete: (states: ReadonlyArray<ExplorationState>) => void;
}) {
  const initialStateByDepartment = useMemo(
    () => new Map(initialStates.map((state) => [state.department, state])),
    [initialStates],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [states, setStates] = useState<ReadonlyArray<ExplorationState | null>>(
    () =>
      departments.map(
        (department) => initialStateByDepartment.get(department) ?? null,
      ),
  );
  const [statuses, setStatuses] = useState<ReadonlyArray<RequestStatus>>(() =>
    departments.map((department) =>
      initialStateByDepartment.has(department) ? 'ready' : 'idle',
    ),
  );
  const [errors, setErrors] = useState<ReadonlyArray<string | null>>(() =>
    departments.map(() => null),
  );
  const [drafts, setDrafts] = useState<ReadonlyArray<string>>(() =>
    departments.map(() => ''),
  );
  const startedDepartments = useRef(new Set<string>());
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const startDepartment = useCallback(
    async (index: number) => {
      const department = departments[index];
      if (!department) return;

      setStatuses((current) => replaceAt(current, index, 'loading'));
      setErrors((current) => replaceAt(current, index, null));

      try {
        const response = await requestExploration({
          action: 'start',
          department,
        });
        setStates((current) => replaceAt(current, index, response.state));
        setStatuses((current) => replaceAt(current, index, 'ready'));
      } catch (cause) {
        setStatuses((current) => replaceAt(current, index, 'error'));
        setErrors((current) =>
          replaceAt(
            current,
            index,
            cause instanceof Error
              ? cause.message
              : '탐구 대화를 시작하지 못했습니다.',
          ),
        );
        startedDepartments.current.delete(department);
      }
    },
    [departments],
  );

  useEffect(() => {
    departments.forEach((department, index) => {
      if (
        initialStateByDepartment.has(department) ||
        startedDepartments.current.has(department)
      ) {
        return;
      }
      startedDepartments.current.add(department);
      void startDepartment(index);
    });
  }, [departments, initialStateByDepartment, startDepartment]);

  const activeState = states[activeIndex] ?? null;
  const activeStatus = statuses[activeIndex] ?? 'idle';
  const activeError = errors[activeIndex] ?? null;
  const activeDraft = drafts[activeIndex] ?? '';
  const allCompleted = states.every(
    (state) => state !== null && state.profile !== null,
  );

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, activeState?.conversation.length]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = activeDraft.trim();
    if (!activeState || !message || activeStatus === 'loading') return;

    const stateBeforeRequest = activeState;
    setDrafts((current) => replaceAt(current, activeIndex, ''));
    setStatuses((current) => replaceAt(current, activeIndex, 'loading'));
    setErrors((current) => replaceAt(current, activeIndex, null));

    try {
      const response = await requestExploration({
        action: 'message',
        state: stateBeforeRequest,
        message,
      });
      setStates((current) => replaceAt(current, activeIndex, response.state));
      setStatuses((current) => replaceAt(current, activeIndex, 'ready'));
    } catch (cause) {
      setDrafts((current) => replaceAt(current, activeIndex, message));
      setStatuses((current) => replaceAt(current, activeIndex, 'error'));
      setErrors((current) =>
        replaceAt(
          current,
          activeIndex,
          cause instanceof Error
            ? cause.message
            : '메시지를 보내지 못했습니다.',
        ),
      );
    }
  };

  const completeConversation = () => {
    const completedStates = states.filter(
      (state): state is ExplorationState =>
        state !== null && state.profile !== null,
    );
    if (completedStates.length === departments.length) {
      onComplete(completedStates);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-5xl gap-0 rounded-3xl py-0">
      <CardHeader className="gap-4 border-b px-4 py-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle
                aria-hidden="true"
                className="size-4 text-primary"
              />
              전공 탐구 코치
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              전공별 대화를 마치면 관심 키워드와 작성 초안이 정리됩니다.
            </p>
          </div>
          <Badge variant="secondary">
            {
              states.filter((state) => state !== null && state.profile !== null)
                .length
            }
            /{departments.length} 완료
          </Badge>
        </div>

        <aside className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-blue-950 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Lightbulb aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold">
                눈에 띄는 탐구는 구체적인 문제의식에서 시작해요.
              </p>
              <div className="mt-2 space-y-1 text-sm leading-6 text-blue-900/80">
                <p>
                  무엇이 문제인지, 왜 궁금한지 서둘러 정하지 말고 깊게
                  생각해보세요.
                </p>
                <p>
                  코치가 보여주는 예시나 제안을 무조건 따라갈 필요는 없어요.
                  자신만의 의문과 생각을 적극적으로 적어주세요.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex gap-2 overflow-x-auto" role="tablist">
          {departments.map((department, index) => {
            const isComplete =
              states[index] !== null && states[index]?.profile !== null;
            return (
              <Button
                key={department}
                type="button"
                size="sm"
                variant={activeIndex === index ? 'default' : 'outline'}
                role="tab"
                aria-selected={activeIndex === index}
                onClick={() => setActiveIndex(index)}
              >
                {isComplete && <Check aria-hidden="true" />}
                {department}
              </Button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div
          className="h-[min(46vh,28rem)] min-h-80 space-y-4 overflow-y-auto px-4 py-5 md:px-6"
          role="tabpanel"
        >
          {!activeState && activeStatus === 'loading' && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              {departments[activeIndex]}의 탐구 지도를 준비하고 있어요.
            </div>
          )}

          {activeState?.conversation.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={cn(
                'flex',
                turn.role === 'student' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6',
                  turn.role === 'student'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground',
                )}
              >
                {turn.content}
              </div>
            </div>
          ))}

          {activeState && activeStatus === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              답변을 정리하고 있어요.
            </div>
          )}
          <div ref={conversationEndRef} />
        </div>

        {activeError && (
          <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl bg-destructive/8 px-3 py-2 text-sm text-destructive md:mx-6">
            <span>{activeError}</span>
            {!activeState && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const department = departments[activeIndex];
                  if (department) startedDepartments.current.add(department);
                  void startDepartment(activeIndex);
                }}
              >
                <RotateCcw aria-hidden="true" />
                다시 시도
              </Button>
            )}
          </div>
        )}

        <div className="border-t px-4 py-4 md:px-6">
          {activeState?.profile ? (
            <p className="rounded-xl bg-primary/8 px-4 py-3 text-sm font-medium text-primary">
              이 전공의 탐구 목표가 정리됐어요. 다른 전공 탭의 대화도
              마쳐주세요.
            </p>
          ) : (
            <form onSubmit={sendMessage} className="flex items-end gap-2">
              <label
                htmlFor={`exploration-message-${activeIndex}`}
                className="sr-only"
              >
                {departments[activeIndex]} 탐구 코치에게 답하기
              </label>
              <Textarea
                id={`exploration-message-${activeIndex}`}
                value={activeDraft}
                rows={2}
                maxLength={2_000}
                disabled={!activeState || activeStatus === 'loading'}
                placeholder="궁금한 키워드나 생각을 편하게 적어주세요"
                onChange={(event) =>
                  setDrafts((current) =>
                    replaceAt(current, activeIndex, event.target.value),
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                className="min-h-16 resize-none"
              />
              <Button
                type="submit"
                size="icon-lg"
                disabled={
                  !activeState ||
                  activeStatus === 'loading' ||
                  !activeDraft.trim()
                }
                aria-label="답변 보내기"
              >
                <Send aria-hidden="true" />
              </Button>
            </form>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={!allCompleted}
              onClick={completeConversation}
            >
              대화 결과로 초안 만들기
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

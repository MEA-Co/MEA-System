'use client';

import { ArrowLeft, ArrowRight, LoaderCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { continueMajorValues } from '@/features/major-values/actions';
import {
  appendStudentTurn,
  canConfirmResults,
  canReview,
  decideConnection,
  explorationStatus,
  finishEarly,
  initialValuesState,
  resultText,
  skipInterest,
  type ValuesContext,
  type ValuesState,
} from '@/features/major-values/domain';
import {
  loadValuesSession,
  saveValuesSession,
} from '@/features/major-values/session';

import { statusLabels, ValuesResults } from './ValuesResults';
import { useValuesOwner } from './ValuesSessionProvider';

type Props = {
  context: ValuesContext;
  draftValue: string;
  onDraftChange: (value: string) => void;
  onBack: (value: string) => void;
  onComplete: (value: string) => void;
};
const subscribe = () => () => {};
export function MajorValuesChat(props: Props) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return hydrated ? (
    <ValuesChatSession {...props} />
  ) : (
    <p role="status" className="p-6 text-sm">
      가치관 탐색을 준비하고 있어요.
    </p>
  );
}
function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
function ValuesChatSession({
  context,
  draftValue,
  onDraftChange,
  onBack,
  onComplete,
}: Props) {
  const ownerId = useValuesOwner();
  const [state, setState] = useState(() =>
    loadValuesSession(storage(), ownerId, context, draftValue),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [state.conversation.length, pending]);
  const update = (next: ValuesState) => {
    setState(next);
    onDraftChange(JSON.stringify(next));
    setSaveError(!!ownerId && !saveValuesSession(storage(), ownerId, next));
  };
  async function request(next: ValuesState) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    update(next);
    const currentGeneration = generation.current;
    try {
      const result = await continueMajorValues({ state: next });
      if (generation.current !== currentGeneration) return;
      if (result.error) setError(result.error);
      else if (result.data) update(result.data);
    } catch {
      if (generation.current === currentGeneration)
        setError(
          '연결이 원활하지 않아요. 보낸 답변은 보존되어 있습니다. 다시 시도해주세요.',
        );
    } finally {
      if (generation.current === currentGeneration) {
        inFlight.current = false;
        setPending(false);
      }
    }
  }
  function sendMessage() {
    if (pending || state.pendingTurnId || !state.input.trim()) return;
    // The student may discuss more than the currently suggested topic in one answer.
    void request(
      appendStudentTurn(
        state,
        state.input,
        state.activeInterestIds.length
          ? state.activeInterestIds
          : state.context.interests.map((i) => i.id),
      ),
    );
  }
  const locked =
    pending ||
    !!state.pendingTurnId ||
    Object.keys(state.resultDrafts).length > 0;
  const finished = state.context.interests.filter((i) =>
    ['explored', 'jointly-explored', 'skipped', 'needs-confirmation'].includes(
      explorationStatus(state, i.id),
    ),
  ).length;
  return (
    <section className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-violet-100 bg-white">
      <header className="space-y-2 border-b border-violet-100 p-5 md:p-7">
        <p className="text-sm font-semibold text-violet-700">
          STEP 02 · {finished}/{context.interests.length} 관심사 살펴봄
        </p>
        <h2 className="text-2xl font-semibold">전공 가치관</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          이미 고른 키워드에 왜 관심이 있는지 이야기해보세요. 서로 다른 이유도,
          아직 잘 모르겠다는 생각도 괜찮아요.
        </p>
      </header>
      {saveError && (
        <p role="status" className="px-5 pt-4 text-sm text-amber-800">
          이 탭에 저장하지 못했어요. 현재 화면의 내용은 유지되지만 새로고침하면
          사라질 수 있어요.
        </p>
      )}
      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,1fr)]">
        <div className="min-w-0 space-y-5 p-5 md:p-7">
          {state.phase === 'review' ? (
            <ValuesResults state={state} onChange={update} />
          ) : (
            <>
              <div
                role="log"
                aria-label="전공 가치관 대화"
                aria-live="polite"
                aria-busy={pending}
                className="max-h-[55vh] min-h-64 space-y-4 overflow-y-auto"
              >
                {state.conversation.map((turn) => (
                  <div
                    key={turn.id}
                    className={
                      turn.role === 'student'
                        ? 'flex justify-end'
                        : 'flex justify-start'
                    }
                  >
                    <div
                      className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${turn.role === 'student' ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-800'}`}
                    >
                      <span className="sr-only">
                        {turn.role === 'student' ? '나' : 'MEA'}:{' '}
                      </span>
                      {turn.content}
                    </div>
                  </div>
                ))}
                {pending && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    관심사와 발언 근거를 함께 살펴보고 있어요.
                  </p>
                )}
                <div ref={endRef} />
              </div>
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <label htmlFor="major-values-message" className="sr-only">
                  내 관심과 생각
                </label>
                <Textarea
                  id="major-values-message"
                  value={state.input}
                  maxLength={3_000}
                  disabled={locked}
                  placeholder="이 키워드에 관심을 갖게 된 계기나 마음이 끌리는 이유를 적어주세요"
                  rows={3}
                  onChange={(e) => update({ ...state, input: e.target.value })}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing &&
                      e.keyCode !== 229
                    ) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={locked || !state.input.trim()}
                  aria-label="답변 보내기"
                >
                  <Send aria-hidden="true" />
                </Button>
              </form>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {state.pendingTurnId && !pending && (
            <Button variant="outline" onClick={() => void request(state)}>
              보존된 답변으로 다시 시도
            </Button>
          )}
          {!locked && (
            <div className="flex flex-wrap gap-2">
              {state.phase === 'review' ? (
                <Button
                  variant="outline"
                  onClick={() => update({ ...state, phase: 'conversation' })}
                >
                  대화로 돌아가기
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={!!state.input.trim()}
                  onClick={() =>
                    update(
                      canReview(state)
                        ? { ...state, phase: 'review' }
                        : finishEarly(state),
                    )
                  }
                >
                  {canReview(state)
                    ? '지금까지의 결과 확인'
                    : '여기까지 정리하기'}
                </Button>
              )}
            </div>
          )}
        </div>
        <aside className="space-y-5 border-t border-violet-100 bg-violet-50/50 p-5 lg:border-t-0 lg:border-l">
          <Button
            variant="ghost"
            size="sm"
            disabled={locked}
            onClick={() => {
              update(initialValuesState(context));
              setError(null);
            }}
          >
            새 탐색 시작
          </Button>
          <h3 className="text-sm font-semibold text-violet-900">
            내 전공과 관심사
          </h3>
          <p className="text-xs leading-5 text-muted-foreground">
            순위는 시작 순서일 뿐이에요. 원하는 관심사로 대화를 옮기거나,
            건너뛰어도 좋아요.
          </p>
          {context.interests.map((i) => (
            <article
              key={i.id}
              className={`space-y-2 rounded-xl border bg-white p-3 ${state.activeInterestIds.includes(i.id) ? 'border-violet-400' : 'border-violet-100'}`}
            >
              <p className="text-xs text-violet-700">
                {i.rank}순위 {i.majorName}
              </p>
              <h4 className="break-words text-sm font-semibold">{i.keyword}</h4>
              <p className="text-xs text-slate-500">
                {statusLabels[explorationStatus(state, i.id)]}
              </p>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={locked || !!state.input.trim()}
                  onClick={() =>
                    void request(
                      appendStudentTurn(
                        state,
                        `먼저 ${i.majorName}의 ‘${i.keyword}’ 관심사를 이야기하고 싶어요.`,
                        [i.id],
                        'topic',
                      ),
                    )
                  }
                >
                  이 관심사 이야기
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={locked}
                  onClick={() =>
                    update(
                      skipInterest(state, i.id, !state.skipped.includes(i.id)),
                    )
                  }
                >
                  {state.skipped.includes(i.id) ? '다시 탐색' : '건너뛰기'}
                </Button>
              </div>
            </article>
          ))}
          {state.connections.length > 0 && (
            <section className="space-y-3 border-t border-violet-200 pt-4">
              <h3 className="text-sm font-semibold">관심사 연결 확인</h3>
              {state.connections.map((c) => (
                <article
                  key={c.id}
                  className="space-y-2 rounded-xl bg-white p-3 text-sm"
                >
                  <p className="text-xs text-violet-700">
                    {state.connectionDecisions[c.id] === 'confirmed'
                      ? '학생이 확인한 연결'
                      : state.connectionDecisions[c.id] === 'rejected'
                        ? '분리한 관심사'
                        : 'MEA가 제안한 잠정 연결'}
                  </p>
                  <p>
                    {c.interestIds
                      .map((id) => context.interests.find((i) => i.id === id))
                      .map((i) => `${i?.majorName} · ${i?.keyword}`)
                      .join(' / ')}
                  </p>
                  <p className="leading-6 text-slate-600">{c.rationale}</p>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        locked ||
                        state.connectionDecisions[c.id] === 'confirmed'
                      }
                      onClick={() =>
                        update(decideConnection(state, c.id, true))
                      }
                    >
                      연결돼요
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={
                        locked || state.connectionDecisions[c.id] === 'rejected'
                      }
                      onClick={() =>
                        update(decideConnection(state, c.id, false))
                      }
                    >
                      따로 볼게요
                    </Button>
                  </div>
                </article>
              ))}
            </section>
          )}
        </aside>
      </div>
      <footer className="flex justify-between gap-3 border-t border-violet-100 p-5">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            update(state);
            onBack(resultText(state));
          }}
        >
          <ArrowLeft aria-hidden="true" />
          이전
        </Button>
        <Button
          disabled={locked || !canConfirmResults(state) || !!state.input.trim()}
          onClick={() => {
            update(state);
            onComplete(resultText(state));
          }}
        >
          확인한 내용으로 다음
          <ArrowRight aria-hidden="true" />
        </Button>
      </footer>
    </section>
  );
}

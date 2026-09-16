'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  explorationStatus,
  type Hypothesis,
  reviewHypothesis,
  type ValuesState,
} from '@/features/major-values/domain';

export const statusLabels: Record<string, string> = {
  unexplored: '미탐색',
  'needs-more': '이유를 더 확인할 필요가 있어요',
  'needs-confirmation': '남은 확인 사항이 있어요',
  explored: '탐색함',
  'jointly-explored': '연결을 확인하고 함께 탐색함',
  skipped: '학생이 건너뜀',
};
function HypothesisCard({
  hypothesis: h,
  state,
  onChange,
}: {
  hypothesis: Hypothesis;
  state: ValuesState;
  onChange: (state: ValuesState) => void;
}) {
  const draft = state.resultDrafts[h.id];
  const editing = !!draft;
  const text = draft?.statement ?? h.statement;
  const conditions = draft?.conditions ?? h.conditions.join('\n');
  const saveDraft = (statement: string, conditions: string) =>
    onChange({
      ...state,
      resultDrafts: {
        ...state.resultDrafts,
        [h.id]: { statement, conditions },
      },
    });
  const decision = state.hypothesisDecisions[h.id];
  const evidence = [...h.evidence, ...h.revisionEvidence];
  return (
    <article className="space-y-3 rounded-xl border border-violet-200 bg-white p-4">
      <p className="text-xs font-semibold text-violet-700">
        {decision === 'confirmed'
          ? '학생 확인 완료'
          : decision === 'excluded'
            ? '제외한 해석'
            : '학생 확인 전 · 잠정 결과'}{' '}
        ·{' '}
        {h.pattern === 'common'
          ? '여러 관심에서 반복된 방향'
          : h.pattern === 'conditional'
            ? '조건에 따른 판단'
            : '관심사 고유의 방향'}
      </p>
      <p className="text-sm text-slate-500">
        {h.interestIds
          .map((id) => {
            const i = state.context.interests.find((i) => i.id === id);
            return `${i?.majorName} · ${i?.keyword}`;
          })
          .join(' / ')}
      </p>
      {editing ? (
        <>
          <Textarea
            aria-label="내 말로 가치관 수정"
            maxLength={1_000}
            value={text}
            onChange={(e) => saveDraft(e.target.value, conditions)}
          />
          <Textarea
            aria-label="조건과 예외 수정"
            placeholder="조건과 예외를 한 줄씩 적어주세요. 없으면 비워두세요."
            maxLength={3_000}
            value={conditions}
            onChange={(e) => saveDraft(text, e.target.value)}
          />
          <Button
            size="sm"
            disabled={
              !text.trim() ||
              conditions.split('\n').filter((c) => c.trim()).length > 12
            }
            onClick={() => {
              onChange(
                reviewHypothesis(
                  state,
                  h.id,
                  'edited',
                  text,
                  conditions
                    .split('\n')
                    .map((c) => c.trim())
                    .filter(Boolean),
                ),
              );
            }}
          >
            수정 반영
          </Button>
          {conditions.split('\n').filter((c) => c.trim()).length > 12 && (
            <p className="text-sm text-destructive">
              조건과 예외는 12개 이하로 정리해주세요.
            </p>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const resultDrafts = { ...state.resultDrafts };
              delete resultDrafts[h.id];
              onChange({ ...state, resultDrafts });
            }}
          >
            수정 취소
          </Button>
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-7">{h.statement}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {h.basis === 'student-explicit'
          ? '학생이 직접 표현한 내용'
          : '학생 발언에 대한 MEA의 해석 · 확인이 필요해요'}
      </p>
      {h.conditions.length > 0 && (
        <p className="text-sm leading-6">
          조건과 예외: {h.conditions.join(' / ')}
        </p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-violet-700">
          근거 발언 보기 ({new Set(evidence.map((e) => e.turnId)).size}개 발언)
        </summary>
        <ul className="mt-2 space-y-2">
          {evidence.map((e, index) => (
            <li
              key={`${e.turnId}-${index}`}
              className="rounded-lg bg-slate-50 p-3"
            >
              “{e.quote}”
            </li>
          ))}
        </ul>
      </details>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={editing || decision === 'confirmed'}
          onClick={() => onChange(reviewHypothesis(state, h.id, 'confirmed'))}
        >
          내 생각과 맞아요
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            saveDraft(h.statement, h.conditions.join('\n'));
          }}
        >
          수정
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={decision === 'excluded'}
          onClick={() => onChange(reviewHypothesis(state, h.id, 'excluded'))}
        >
          제외
        </Button>
      </div>
    </article>
  );
}
export function ValuesResults({
  state,
  onChange,
}: {
  state: ValuesState;
  onChange: (state: ValuesState) => void;
}) {
  return (
    <section className="space-y-5" aria-label="전공 가치관 탐색 결과">
      <div>
        <h3 className="text-lg font-semibold">
          내 관심사에서 찾은 전공 가치관
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          각 문장과 발언 근거를 확인해주세요. 다르면 수정하거나 제외할 수
          있어요. 서로 다른 가치관도 그대로 남겨도 괜찮아요.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {state.context.interests.map((i) => {
          const observation = state.observations.find(
            (o) => o.interestId === i.id,
          );
          return (
            <article
              key={i.id}
              className="rounded-xl border p-4 text-sm leading-6"
            >
              <h4 className="font-semibold">
                {i.rank}순위 {i.majorName} · {i.keyword}
              </h4>
              <p className="text-violet-700">
                {statusLabels[explorationStatus(state, i.id)]}
              </p>
              {observation?.focus && <p>설명한 관심: {observation.focus}</p>}
              {observation?.direction && (
                <p>중요한 방향: {observation.direction}</p>
              )}
              {observation?.reason && <p>이유: {observation.reason}</p>}
              {observation?.conditions.map((c) => (
                <p key={c}>조건: {c}</p>
              ))}
              {observation?.openQuestions.map((q) => (
                <p key={q} className="text-muted-foreground">
                  더 확인할 내용: {q}
                </p>
              ))}
            </article>
          );
        })}
      </div>
      {!state.hypotheses.some(
        (h) =>
          h.pattern === 'common' &&
          state.hypothesisDecisions[h.id] !== 'excluded',
      ) && (
        <p className="text-sm text-muted-foreground">
          여러 관심사에 걸친 공통 패턴은 아직 확인되지 않았어요. 하나로 묶을
          필요는 없어요.
        </p>
      )}
      {!state.hypotheses.length && (
        <p className="rounded-xl bg-violet-50 p-4 text-sm">
          현재 대화에서는 가치관을 더 확인할 필요가 있어요. 미탐색 영역을 남기고
          다음 단계로 이동할 수 있어요.
        </p>
      )}
      {state.hypotheses.map((h) => (
        <HypothesisCard
          key={`${h.id}:${h.statement}`}
          hypothesis={h}
          state={state}
          onChange={onChange}
        />
      ))}
    </section>
  );
}

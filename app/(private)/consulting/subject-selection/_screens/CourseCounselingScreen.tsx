'use client';

import { ArrowLeftRight, Check, MessageCircle, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PriorityProfile } from '@/features/subject-selection/recommendations';
import { scienceSequenceGaps } from '@/features/subject-selection/science-sequence';

import { useComparisonExplanation } from '../_hooks/useComparisonExplanation';
import {
  counselingCandidates,
  type CounselingIntent,
  counselingTemplates,
  isScienceCourse,
  suggestsReducingScience,
} from '../_lib/counseling-question';
import { allocatedCourses } from '../_lib/course-swap';
import {
  compareAdvice,
  priority,
  swapProblem,
  type SwapReason,
  universityChanges,
} from '../_lib/course-swap';
import type { ConfirmedCurriculum, CurriculumCourse } from '../_lib/curriculum';

import {
  ComparisonExplanation,
  ComparisonExplanationLoading,
} from './_components/ComparisonExplanation';
import { CourseQuestionEntry } from './_components/CourseQuestionEntry';
import { ImportedCourseInfo } from './_components/CourseSelectionCourseInfo';
import { CourseSelectionFreeQuestions } from './_components/CourseSelectionFreeQuestions';

const selectClass =
  'mt-1 w-full min-w-0 rounded-md border bg-background p-2 text-sm';

export function CourseCounselingScreen({
  curriculum,
  department,
  profile,
  confirmedIds,
  recommendedIds,
  removedCourses = [],
  onSwap,
  onUndo,
  canUndo,
}: {
  curriculum: ConfirmedCurriculum;
  department: string;
  profile: PriorityProfile | null;
  confirmedIds: string[];
  recommendedIds: string[];
  removedCourses?: CurriculumCourse[];
  onSwap: (
    fromId: string,
    toId: string,
    acknowledgeScience?: boolean,
  ) => string | null;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const [intent, setIntent] = useState<CounselingIntent>('compare');
  const [introAccepted, setIntroAccepted] = useState(false);
  const [freeQuestionMode, setFreeQuestionMode] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [reason, setReason] = useState<SwapReason>('neutral');
  const [confident, setConfident] = useState(false);
  const [detail, setDetail] = useState('');
  const [sciencePreference, setSciencePreference] = useState<boolean | null>(
    null,
  );
  const [compared, setCompared] = useState(false);
  const explanation = useComparisonExplanation();
  const [messages, setMessages] = useState<
    Array<{ role: 'student' | 'advisor'; text: string }>
  >([]);
  const [notice, setNotice] = useState('');
  const [acknowledgedSequence, setAcknowledgedSequence] = useState('');
  const entries = useMemo(
    () =>
      curriculum.terms.flatMap((term) =>
        term.selectionGroups.flatMap((group) =>
          group.courses.map((course) => ({ course, group, term })),
        ),
      ),
    [curriculum],
  );
  const chosen = entries.filter(({ course }) =>
    recommendedIds.includes(course.id),
  );
  const current = chosen.find(({ course }) => course.id === fromId);
  const alternatives = useMemo(
    () =>
      entries
        .find(({ course }) => course.id === fromId)
        ?.group.courses.filter(
          (course) =>
            !recommendedIds.includes(course.id) &&
            !confirmedIds.includes(course.id),
        ) ?? [],
    [entries, fromId, recommendedIds, confirmedIds],
  );
  const problems = useMemo(
    () =>
      new Map(
        alternatives.map((course) => [
          course.id,
          swapProblem(
            curriculum,
            confirmedIds,
            recommendedIds,
            fromId,
            course.id,
            true,
          ),
        ]),
      ),
    [alternatives, curriculum, confirmedIds, recommendedIds, fromId],
  );
  const eligible = alternatives.filter((course) => !problems.get(course.id));
  const completed = allocatedCourses(curriculum, [
    ...confirmedIds,
    ...recommendedIds,
  ]);
  const priorGaps = scienceSequenceGaps(completed);
  const removalGaps = scienceSequenceGaps(
    completed.filter((course) => course.id !== fromId),
  ).filter(
    (gap) => !priorGaps.some((previous) => previous.advanced === gap.advanced),
  );
  const sequenceKey = JSON.stringify([fromId, removalGaps]);
  const sequenceAcknowledged = acknowledgedSequence === sequenceKey;
  const reduceScience =
    Boolean(current && isScienceCourse(current.course)) &&
    (sciencePreference ?? suggestsReducingScience(detail));
  const explicit = eligible.find((course) => course.id === toId);
  const pairReady = Boolean(
    current &&
    (intent === 'compare'
      ? explicit
      : introAccepted && (intent === 'omit' || explicit)),
  );
  const incomingGaps = explicit
    ? scienceSequenceGaps(
        completed.map((course) => (course.id === fromId ? explicit : course)),
      ).filter(
        (gap) =>
          gap.advanced.replaceAll(/\s/g, '') ===
          explicit.name.replaceAll(/\s/g, ''),
      )
    : [];
  const candidates = counselingCandidates(
    eligible,
    profile,
    toId,
    reduceScience,
    removedCourses,
  );
  const log = (student: string, advisor: string) =>
    setMessages((previous) => [
      ...previous,
      { role: 'student', text: student },
      { role: 'advisor', text: advisor },
    ]);
  const resetComparison = () => {
    explanation.reset();
    setCompared(false);
    setNotice('');
  };

  function compare() {
    if (
      !pairReady ||
      !current ||
      ((reason === 'interest' || reason === 'grades') && !detail.trim())
    )
      return;
    setCompared(true);
    if (candidates.length)
      void explanation.explain({
        department,
        intent,
        reason,
        current: current.course.name,
        concern: [
          detail.trim(),
          reduceScience
            ? '과학 과목 수를 줄이는 것이 목표입니다. 직접 지정한 과학 대안은 과학 과목 수를 줄이지 못한다는 점을 설명해 주세요.'
            : '',
        ]
          .filter(Boolean)
          .join(' '),
        completed: completed.map((course) => ({
          name: course.name,
          fixed: !recommendedIds.includes(course.id),
        })),
        candidates: candidates.map((candidate) => {
          const targetedReason = candidate.id === toId ? reason : 'neutral';
          const gaps = scienceSequenceGaps(
            completed.map((course) =>
              course.id === fromId ? candidate : course,
            ),
          );
          return {
            id: candidate.id,
            name: candidate.name,
            reason: targetedReason,
            detail: candidate.id === toId ? detail.trim() : '',
            confident: candidate.id === toId && confident,
            baseline: compareAdvice(
              current.course,
              candidate,
              profile,
              targetedReason,
              confident,
            ).verdict,
            warnings: [
              ...gaps.map(
                (gap) =>
                  `${gap.advanced} 선택 시 ${gap.basic}도 함께 선택하는 것을 추천합니다.`,
              ),
              ...universityChanges(
                curriculum,
                [...confirmedIds, ...recommendedIds],
                fromId,
                candidate,
                department,
                profile,
              ),
            ],
          };
        }),
      });
    log(
      `${current.course.name}${explicit ? ` / ${explicit.name}` : ''}: ${counselingTemplates.find((item) => item.id === intent)?.label}${detail.trim() ? ` · ${detail.trim()}` : ''}`,
      `${current.course.name}은 ${priority(current.course, profile).label} 기준으로 추천된 2단계 과목이라 고정은 아니에요. ${candidates.length ? '유지하는 안과 교체안을 비교해 주세요. 최종 선택은 학생이 합니다.' : '현재 선택군에는 이수조건을 유지하며 교체할 수 있는 후보가 없어요.'}`,
    );
  }

  return (
    <section className="border-t pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessageCircle className="size-5 text-emerald-700" />
          선택과목 상담
        </h2>
        <Badge variant="outline">과목 비교 상담</Badge>
      </div>
      <div className="mt-4 space-y-3" role="log" aria-live="polite">
        <p className="max-w-2xl rounded-lg bg-muted/50 p-4 text-sm leading-6">
          이것이 전공 기본형 초안이에요. 2단계 과목 중 고민되는 과목이 있나요?
          유지할 때와 바꿀 때의 차이를 함께 살펴보고, 마지막 선택은 직접 해
          주세요.
        </p>
        {messages.map((message, index) => (
          <p
            key={index}
            className={`max-w-2xl whitespace-pre-wrap break-words rounded-lg p-3 text-sm leading-6 ${message.role === 'student' ? 'ml-auto bg-emerald-50 text-emerald-950' : 'bg-muted/50'}`}
          >
            {message.text}
          </p>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {counselingTemplates.map((template) => (
          <Button
            key={template.id}
            variant={
              !freeQuestionMode && intent === template.id
                ? 'secondary'
                : 'outline'
            }
            className="h-auto whitespace-normal text-left"
            aria-pressed={!freeQuestionMode && intent === template.id}
            onClick={() => {
              setIntent(template.id);
              setFromId('');
              setToId('');
              setIntroAccepted(false);
              setReason('neutral');
              setDetail('');
              setSciencePreference(null);
              setConfident(false);
              setAcknowledgedSequence('');
              setFreeQuestionMode(false);
              resetComparison();
            }}
          >
            <MessageCircle className="size-4 shrink-0" />
            {template.label}
          </Button>
        ))}
        <Button
          variant={freeQuestionMode ? 'secondary' : 'outline'}
          className="h-auto whitespace-normal text-left"
          aria-pressed={freeQuestionMode}
          onClick={() => setFreeQuestionMode(true)}
        >
          <MessageCircle className="size-4 shrink-0" />
          다른 질문이 있어요
        </Button>
      </div>
      <div hidden={freeQuestionMode}>
        <CourseQuestionEntry
          curriculum={curriculum}
          confirmedIds={confirmedIds}
          recommendedIds={recommendedIds}
          profile={profile}
          intent={intent}
          fromId={fromId}
          toId={toId}
          accepted={introAccepted}
          alternatives={alternatives}
          problems={problems}
          onPrimary={(id) => {
            setFromId(intent === 'consider' ? '' : id);
            setToId(intent === 'consider' ? id : '');
            setIntroAccepted(false);
            setAcknowledgedSequence('');
            setReason('neutral');
            setDetail('');
            setSciencePreference(null);
            setConfident(false);
            resetComparison();
          }}
          onCounterpart={(id) => {
            if (intent === 'consider') {
              setFromId(id);
              setAcknowledgedSequence('');
            } else setToId(id);
            setConfident(false);
            resetComparison();
          }}
          onContinue={() => setIntroAccepted(true)}
        />
        <div hidden={!pairReady}>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {current && removalGaps.length ? (
              <div
                role="status"
                className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 sm:col-span-2"
              >
                <p className="font-semibold">
                  기초 과목을 빼기 전에 확인해 주세요
                </p>
                <p className="mt-1">
                  {current.course.name}을 듣지 않는다면{' '}
                  {removalGaps.map((gap) => gap.advanced).join(', ')}도 함께
                  재검토하는 것을 추천해요.{' '}
                  <strong>
                    연결된 심화 과목을 먼저 교체하는 것을 추천해요.
                  </strong>
                </p>
                <p className="mt-2 text-xs leading-5 text-amber-800">
                  기초 없이 심화 과목만 이수하면 학습과 과목 선택의 연계성
                  측면에서 불리할 수 있지만, 대학의 일률적인 감점을 뜻하지는
                  않습니다. 비교·추천은 먼저 확인할 수 있어요. 실제로 기초
                  과목만 교체하려면 아래에서 안내를 확인해 주세요.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {removalGaps.map((gap) => {
                    const dependent = chosen.find(
                      ({ course }) =>
                        course.name.replaceAll(/\s/g, '') ===
                        gap.advanced.replaceAll(/\s/g, ''),
                    );
                    return (
                      <Button
                        key={gap.advanced}
                        variant="outline"
                        className="h-auto min-h-9 whitespace-normal text-left"
                        onClick={() => {
                          setAcknowledgedSequence('');
                          resetComparison();
                          if (!dependent) {
                            setNotice(
                              `${gap.advanced}은 학교지정·1단계 확정 과목이라 여기서는 바꿀 수 없어요. 이전 단계에서 확인해 주세요.`,
                            );
                            return;
                          }
                          setFromId(dependent.course.id);
                          setIntent('omit');
                          setIntroAccepted(true);
                          setToId('');
                          setReason('neutral');
                          setDetail('');
                          setSciencePreference(null);
                          setConfident(false);
                          setNotice(
                            `${dependent.course.name}을 비교할 과목으로 선택했어요. 대체 과목을 골라 주세요.`,
                          );
                        }}
                      >
                        <ArrowLeftRight className="size-4 shrink-0" />
                        {gap.advanced} 먼저 교체하기
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    className="h-auto min-h-9 whitespace-normal text-left"
                    aria-pressed={sequenceAcknowledged}
                    onClick={() => {
                      setAcknowledgedSequence(sequenceKey);
                      resetComparison();
                    }}
                  >
                    <Check className="size-4 shrink-0" />
                    {sequenceAcknowledged
                      ? '안내 확인됨 · 현재 과목 교체 가능'
                      : '인지했고, 이 과목만 교체하기'}
                  </Button>
                </div>
              </div>
            ) : null}
            {incomingGaps.length ? (
              <div
                role="status"
                className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 sm:col-span-2"
              >
                <p className="font-semibold">
                  비교 과목의 기초 과목도 함께 고려해 주세요
                </p>
                {incomingGaps.map((gap) => (
                  <p key={gap.advanced} className="mt-1">
                    {gap.advanced}만 듣기보다는 기초 과목인 {gap.basic}도 함께
                    선택하는 것을 추천해요. 현재 1학년 이수·학교지정·선택
                    내역에는 {gap.basic}이 없습니다.
                  </p>
                ))}
              </div>
            ) : null}
            <label className="text-sm font-medium">
              고민 이유
              <select
                className={selectClass}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value as SwapReason);
                  setConfident(false);
                  resetComparison();
                }}
              >
                <option value="neutral">우선 차이를 알고 싶어요</option>
                <option value="preference">대안 과목이 더 좋아요</option>
                <option value="interest">대안이 관심 분야와 더 맞아요</option>
                <option value="grades">성적이나 학업 부담이 걱정돼요</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              {reason === 'grades' ? '성적 예상의 근거' : '관심 분야·고민 내용'}
              <textarea
                rows={3}
                className="mt-1 block min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm font-normal leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                maxLength={500}
                value={detail}
                onChange={(event) => {
                  setDetail(event.target.value);
                  setSciencePreference(null);
                  resetComparison();
                }}
                placeholder={
                  reason === 'grades'
                    ? '어느 과목이 부담스러운가요? 관련 과목 성적, 평가 방식, 예상 차이와 그 근거를 알려 주세요.'
                    : '예: 에너지 전환의 사회적 영향에 관심이 있어요. 아직 잘 모르겠다면 비워 두어도 돼요.'
                }
              />
            </label>
          </div>
          {current && isScienceCourse(current.course) && (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={reduceScience}
                onChange={(event) => {
                  setSciencePreference(event.target.checked);
                  resetComparison();
                }}
              />
              과학 과목 수를 줄이고 싶어요 · 자동 대안은 비과학 과목에서 추천
            </label>
          )}
          {reduceScience && explicit && isScienceCourse(explicit) && (
            <p className="mt-2 text-sm text-amber-800">
              직접 고른 {explicit.name}도 비교하지만, 이 과목으로 바꾸면 과학
              과목 수는 줄지 않아요.
            </p>
          )}
          {reason === 'grades' && explicit && (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={confident}
                onChange={(event) => {
                  setConfident(event.target.checked);
                  resetComparison();
                }}
              />
              근거를 바탕으로 {explicit.name}의 성적이 {current?.course.name}
              보다 1등급 이상 높을 것으로 예상해요.
            </label>
          )}
          <div className="mt-4 flex gap-2">
            <Button
              disabled={
                explanation.loading ||
                !pairReady ||
                !current ||
                ((reason === 'interest' || reason === 'grades') &&
                  !detail.trim())
              }
              onClick={compare}
            >
              <ArrowLeftRight />
              {explanation.loading ? '설명 작성 중…' : '비교하기'}
            </Button>
            <Button
              variant="outline"
              disabled={!canUndo}
              onClick={() => {
                onUndo();
                setFromId('');
                setToId('');
                resetComparison();
                setNotice('직전 변경을 되돌렸어요.');
              }}
            >
              <Undo2 />
              되돌리기
            </Button>
          </div>
          {compared && explanation.loading && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              전공과 과목 내용을 바탕으로 비교 설명을 작성하고 있어요.
            </p>
          )}
          {compared && explanation.error && (
            <p role="alert" className="mt-4 text-sm text-amber-800">
              {explanation.error} 비교하기를 다시 눌러 재시도할 수 있어요.
            </p>
          )}
          {compared && current && (
            <div className="mt-5 grid items-start gap-4 md:grid-cols-3">
              {removalGaps.length > 0 && (
                <p
                  role="alert"
                  className="rounded-md border border-red-300 bg-red-50 p-4 text-sm font-medium leading-6 text-red-700 md:col-span-3"
                >
                  {current.course.name}을 빼려면 연결된{' '}
                  {removalGaps.map((gap) => gap.advanced).join(', ')}도 함께
                  재검토해야 해요. 지금은 비교만 보여드리며 실제 선택은 바뀌지
                  않았어요. 실제 교체를 원한다면 위의 ‘먼저 교체하기’로 심화
                  과목부터 조정해 주세요. 기초 과목만 교체하려면 위의 안내를
                  확인하고 명시적으로 동의해야 합니다.
                </p>
              )}
              {reduceScience && (
                <p className="text-sm text-muted-foreground md:col-span-3">
                  {candidates.some((course) => !isScienceCourse(course))
                    ? '과학 과목 수를 줄이고 싶다는 의도를 반영해, 자동 대안을 비과학 과목 안에서 전공 우선순위로 골랐어요.'
                    : '현재 선택군·학점·이수조건을 유지하면서 과학 과목 수를 줄일 수 있는 비과학 대안이 없어요.'}
                </p>
              )}
              <article className="min-w-0 rounded-lg border p-4">
                <Badge variant="outline">현재 선택</Badge>
                <h3 className="mt-3 font-semibold">{current.course.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {priority(current.course, profile).label} ·{' '}
                  {current.course.credit}학점
                </p>
                <p className="mt-3 text-sm leading-6">
                  기존 전공 기본형의 선택을 유지합니다.
                </p>
                {explanation.loading && <ComparisonExplanationLoading />}
                {explanation.result?.comparisons
                  .filter((item) => item.id === candidates[0]?.id)
                  .map((item) => (
                    <ComparisonExplanation
                      key={item.id}
                      explanation={item}
                      current
                    />
                  ))}
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    log(
                      `${current.course.name} 유지`,
                      '현재 선택을 유지했어요. 다른 과목도 비교해 볼 수 있어요.',
                    );
                    resetComparison();
                  }}
                >
                  <Check />
                  현재 과목 유지
                </Button>
              </article>
              {candidates.map((candidate) => {
                const targetedReason =
                  candidate.id === toId ? reason : 'neutral';
                const advice = compareAdvice(
                  current.course,
                  candidate,
                  profile,
                  targetedReason,
                  confident,
                );
                const changes = universityChanges(
                  curriculum,
                  [...confirmedIds, ...recommendedIds],
                  fromId,
                  candidate,
                  department,
                  profile,
                );
                const candidateGaps = scienceSequenceGaps(
                  completed.map((course) =>
                    course.id === fromId ? candidate : course,
                  ),
                ).filter(
                  (gap) =>
                    gap.advanced.replaceAll(/\s/g, '') ===
                    candidate.name.replaceAll(/\s/g, ''),
                );
                return (
                  <article
                    key={candidate.id}
                    className="min-w-0 rounded-lg border p-4"
                  >
                    <Badge variant="outline">{advice.verdict}</Badge>
                    {candidateGaps.map((gap) => (
                      <p
                        key={gap.advanced}
                        className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs leading-5 text-amber-900"
                      >
                        {gap.advanced}만 듣기보다는 {gap.basic}도 함께 선택하는
                        것을 추천해요.
                      </p>
                    ))}
                    <ImportedCourseInfo course={candidate}>
                      <h3
                        tabIndex={0}
                        className="mt-3 w-fit cursor-help font-semibold"
                      >
                        {candidate.name}
                      </h3>
                    </ImportedCourseInfo>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {priority(candidate, profile).label} · {candidate.credit}
                      학점
                    </p>
                    <p className="mt-3 text-sm leading-6">
                      {advice.explanation}
                    </p>
                    {explanation.loading && <ComparisonExplanationLoading />}
                    {explanation.result?.comparisons
                      .filter((item) => item.id === candidate.id)
                      .map((item) => (
                        <ComparisonExplanation
                          key={item.id}
                          explanation={item}
                        />
                      ))}
                    {targetedReason === 'grades' && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        성적 우위는 학생의 예상이며 실제 결과를 보장하지 않아요.
                      </p>
                    )}
                    {reason !== 'neutral' && candidate.id !== toId && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        이 후보는 기본 우선순위로 제안했어요. 비교 대상으로
                        지정하면 본인의 이유를 반영할 수 있어요.
                      </p>
                    )}
                    <p className="mt-3 text-xs text-emerald-800">
                      선택군·학점·등록된 이수조건 유지
                    </p>
                    {changes.map((change) => (
                      <p
                        key={change}
                        className="mt-2 break-words text-xs text-amber-800"
                      >
                        {change}
                      </p>
                    ))}
                    {!changes.length && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        등록된 대학별 권장 충족 현황 변화 없음
                      </p>
                    )}
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => {
                        const newGaps = scienceSequenceGaps(
                          completed.map((course) =>
                            course.id === fromId ? candidate : course,
                          ),
                        ).filter(
                          (gap) =>
                            !priorGaps.some(
                              (previous) => previous.advanced === gap.advanced,
                            ),
                        );
                        if (
                          newGaps.length &&
                          !sequenceAcknowledged &&
                          removalGaps.length > 0
                        ) {
                          resetComparison();
                          setNotice(
                            '현재 선택을 유지했어요. 위의 안내에서 연결된 심화 과목을 먼저 교체하거나, “인지했고, 이 과목만 교체하기”를 눌러 확인한 뒤 다시 선택해 주세요.',
                          );
                          return;
                        }
                        const problem = onSwap(
                          fromId,
                          candidate.id,
                          newGaps.length > 0,
                        );
                        if (problem) {
                          setNotice(problem);
                          return;
                        }
                        log(
                          `${current.course.name} 대신 ${candidate.name} 선택`,
                          '선택을 초안에 반영했어요. 학교지정·1단계 확정 과목은 그대로 유지됩니다.',
                        );
                        setFromId('');
                        setToId('');
                        resetComparison();
                        setNotice('전체 선택 초안과 미선택 목록에 반영했어요.');
                      }}
                    >
                      <Check />이 과목 선택
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
        {notice && (
          <p role="status" className="mt-3 text-sm">
            {notice}
          </p>
        )}
      </div>
      <CourseSelectionFreeQuestions
        hidden={!freeQuestionMode}
        curriculum={curriculum}
        profile={profile}
        confirmedIds={confirmedIds}
        recommendedIds={recommendedIds}
      />
    </section>
  );
}

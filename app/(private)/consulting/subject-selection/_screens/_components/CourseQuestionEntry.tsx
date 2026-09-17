import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PriorityProfile } from '@/features/subject-selection/recommendations';

import {
  type CounselingIntent,
  courseQuestionSummary,
  questionOptions,
} from '../../_lib/counseling-question';
import type {
  ConfirmedCurriculum,
  CurriculumCourse,
} from '../../_lib/curriculum';

const selectClass =
  'mt-1 w-full min-w-0 rounded-md border bg-background p-2 text-sm';

export function CourseQuestionEntry({
  curriculum,
  confirmedIds,
  recommendedIds,
  profile,
  intent,
  fromId,
  toId,
  accepted,
  alternatives,
  problems,
  onPrimary,
  onCounterpart,
  onContinue,
}: {
  curriculum: ConfirmedCurriculum;
  confirmedIds: string[];
  recommendedIds: string[];
  profile: PriorityProfile | null;
  intent: CounselingIntent;
  fromId: string;
  toId: string;
  accepted: boolean;
  alternatives: CurriculumCourse[];
  problems: Map<string, string | null>;
  onPrimary: (id: string) => void;
  onCounterpart: (id: string) => void;
  onContinue: () => void;
}) {
  const adding = intent === 'consider';
  const { chosen, unselected, replacements } = questionOptions(
    curriculum,
    confirmedIds,
    recommendedIds,
    toId,
  );
  const options = adding ? unselected : chosen;
  const primaryId = adding ? toId : fromId;
  const primary = options.find((item) => item.course.id === primaryId);
  const summary = primary
    ? courseQuestionSummary(primary.course, profile)
    : null;
  return (
    <div className="mt-5 space-y-4">
      <label className="block text-sm font-medium">
        {adding
          ? '들어볼지 고민되는 미선택 과목'
          : intent === 'omit'
            ? '듣지 않을지 고민되는 선택 과목'
            : '현재 선택된 과목 중, 고민되는 과목'}
        <select
          className={selectClass}
          value={primaryId}
          onChange={(event) => onPrimary(event.target.value)}
        >
          <option value="">과목 선택</option>
          {options.map(({ course, term, group }) => (
            <option key={course.id} value={course.id}>
              {term.label} · {group.name} · {course.name}
            </option>
          ))}
        </select>
      </label>
      {!options.length && (
        <p className="text-sm text-muted-foreground">
          현재 상담에서 검토할 수 있는 {adding ? '미선택' : '2단계 선택'} 과목이
          없어요.
        </p>
      )}
      {intent !== 'compare' && summary && (
        <div
          role="status"
          className="border-l-2 border-emerald-500 bg-emerald-50/50 p-4 text-sm leading-6"
        >
          <p className="font-semibold">
            {primary?.course.name} · 메아 기준 안내
          </p>
          <p className="mt-2">{summary.recommendation}</p>
          {summary.content && (
            <p className="mt-2 text-muted-foreground">{summary.content}</p>
          )}
          <p className="mt-2">
            {adding
              ? '이 과목을 듣는다면, 현재 선택한 과목 중 무엇을 대신할지 고민하고 있나요?'
              : '이 과목을 듣지 않는다면, 대신 듣고 싶은 과목이 있나요?'}
          </p>
          {!accepted && (
            <Button variant="outline" className="mt-3" onClick={onContinue}>
              <ArrowRight />
              {adding ? '대신 뺄 과목 고르기' : '대체 과목 살펴보기'}
            </Button>
          )}
        </div>
      )}
      {primary && (intent === 'compare' || accepted) && (
        <label className="block text-sm font-medium">
          {adding ? '대신 뺄 현재 선택 과목' : '비교할 미선택 과목'}
          <select
            className={selectClass}
            value={adding ? fromId : toId}
            onChange={(event) => onCounterpart(event.target.value)}
          >
            <option value="">
              {adding
                ? '현재 선택 과목을 골라 주세요'
                : intent === 'compare'
                  ? '비교할 과목을 골라 주세요'
                  : '아직 없어요 · 대안을 추천받을게요'}
            </option>
            {adding
              ? replacements.map(({ course, term }) => (
                  <option key={course.id} value={course.id}>
                    {term.label} · {course.name}
                  </option>
                ))
              : alternatives.map((course) => (
                  <option
                    key={course.id}
                    value={course.id}
                    disabled={Boolean(problems.get(course.id))}
                  >
                    {course.name}
                    {problems.get(course.id)
                      ? ` · ${problems.get(course.id)}`
                      : ''}
                  </option>
                ))}
          </select>
          {adding && !replacements.length && (
            <p className="mt-2 font-normal text-amber-800">
              같은 학기·선택군에서 학점과 이수조건을 유지하며 교체할 수 있는
              2단계 과목이 없어요. 학교지정·1단계 확정 과목은 여기서 변경하지
              않아요.
            </p>
          )}
        </label>
      )}
    </div>
  );
}

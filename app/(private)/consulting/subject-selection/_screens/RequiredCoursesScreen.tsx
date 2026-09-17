'use client';
import { Building2, CheckCircle2, LockKeyhole } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import { scienceSequenceMessage } from '@/features/subject-selection/science-sequence';
import { cn } from '@/lib/utils';

import type { CourseSelectionSessionState } from '../_hooks/useCourseSelectionSession';
import { getCourseTags, sameCourse } from '../_lib/course-selection-utils';
import type { ConfirmedCurriculum } from '../_lib/curriculum';
import type {
  CareerGuideStep,
  RequirementGuideStep,
} from '../_lib/session-types';

import {
  CareerGuide,
  RequirementGuide,
} from './_components/CoreSelectionGuides';
import { CoreStageProgress } from './_components/CoreStageProgress';
import { ImportedCourseInfo } from './_components/CourseSelectionCourseInfo';
import { CourseSelectionSources } from './_components/CourseSelectionSources';
import { tutorialHighlight } from './_components/CourseSelectionTutorial';
import { UniversityGuidance } from './_components/UniversityGuidance';
import { UniversityRecommendationReview } from './_components/UniversityRecommendationReview';

export function RequiredCoursesScreen({
  curriculum,
  session,
}: {
  curriculum: ConfirmedCurriculum;
  session: CourseSelectionSessionState;
}) {
  const {
    input,
    setInput,
    department,
    stage,
    selected,
    locked,
    history,
    notice,
    universityOpen,
    setUniversityOpen,
    guideStep,
    stageIntro,
    setStageIntro,
    requirementGuideStep,
    setRequirementGuideStep,
    profile,
    universities,
    guideSteps,
    occurrences,
    completed,
    coreNames,
    coreChoices,
    missingCoreChoices,
    scienceGaps,
    missingCore,
    unavailableCore,
    requirements,
    unmet,
    activeRequirement,
    candidates,
    remaining,
    candidateCredits,
    uniformCredit,
    neededCount,
    requirementGuideSteps,
    finishStageIntro,
    moveGuide,
    infoCourse,
    applyDepartment,
    disabledReason,
    toggle,
    advance,
    back,
    stageIndex,
    departments,
    confirmRequired,
  } = session;
  function guideBubble(step: CareerGuideStep) {
    return stage.kind === 'career' && guideStep === step ? (
      <CareerGuide
        step={step}
        steps={guideSteps}
        department={department}
        onChange={moveGuide}
      />
    ) : null;
  }
  function requirementBubble(step: RequirementGuideStep) {
    return stage.kind === 'requirement' &&
      requirementGuideStep === step &&
      activeRequirement ? (
      <RequirementGuide
        step={step}
        steps={requirementGuideSteps}
        activeRequirement={activeRequirement}
        remaining={remaining}
        onChange={setRequirementGuideStep}
      />
    ) : null;
  }
  return (
    <TooltipProvider>
      <section className="space-y-6">
        <header className="space-y-4 border-b pb-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="size-4" />
            {curriculum.schoolName}
          </p>
          <div>
            <Badge variant="outline">1단계</Badge>
            <h1 className="mt-2 text-xl font-semibold">필수 과목 확정</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              과목 선택은 희망 전공에서부터 시작해야 합니다. 1지망 전공을
              입력해주세요.
            </p>
          </div>
          <form
            className="max-w-lg space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              applyDepartment();
            }}
          >
            <label className="text-sm font-medium" htmlFor="desired-department">
              희망 학과
            </label>
            <div className="flex gap-2">
              <Input
                id="desired-department"
                list="department-suggestions"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="예: 컴퓨터공학과"
                maxLength={100}
              />
              <Button type="submit" disabled={!input.trim()}>
                {department ? '학과 변경 · 다시 시작' : '시작'}
              </Button>
            </div>
            <datalist id="department-suggestions">
              {departments.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {department ? (
              <p className="text-xs text-muted-foreground">
                적용 중: {department} · 학과를 다시 적용하면 기존 확정이
                초기화됩니다.
              </p>
            ) : null}
          </form>
        </header>
        {department ? (
          <>
            <CoreStageProgress
              stageIndex={stageIndex}
              stageIntro={stageIntro}
              onContinue={finishStageIntro}
              onDismiss={() => setStageIntro(null)}
            />
            <section
              className="rounded-lg border p-4"
              aria-label="확정된 선택 과목"
            >
              <h2 className="text-sm font-medium">
                <LockKeyhole className="mr-2 inline size-4" />
                확정된 선택 과목 {locked.size}개
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {curriculum.terms.map((term) => {
                  const confirmedCourses = occurrences.filter(
                    (item) =>
                      item.term.id === term.id && locked.has(item.course.id),
                  );
                  return (
                    <div key={term.id}>
                      <p className="text-sm font-semibold">{term.label}</p>
                      {confirmedCourses.length ? (
                        confirmedCourses.map((item) => (
                          <ImportedCourseInfo
                            key={item.course.id}
                            course={item.course}
                          >
                            <p
                              tabIndex={0}
                              className="mt-2 cursor-help rounded text-sm focus-visible:outline-2 focus-visible:outline-emerald-600"
                            >
                              ✓ {item.course.name}
                            </p>
                          </ImportedCourseInfo>
                        ))
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          아직 확정한 과목이 없습니다.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            {stage.kind !== 'core' && universities.length > 0 ? (
              <details
                id="career-guide-university"
                className={cn(
                  'rounded-lg border p-4',
                  stage.kind === 'career' &&
                    guideStep === 'university' &&
                    tutorialHighlight,
                )}
                open={universityOpen}
                onToggle={(event) =>
                  setUniversityOpen(event.currentTarget.open)
                }
              >
                <summary className="cursor-pointer text-sm font-medium">
                  대학별 권장과목 충족여부 확인
                </summary>
                <div className="mt-4 space-y-4">
                  {guideBubble('university')}
                  <div className="rounded-lg bg-muted/40 p-4 text-sm leading-6 space-y-2">
                    <p>
                      아래는 희망 학과와 관련된 대학별 권장과목과 현재 선택의
                      충족 여부입니다. 모든 대학의 권장 조건을 무조건 만족시켜야
                      하는 것은 아니지만, 학교의 개설 상황이나 이수 여건에
                      어려움이 없다면 충족하는 것을 추천합니다.
                    </p>
                    <p>
                      경희대는 ‘핵심과목’과 ‘권장과목’을 구분해 안내합니다. 두
                      기준을 각각 확인하며 선택해 주세요. 대학별 지원 자격과
                      필수 이수 조건은 별도로 확인해야 합니다.
                    </p>
                  </div>
                  <UniversityGuidance
                    expandUnmet={stage.kind === 'review'}
                    department={department}
                    matches={universities}
                    completedCourses={completed}
                    occurrences={occurrences}
                  />
                </div>
              </details>
            ) : null}
            <section className="rounded-xl border p-5 space-y-4">
              {scienceGaps.length ? (
                <p
                  role="status"
                  className="border-l-2 border-amber-400 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
                >
                  {scienceSequenceMessage(scienceGaps)} 기초 과목을 먼저 듣는
                  것을 추천해요. 1학년·학교지정 과목도 함께 확인한 결과이며,
                  실제 개설 학기와 이수 순서는 학교에 확인해 주세요.
                </p>
              ) : null}
              {stage.kind === 'review' ? (
                <UniversityRecommendationReview
                  matches={universities}
                  completed={completed}
                  occurrences={occurrences}
                  selected={selected}
                  locked={locked}
                  disabledReason={disabledReason}
                  onToggle={toggle}
                />
              ) : null}
              <div
                id="career-guide-purpose"
                className={cn(
                  stage.kind === 'career' &&
                    guideStep === 'purpose' &&
                    tutorialHighlight,
                )}
                aria-live="polite"
              >
                <h2 className="text-lg font-semibold">
                  {stage.kind === 'core'
                    ? '먼저 전공의 기초가 되는 코어를 확정하세요'
                    : stage.kind === 'career'
                      ? '이 진로를 위해 반드시 들을 과목을 골라주세요'
                      : stage.kind === 'requirement'
                        ? `${activeRequirement?.label} 이수 조건을 채워주세요`
                        : '필수 과목을 모두 확인했어요'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {stage.kind === 'core'
                    ? '코어는 이 서비스가 전공 학습의 기초로 분류한 과목입니다. 개설 학기가 하나인 과목은 미리 선택했습니다. 여러 학기에 열리는 과목은 들을 학기를 골라 확정하세요. 대학의 지원 자격과는 구분됩니다.'
                    : stage.kind === 'career'
                      ? '모든 자리를 채울 필요는 없어요. 고민 중인 과목과 남은 선택 자리는 다음 단계에서 함께 결정합니다.'
                      : stage.kind === 'requirement'
                        ? '학교 지정 과목과 앞에서 확정한 과목을 반영했습니다. 아래에는 지금 부족한 조건을 채울 수 있는 과목만 표시합니다. 선택을 확정하면 다음 조건으로 넘어갑니다.'
                        : '코어와 진로 과목, 현재 확인하는 영역별·학교별 필수 조건을 반영했습니다. 확정한 과목을 유지한 채 2단계에서 남은 선택군을 채웁니다.'}
                </p>
                {guideBubble('purpose')}
              </div>
              {stage.kind === 'career' ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => moveGuide('purpose')}
                  >
                    선택 안내 다시 보기
                  </Button>
                  {profile?.subCore.length ? (
                    <div
                      id="career-guide-subcore"
                      className={cn(
                        'rounded-lg border p-4',
                        guideStep === 'subcore' && tutorialHighlight,
                      )}
                    >
                      <p className="text-sm font-semibold text-violet-800">
                        MEA 서브코어
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.subCore.map((name) => (
                          <ImportedCourseInfo
                            key={name}
                            course={infoCourse(name)}
                          >
                            <Badge
                              tabIndex={0}
                              variant="outline"
                              className="cursor-help border-violet-200 bg-violet-50 text-violet-800"
                            >
                              {name}
                            </Badge>
                          </ImportedCourseInfo>
                        ))}
                      </div>
                      {guideBubble('subcore')}
                    </div>
                  ) : null}
                </>
              ) : null}
              {stage.kind === 'core' ? (
                <div className="space-y-4">
                  <p className="text-sm font-semibold">지정 Core</p>
                  <div className="flex flex-wrap gap-2">
                    {coreNames.map((name) => (
                      <ImportedCourseInfo key={name} course={infoCourse(name)}>
                        <Badge
                          tabIndex={0}
                          className="cursor-help"
                          variant={
                            missingCore.includes(name) ? 'outline' : 'secondary'
                          }
                        >
                          {missingCore.includes(name) ? '' : '✓ '}
                          {name}
                        </Badge>
                      </ImportedCourseInfo>
                    ))}
                    {!profile ? (
                      <p className="text-sm text-amber-800">
                        이 학과의 코어 기준이 아직 없습니다. 대학별 안내를
                        확인하고 진로 과목 선택으로 진행하세요.
                      </p>
                    ) : null}
                  </div>
                  {coreChoices.map((rule) => (
                    <section
                      key={rule.id}
                      className={cn(
                        'border-l-2 p-3 text-sm',
                        rule.satisfied
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-amber-400 bg-amber-50',
                      )}
                    >
                      <h3 className="font-semibold">
                        {rule.label} · {rule.count}/{rule.choose}과목{' '}
                        {rule.satisfied ? '충족' : '선택 필요'}
                      </h3>
                      <p className="mt-1">
                        {rule.courses.join(' · ')} 중 {rule.choose}과목 이상
                      </p>
                      {rule.include ? (
                        <p className="mt-1">
                          {rule.include.label} · 현재 {rule.included}/
                          {rule.include.choose}과목
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs">
                        아래 학기별 선택군에서 골라 주세요. 학교지정·1학년 이수
                        과목도 포함합니다. 더 듣고 싶은 과목은 다음 진로 과목
                        단계에서 선택해도 됩니다.
                      </p>
                      {rule.courses
                        .filter(
                          (name) =>
                            !completed.some((course) =>
                              sameCourse(course.name, name),
                            ) &&
                            !occurrences.some((item) =>
                              sameCourse(item.course.name, name),
                            ),
                        )
                        .map((name) => (
                          <p key={name} className="mt-1 text-xs text-amber-800">
                            {name}: 편제 내 미개설
                          </p>
                        ))}
                      {!rule.satisfied &&
                      !candidates.some(
                        (item) =>
                          rule.courses.some((name) =>
                            sameCourse(name, item.course.name),
                          ) &&
                          !selected.has(item.course.id) &&
                          !disabledReason(item),
                      ) ? (
                        <p className="mt-2 text-xs text-red-700">
                          현재 선택군에서 추가할 수 있는 후보가 없습니다.
                          편제표와 선택군 정원을 확인해 주세요.
                        </p>
                      ) : null}
                    </section>
                  ))}
                </div>
              ) : null}
              {unavailableCore.length && stage.kind === 'core' ? (
                <p role="alert" className="text-sm text-amber-800">
                  편제표에서 찾지 못한 코어: {unavailableCore.join(', ')}. 이수
                  내역이나 편제표를 확인해 주세요. 현재 자료로는 코어를 모두
                  확정할 수 없습니다.
                </p>
              ) : null}
              {activeRequirement ? (
                <div
                  id="requirement-guide-credits"
                  className={cn(
                    'rounded-lg bg-muted/40 p-4',
                    requirementGuideStep === 'credits' && tutorialHighlight,
                  )}
                  aria-live="polite"
                >
                  <p className="font-semibold">
                    {activeRequirement.minimum}
                    {activeRequirement.unit} 중 {activeRequirement.current}
                    {activeRequirement.unit} 반영 ·{' '}
                    {remaining > 0
                      ? `${remaining}${activeRequirement.unit} 부족`
                      : '충족'}
                  </p>
                  <p className="mt-1 text-sm">
                    {remaining === 0
                      ? '이 선택을 확정하고 다음으로 넘어가세요.'
                      : neededCount !== null
                        ? `아래에서 ${neededCount}과목을 더 선택하세요${uniformCredit && activeRequirement.unit === '학점' ? ` (과목당 ${uniformCredit}학점)` : ''}.`
                        : `과목별 학점을 확인하며 ${remaining}학점 이상을 더 선택하세요.`}
                  </p>
                  {candidateCredits.some((credit) => credit === null) ? (
                    <p className="mt-2 text-xs text-amber-800">
                      학점이 확인되지 않은 과목은 학점 충족 계산에 포함되지
                      않습니다.
                    </p>
                  ) : null}
                  {requirementBubble('credits')}
                </div>
              ) : null}
              {stage.kind === 'career' ? (
                <div
                  id="career-guide-capacity"
                  className={cn(
                    'rounded-lg border p-4',
                    guideStep === 'capacity' && tutorialHighlight,
                  )}
                >
                  <p className="text-sm font-medium">
                    선택 현황에는 이전 단계에서 확정한 코어가 포함됩니다.
                  </p>
                  <p className="text-sm font-medium">
                    남은 자리를 지금 모두 채울 필요는 없어요. 아직 고민이
                    많다면, 아무것도 고르지 않아도 괜찮아요.
                  </p>
                  {guideBubble('capacity')}
                </div>
              ) : null}
              {stage.kind === 'requirement' ? (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRequirementGuideStep('credits')}
                  >
                    필수 이수 안내 다시 보기
                  </Button>
                </div>
              ) : null}
              {stage.kind !== 'review' ? (
                <div
                  id="requirement-guide-courses"
                  className={cn(
                    'grid gap-4 md:grid-cols-2 xl:grid-cols-4',
                    stage.kind === 'requirement' &&
                      requirementGuideStep === 'courses' &&
                      tutorialHighlight,
                  )}
                >
                  {stage.kind === 'requirement' &&
                  (requirementGuideStep === 'courses' ||
                    requirementGuideStep === 'late-term') ? (
                    <div className="col-span-full">
                      {requirementBubble(requirementGuideStep)}
                    </div>
                  ) : null}
                  {curriculum.terms.map((term) => {
                    const items = candidates.filter(
                      (item) => item.term.id === term.id,
                    );
                    const selectedCount = term.selectionGroups.reduce(
                      (sum, group) =>
                        sum +
                        group.courses.filter((course) =>
                          selected.has(course.id),
                        ).length,
                      0,
                    );
                    const targetCount = term.selectionGroups.reduce(
                      (sum, group) => sum + group.choose,
                      0,
                    );
                    return (
                      <section
                        key={term.id}
                        id={
                          term.id === 'grade-3-semester-2'
                            ? 'requirement-guide-late-term'
                            : undefined
                        }
                        className={cn(
                          'min-w-0 rounded-lg border p-3',
                          stage.kind === 'requirement' &&
                            requirementGuideStep === 'late-term' &&
                            term.id === 'grade-3-semester-2' &&
                            tutorialHighlight,
                        )}
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="font-semibold">{term.label}</h3>
                          <span
                            className={cn(
                              'shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground',
                              stage.kind === 'career' &&
                                guideStep === 'capacity' &&
                                'bg-emerald-100 font-bold text-emerald-950 ring-2 ring-emerald-500 ring-offset-2',
                            )}
                            aria-live="polite"
                          >
                            {selectedCount}/{targetCount} 선택
                          </span>
                        </div>
                        {items.length ? (
                          <div className="space-y-4">
                            {term.selectionGroups.map((group) => {
                              const groupItems = items.filter(
                                (item) => item.group?.id === group.id,
                              );
                              const groupSelected = group.courses.filter(
                                (course) => selected.has(course.id),
                              ).length;
                              return (
                                <section
                                  key={group.id}
                                  className="rounded-lg border bg-muted/20 p-2.5"
                                >
                                  <div className="mb-3 flex items-start justify-between gap-2">
                                    <h4 className="text-sm font-semibold">
                                      {group.name}
                                    </h4>
                                    <span
                                      className={cn(
                                        'shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground',
                                        stage.kind === 'career' &&
                                          guideStep === 'capacity' &&
                                          'bg-emerald-100 font-bold text-emerald-950 ring-2 ring-emerald-500 ring-offset-2',
                                      )}
                                    >
                                      {groupSelected}/{group.choose} 선택
                                    </span>
                                  </div>
                                  {groupItems.length ? (
                                    <div className="space-y-2">
                                      {groupItems.map((item) => {
                                        const reason = disabledReason(item);
                                        const chosen = selected.has(
                                          item.course.id,
                                        );
                                        const tags = getCourseTags(
                                          item.course,
                                          profile,
                                          universities,
                                          [],
                                          completed,
                                        );
                                        return (
                                          <ImportedCourseInfo
                                            key={item.course.id}
                                            course={item.course}
                                          >
                                            <div
                                              tabIndex={reason ? 0 : undefined}
                                              className="rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-600"
                                            >
                                              <button
                                                type="button"
                                                aria-pressed={chosen}
                                                disabled={Boolean(reason)}
                                                onClick={() => toggle(item)}
                                                className={cn(
                                                  'w-full rounded-lg border p-3 text-left transition-colors enabled:hover:border-emerald-500 disabled:opacity-50',
                                                  chosen &&
                                                    'border-emerald-600 bg-emerald-50',
                                                )}
                                              >
                                                <span className="flex justify-between gap-2 text-sm font-medium">
                                                  <span>
                                                    {chosen ? '✓ ' : ''}
                                                    {item.course.name}
                                                  </span>
                                                  <span className="shrink-0 text-xs">
                                                    {item.course.credit === null
                                                      ? '학점 미확인'
                                                      : `${item.course.credit}학점`}
                                                  </span>
                                                </span>
                                                {stage.kind === 'career' ? (
                                                  <span className="mt-2 flex flex-wrap gap-1">
                                                    {tags.map((tag) => (
                                                      <Badge
                                                        key={tag.id}
                                                        title={tag.description}
                                                        variant="outline"
                                                        className={cn(
                                                          'text-[10px]',
                                                          tag.kind ===
                                                            'sub-core' &&
                                                            'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200',
                                                          tag.kind ===
                                                            'internal' &&
                                                            'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
                                                          tag.kind ===
                                                            'university' &&
                                                            'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
                                                          tag.kind ===
                                                            'university-core' &&
                                                            'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
                                                        )}
                                                      >
                                                        {tag.label}
                                                      </Badge>
                                                    ))}
                                                  </span>
                                                ) : null}
                                                {reason ? (
                                                  <span className="mt-1 block text-xs">
                                                    {reason}
                                                  </span>
                                                ) : null}
                                              </button>
                                            </div>
                                          </ImportedCourseInfo>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      {groupSelected >= group.choose
                                        ? '선택을 모두 채웠습니다.'
                                        : '이 단계에서 선택할 과목이 없습니다.'}
                                    </p>
                                  )}
                                </section>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            이 단계에서 선택할 과목이 없습니다.
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {requirements.map((item) => (
                    <p
                      key={item.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <CheckCircle2 className="size-4 text-emerald-700" />
                      {item.label}: {item.current}/{item.minimum}
                      {item.unit} 충족
                    </p>
                  ))}
                  <p className="pt-2 text-xs text-muted-foreground">
                    이미 충족한 조건은 자동으로 건너뛰었습니다. 전체 교과 학점과
                    남은 선택군은 2단계에서 채웁니다.
                  </p>
                </div>
              )}
              {stage.kind === 'requirement' &&
              remaining > 0 &&
              !candidates.some(
                (item) =>
                  !selected.has(item.course.id) && !disabledReason(item),
              ) ? (
                <p role="alert" className="text-sm text-amber-800">
                  현재 선택 가능한 과목만으로 이 조건을 채울 수 없습니다. 이전
                  단계의 확정 과목을 조정하거나 편제표의 과목·학점을 확인해
                  주세요.
                </p>
              ) : null}
              {notice ? (
                <p role="status" className="text-sm text-amber-800">
                  {notice}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Button
                  variant="outline"
                  disabled={!history.length}
                  onClick={back}
                >
                  이전 단계 수정
                </Button>
                {stage.kind === 'review' ? (
                  <Button
                    className="h-auto min-h-9 whitespace-normal text-left"
                    disabled={Boolean(
                      missingCore.length || missingCoreChoices || unmet.length,
                    )}
                    onClick={confirmRequired}
                  >
                    {universities.length
                      ? '현재 선택으로 확정 · 나머지는 다음 단계에서'
                      : '필수 과목 확정 · 2단계로'}
                  </Button>
                ) : (
                  <Button
                    disabled={
                      stage.kind === 'core'
                        ? missingCore.length > 0 || missingCoreChoices
                        : stage.kind === 'requirement'
                          ? remaining > 0
                          : false
                    }
                    onClick={advance}
                  >
                    {stage.kind === 'core'
                      ? '코어 확정'
                      : stage.kind === 'career'
                        ? '진로 과목 확정 · 필수 이수 확인'
                        : '이 선택 확정 · 다음'}
                  </Button>
                )}
              </div>
              {history.length ? (
                <p className="text-xs text-muted-foreground">
                  이전 단계로 돌아가면 그 이후 선택은 되돌리고 다시 확정합니다.
                </p>
              ) : null}
            </section>
            <CourseSelectionSources linkedRules={curriculum.linkedRules} />
          </>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            희망 학과를 입력하면 코어 과목부터 안내합니다.
          </p>
        )}
      </section>
    </TooltipProvider>
  );
}

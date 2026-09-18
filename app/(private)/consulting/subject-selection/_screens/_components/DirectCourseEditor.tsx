import { ArrowLeftRight, Check, LockKeyhole, Plus, Square, Undo2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { sameCourse } from '../../_lib/course-selection-utils';
import { allocatedCourses, swapProblem } from '../../_lib/course-swap';
import type { ConfirmedCurriculum, CurriculumCourse } from '../../_lib/curriculum';

export function DirectCourseEditor({ curriculum, confirmedIds, recommendedIds, onSwap, onUndo, canUndo }: {
  curriculum: ConfirmedCurriculum;
  confirmedIds: string[];
  recommendedIds: string[];
  onSwap: (fromId: string, toId: string, acknowledgeScience?: boolean) => string | null;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [notice, setNotice] = useState('');
  const [termId, setTermId] = useState(curriculum.terms[0]?.id);
  const tabId = useId();
  const activeTerm = curriculum.terms.find((term) => term.id === termId) ?? curriculum.terms[0];
  const warningRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [notice]);
  const entries = curriculum.terms.flatMap((term) => term.selectionGroups.flatMap((group) =>
    group.courses.filter((course) => recommendedIds.includes(course.id) && !confirmedIds.includes(course.id))
      .map((course) => ({ course, group, term })),
  ));
  const selected = entries.filter((entry) => entry.term.id === activeTerm?.id);
  const current = selected.find(({ course }) => course.id === fromId);
  const completed = allocatedCourses(curriculum, [...confirmedIds, ...recommendedIds]);
  const candidates = current?.group.courses.filter((course) =>
    !completed.some((chosen) => sameCourse(chosen.name, course.name)) &&
    !swapProblem(curriculum, confirmedIds, recommendedIds, fromId, course.id, true),
  ) ?? [];
  const pending = current?.group.courses.find((course) => course.id === toId);
  const strictProblem = current && pending ? swapProblem(curriculum, confirmedIds, recommendedIds, fromId, toId) : null;
  const blockingProblem = current && pending ? swapProblem(curriculum, confirmedIds, recommendedIds, fromId, toId, true) : null;
  useEffect(() => {
    if (!toId) return;
    warningRef.current?.focus({ preventScroll: true });
    warningRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [toId]);
  function cancel() { setFromId(''); setToId(''); }
  function apply(candidate: CurriculumCourse, acknowledgeScience = false) {
    if (!current) return;
    const problem = onSwap(fromId, candidate.id, acknowledgeScience);
    if (problem) { setNotice(problem); return; }
    setNotice(`${current.course.name} → ${candidate.name} 교체를 반영했어요.`);
    cancel();
  }
  return (
    <div className="mt-5 space-y-6">
      <div className="border-l-4 border-sky-400 bg-sky-50/60 p-4 text-sm leading-6 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100">
        <p>선택된 2단계 과목을 하나씩 교체할 수 있어요. 바꿀 과목을 누른 뒤, 아래 미선택 목록에서 대신 들을 과목을 골라주세요.</p>
        <p className="mt-2">이 탭에서는 과목 설명이나 교체 추천을 제공하지 않아요. 학점·이수조건과 선행과목 안내는 유지됩니다.</p>
        <p className="mt-2">궁금한 점이 생기면 언제든지 ‘상담하며 수정하기’ 탭으로 이동해 상담을 이어갈 수 있어요.</p>
      </div>
      {notice && <p ref={noticeRef} role="status" className="scroll-mt-6 border-l-4 border-emerald-500 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="size-4 shrink-0" />학교지정·1단계 확정 과목은 고정</p>
        <Button variant="outline" disabled={!canUndo} onClick={() => { onUndo(); cancel(); setNotice('이전 선택으로 되돌렸어요.'); }}><Undo2 />되돌리기</Button>
      </div>
      <div role="tablist" aria-label="수정할 학기" className="grid grid-cols-4 border-b">
        {curriculum.terms.map((term, index) => (
          <button key={term.id} type="button" role="tab" id={`${tabId}-${term.id}`} aria-selected={activeTerm?.id === term.id} aria-controls={`${tabId}-panel`} tabIndex={activeTerm?.id === term.id ? 0 : -1}
            className={`border-b-2 px-2 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-sky-600 ${activeTerm?.id === term.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => { setTermId(term.id); cancel(); setNotice(''); }}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const count = curriculum.terms.length;
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + count) % count;
              const target = curriculum.terms[next];
              setTermId(target.id); cancel(); setNotice('');
              document.getElementById(`${tabId}-${target.id}`)?.focus();
            }}>{term.label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${activeTerm?.id}`} className="space-y-6">
      <section>
        <h3 className="font-semibold">2단계 선택 과목</h3>
        <div className="mt-3 grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {selected.map(({ course, group }) => {
                  const replacing = course.id === fromId;
                  return <button key={course.id} type="button" aria-pressed={replacing} aria-label={`${course.name} ${replacing ? '교체 취소' : '교체하기'}`}
                    className={`flex w-full items-start gap-2 rounded-md border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${replacing ? 'border-amber-500 bg-amber-50 text-amber-950' : 'border-sky-200 bg-sky-50/60 text-sky-950 hover:border-sky-500'}`}
                    onClick={() => { setFromId(replacing ? '' : course.id); setToId(''); setNotice(''); }}>
                    {replacing ? <Square className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium">{course.name}</span>
                      <span className="mt-1 block break-words text-xs opacity-75">{group.name}</span>
                      <span className="mt-1 block text-xs">{replacing ? '교체 예정' : '선택됨'} · {course.credit ?? '?'}학점</span>
                    </span>
                  </button>;
                })}
          {!selected.length && <p className="col-span-full py-3 text-sm text-muted-foreground">이 학기에는 2단계 선택 과목이 없어요.</p>}
        </div>
      </section>
      <section className="border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-rose-800">미선택 과목</h3>
          {current && <Button variant="ghost" size="sm" onClick={cancel}><X />교체 취소</Button>}
        </div>
        <p role="status" className="mt-2 text-sm text-muted-foreground">{current ? `${current.term.label} · ${current.group.name} · ${current.course.name} 교체 예정` : '교체할 2단계 과목을 선택해 주세요.'}</p>
        {pending && strictProblem && <div ref={warningRef} tabIndex={-1} className="mt-3 scroll-mt-6 border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">{current?.course.name} → {pending.name}</p>
          <p className="mt-2 leading-6">{strictProblem}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!blockingProblem && <Button variant="outline" onClick={() => apply(pending, true)}><ArrowLeftRight />안내를 확인했고, 교체할게요</Button>}
            <Button variant="ghost" onClick={() => setToId('')}>다른 과목 고르기</Button>
          </div>
        </div>}
        <div className="mt-3 grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {candidates.map((course) => {
                    return <button key={course.id} type="button"
                      className="flex w-full items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-left text-emerald-950 enabled:hover:border-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:border-border disabled:bg-muted/30 disabled:text-muted-foreground"
                      onClick={() => {
                        setNotice('');
                        const warning = swapProblem(curriculum, confirmedIds, recommendedIds, fromId, course.id);
                        if (warning) setToId(course.id);
                        else apply(course);
                      }}>
                      <Plus className="mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium">{course.name}</span>
                        <span className="mt-1 block text-xs">{course.credit ?? '?'}학점</span>
                      </span>
                    </button>;
                  })}
          {current && !candidates.length && <p className="col-span-full py-3 text-sm text-muted-foreground">같은 선택군에서 학점·이수조건을 유지하며 교체할 수 있는 과목이 없어요.</p>}
        </div>
      </section>
      </div>
    </div>
  );
}

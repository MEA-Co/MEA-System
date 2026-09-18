'use client';
import { MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PriorityProfile } from '@/features/subject-selection/recommendations';

import { priority, swapProblem } from '../../_lib/course-swap';
import type { ConfirmedCurriculum } from '../../_lib/curriculum';

export function CourseSelectionFreeQuestions({
  hidden,
  curriculum,
  profile,
  confirmedIds,
  recommendedIds,
}: {
  hidden: boolean;
  curriculum: ConfirmedCurriculum;
  profile: PriorityProfile | null;
  confirmedIds: string[];
  recommendedIds: string[];
}) {
  const [question, setQuestion] = useState('');
  const [freeMessages, setFreeMessages] = useState<
    Array<{ role: 'student' | 'advisor'; text: string }>
  >([]);
  const chosen = curriculum.terms.flatMap((term) =>
    term.selectionGroups.flatMap((group) =>
      group.courses
        .filter((course) => recommendedIds.includes(course.id))
        .map((course) => ({ course, group })),
    ),
  );
  function ask() {
    if (!question.trim()) return;
    const normalized = question.replaceAll(/\s/g, '');
    const matches = chosen.filter(({ course }) =>
      normalized.includes(course.name.replaceAll(/\s/g, '')),
    );
    if (matches.length === 1) {
      const match = matches[0];
      const alternative = match.group.courses.find(
        (course) =>
          course.id !== match.course.id &&
          normalized.includes(course.name.replaceAll(/\s/g, '')) &&
          !swapProblem(
            curriculum,
            confirmedIds,
            recommendedIds,
            match.course.id,
            course.id,
          ),
      );
      logFree(
        question.trim(),
        `${match.course.name}은 ${priority(match.course, profile).label} 기준의 2단계 추천 과목이에요. 학교지정이나 1단계 확정 과목처럼 고정된 선택은 아닙니다.${alternative ? ` ${alternative.name}은 같은 선택군에서 교체 가능한 후보예요.` : ''} 구체적으로 비교하고 싶다면 위 과목 비교 영역에서 선택해 주세요. 현재 선택은 바꾸지 않았어요.`,
      );
    } else {
      logFree(
        question.trim(),
        '현재는 규칙 기반 상담 초안이라 자유로운 질문의 맥락까지 해석하지는 못해요. 2단계 과목 이름을 포함해 질문하거나, 위 과목 비교 영역에서 대안을 확인해 주세요. 학교지정·1단계 확정 과목은 변경하지 않습니다.',
      );
    }
    setQuestion('');
  }
  function logFree(student: string, advisor: string) {
    setFreeMessages((previous) => [
      ...previous,
      { role: 'student', text: student },
      { role: 'advisor', text: advisor },
    ]);
  }

  return (
    <section
      hidden={hidden}
      className="mt-5 border-t pt-6"
      aria-label="자유 질문"
    >
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <MessageCircle className="size-5" />
        자유 질문
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        과목 선택에 대해 궁금한 점을 남겨 주세요. 현재는 과목명 기반의 기본
        안내만 제공하며, AI 자유 상담은 아직 연결되지 않았어요.
      </p>
      <div
        role="log"
        aria-label="자유 질문 대화"
        aria-live="polite"
        className="mt-4 space-y-3"
      >
        {freeMessages.map((message, index) => (
          <p
            key={index}
            className={`max-w-2xl whitespace-pre-wrap break-words rounded-lg p-3 text-sm leading-6 ${message.role === 'student' ? 'ml-auto bg-emerald-50 text-emerald-950' : 'bg-muted/50'}`}
          >
            {message.text}
          </p>
        ))}
      </div>
      <form
        className="mt-5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask();
        }}
      >
        <Input
          aria-label="자유 질문 입력"
          value={question}
          maxLength={500}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="예: 화학 대신 데이터 과학을 들어도 될까요?"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="질문 보내기"
          disabled={!question.trim()}
        >
          <Send />
        </Button>
      </form>
    </section>
  );
}

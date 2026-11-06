import { ArrowRight, LockKeyhole } from 'lucide-react';
import { Fragment, useState } from 'react';

import { CollectionTable } from '@/components/patterns/collection-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { Topic } from '../lib/rounds';

const weeks = [
  {
    week: '2월 1주차',
    theme: '진로적성검사',
    questions: [
      '검사 결과와 내가 좋아하는 일이 다르면 무엇을 기준으로 진로를 탐색할까요?',
      '검사에서 발견한 관심 분야가 나와 맞는지 어떻게 확인할까요?',
    ],
  },
  {
    week: '2월 2주차',
    theme: '계열·학과 심층 탐색',
    questions: [
      '관심 학과 두 곳의 이름이 비슷할 때 어떤 차이부터 확인할까요?',
      '희망 계열은 정했지만 학과를 좁히기 어렵다면 무엇부터 해볼까요?',
    ],
  },
  {
    week: '2월 3주차',
    theme: '고1 연간 로드맵',
    questions: [
      '내신 공부와 학생부 활동이 겹치면 연간 계획에서 무엇을 먼저 배치할까요?',
      '고1 시기별 전략표에 어떤 점검 기준을 넣으면 계획을 조정하기 쉬울까요?',
    ],
  },
  {
    week: '2월 4주차',
    theme: '멘탈 관리',
    questions: [
      '계획이 며칠째 밀렸을 때 다시 시작하는 첫 행동은 무엇이 좋을까요?',
      '친구들과 성적을 비교하며 불안해질 때 내 공부 리듬을 어떻게 되찾을까요?',
    ],
  },
  {
    week: '3월 1주차',
    theme: '동아리 선택',
    questions: [
      '희망 전공과 관련 있는 동아리와 내가 주도적으로 활동할 수 있는 동아리 중 무엇을 우선할까요?',
      '동아리 홍보만으로 활동 내용을 알기 어려울 때 무엇부터 확인할까요?',
    ],
  },
  ...['3월 2주차', '3월 3주차', '3월 4주차'].map((week) => ({
    week,
    theme: '공개 예정',
    questions: [],
  })),
];

export function WeeklyThemes({
  onQuestion,
}: {
  onQuestion: (topic: Topic) => void;
}) {
  const [index, setIndex] = useState(0),
    current = weeks[index];
  const questions = (
    <div className="space-y-2">
      {' '}
      <p className="text-sm text-muted-foreground">
        질문을 고르면 MEA가 비교할 선택지를 만들어 드려요.
      </p>
      {current.questions.map((question, i) => (
        <Button
          key={question}
          variant="outline"
          onClick={() =>
            onQuestion({
              week: current.week,
              theme: current.theme,
              question,
            })
          }
          className="h-auto w-full justify-start gap-3 whitespace-normal py-3 text-left"
        >
          <Badge variant="count">Q{i + 1}</Badge>
          <span className="min-w-0 flex-1 break-keep">{question}</span>
          <ArrowRight />
        </Button>
      ))}
    </div>
  );
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <CollectionTable>
        <TableCaption className="sr-only">
          주차별 메인 테마와 공개 상태
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">주차</TableHead>
            <TableHead>주제</TableHead>
            <TableHead className="w-20">상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {weeks.map((w, i) => (
            <Fragment key={w.week}>
              <TableRow data-state={index === i ? 'selected' : undefined}>
                <TableCell>{w.week}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    disabled={!w.questions.length}
                    aria-pressed={index === i}
                    onClick={() => setIndex(i)}
                    className="h-auto w-full justify-start whitespace-normal px-0 text-left hover:bg-transparent hover:underline"
                  >
                    {w.theme}
                  </Button>
                </TableCell>
                <TableCell>
                  <Badge variant={index === i ? 'highlight' : 'subtle'}>
                    {!w.questions.length ? (
                      <>
                        <LockKeyhole />
                        예정
                      </>
                    ) : index === i ? (
                      '선택됨'
                    ) : (
                      '공개'
                    )}
                  </Badge>
                </TableCell>
              </TableRow>
              {i === index && (
                <TableRow className="lg:hidden">
                  <TableCell colSpan={3}>{questions}</TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </CollectionTable>
      <Card variant="accent" className="hidden lg:flex">
        <CardHeader variant="emphasis">
          <CardDescription>
            {current.week} · 함께 생각해 볼 주제
          </CardDescription>
          <CardTitle>{current.theme}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">{questions}</CardContent>
      </Card>
    </div>
  );
}

import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cards } from '@/features/mentor-round/client/cards.mjs';
import { legacy } from '@/features/mentor-round/client/legacy.mjs';
import { personas } from '@/features/mentor-round/shared/personas.mjs';

import {
  answerParagraphs,
  choiceColors,
  choiceLabelStyle,
  choiceLetter,
  confidenceDescription,
  referencedSummaries,
  strategyApplications,
  strategyLabel,
} from '../lib/presentation';
import { type Ballot, ballotsFor, panelId, type Round } from '../lib/rounds';

import { MentorEvidenceDialog } from './MentorEvidenceDialog';
import { PersonaDetails } from './PersonaEvidenceDetails';

const schools = ['서울대', '고려대', '연세대', 'KAIST'];
function mentorName(index: number, modern: boolean) {
  return modern
    ? (cards[index]?.name ?? '멘토 ' + (index + 1))
    : String(legacy[index]?.[0] ?? '멘토 ' + (index + 1));
}
function MentorIdentity({
  index,
  modern = true,
}: {
  index: number;
  modern?: boolean;
}) {
  const m = cards[index],
    old = legacy[index];
  return (
    <div className="flex items-start gap-3">
      <div
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold"
      >
        {mentorName(index, modern).slice(0, 1)}
      </div>
      <div className="min-w-0 space-y-1">
        <h3 className="font-semibold leading-6">
          {mentorName(index, modern)} 멘토
        </h3>
        <p className="break-keep text-xs leading-5 text-muted-foreground">
          {modern
            ? m
              ? m.affiliation + ' · ' + m.year + '학번'
              : '멘토 정보 없음'
            : schools[Math.floor(index / 3)] + ' · ' + (old?.[1] ?? '')}
        </p>
      </div>
    </div>
  );
}

export function MentorPanel() {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          서로 다른 경험, 다양한 선택의 기준
        </h2>
        <p className="text-sm leading-7 text-muted-foreground">
          멘토가 직접 작성한 답변에서 공부·탐구 경험을 정리했어요. 이 경험을
          바탕으로 내 질문에 대한 조언을 만나볼 수 있어요.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-5">
              <MentorIdentity index={i} />
              <PersonaDetails persona={personas[i]} />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function SeatChart({ ballots }: { ballots: Ballot[] }) {
  let i = 0;
  const rows =
    ballots.length === 28 ? [6, 9, 13] : ballots.length === 12 ? [5, 7] : null;
  if (!rows)
    return (
      <div
        role="img"
        aria-label={ballots.length + '명의 멘토 응답 분포'}
        className="mx-auto flex max-w-56 flex-wrap justify-center gap-2"
      >
        {ballots.map((b, index) => (
          <span
            key={index}
            className="size-4 rounded-sm bg-muted-foreground/25"
            style={
              b.state === 'done'
                ? { background: choiceColors[b.choice ?? -1] ?? '#888' }
                : undefined
            }
          />
        ))}
      </div>
    );
  return (
    <svg
      viewBox="0 0 252 140"
      role="img"
      aria-label={ballots.length + '명의 멘토 의석 분포'}
      className="mx-auto w-full max-w-56"
    >
      {rows.map((count, row) =>
        Array.from({ length: count }, (_, c) => {
          const idx = i++,
            b = ballots[idx],
            r = 47 + 30 * row,
            a = (Math.PI * c) / (count - 1),
            choice = b?.choice ?? -1;
          return (
            <rect
              key={idx}
              x={118 - r * Math.cos(a)}
              y={114 - r * Math.sin(a)}
              width="16"
              height="16"
              rx="3"
              className={b?.state === 'done' ? '' : 'fill-muted-foreground/25'}
              fill={choiceColors[choice] ?? '#888'}
            >
              <title>
                {'멘토 ' +
                  (idx + 1) +
                  ' · ' +
                  (b?.state === 'done'
                    ? choice >= 0
                      ? '선택지 ' + choiceLetter(choice)
                      : '판단 보류'
                    : b?.state === 'failed'
                      ? '응답 실패'
                      : b?.state === 'loading'
                        ? '응답 중'
                        : '대기 중')}
              </title>
            </rect>
          );
        }),
      )}
    </svg>
  );
}

function MentorAnswer({
  ballot: b,
  index,
  round,
  modern,
  onRetry,
  onRecheck,
}: {
  ballot: Ballot;
  index: number;
  round: Round;
  modern: boolean;
  onRetry: () => void;
  onRecheck: () => Promise<void>;
}) {
  const applications = strategyApplications(b);
  const summaries =
    b.explanation?.version === '2' ? referencedSummaries(b) : [];
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceTag, setEvidenceTag] =
    useState<NonNullable<Ballot['applied']>[number]>();
  const choice = b.choice ?? -1;
  return (
    <Card className="gap-0" size="sm">
      <CardContent className="grid gap-5 py-2 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-7 md:py-3">
        <MentorIdentity index={index} modern={modern} />
        <div className="min-w-0 space-y-4">
          {b.state === 'done' ? (
            <>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                  style={choiceLabelStyle(choice)}
                >
                  {choiceLetter(choice)}
                </span>
                <h4 className="min-w-0 break-keep text-[15px] font-semibold leading-7">
                  {round.opts[choice] ?? '선택을 보류했어요'}
                </h4>
              </div>
              <div className="max-w-[70ch] space-y-3 break-words text-[16px] leading-8">
                {answerParagraphs(b).map((text, i) => (
                  <p key={i} className="whitespace-pre-wrap">
                    {text}
                  </p>
                ))}
                {summaries.length > 0 && (
                  <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7">
                    {summaries.map((summary) => (
                      <li key={summary}>{summary}</li>
                    ))}
                  </ul>
                )}
              </div>
              {modern && (
                <>
                  {Boolean(b.applied?.length) && (
                    <div className="space-y-3 border-l-2 border-brand pl-4">
                      <p className="text-xs text-muted-foreground">
                        참고한 전략·방법 · 누르면 실제 답변을 볼 수 있어요
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {b.applied!.map((tag, i) => (
                          <Button
                            key={tag.label + i}
                            variant="outline"
                            size="sm"
                            className="h-auto max-w-full whitespace-normal px-2.5 py-1 text-xs leading-5"
                            aria-label={
                              strategyLabel(tag.label) + ' · 멘토 답변 보기'
                            }
                            aria-haspopup="dialog"
                            onClick={() => {
                              setEvidenceTag(tag);
                              setEvidenceOpen(true);
                            }}
                          >
                            #{strategyLabel(tag.label)}
                          </Button>
                        ))}
                      </div>
                      {applications.length > 0 && (
                        <div className="max-w-[70ch] space-y-2 text-sm leading-7 text-muted-foreground">
                          {applications.map((text, i) => (
                            <p
                              className="whitespace-pre-wrap break-words"
                              key={i}
                            >
                              {text}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2"
                      aria-haspopup="dialog"
                      onClick={() => {
                        setEvidenceTag(undefined);
                        setEvidenceOpen(true);
                      }}
                    >
                      <BookOpen />
                      멘토의 실제 답변 보기
                    </Button>
                    {(!b.explanation || b.explanation.version === '1') && (
                      <span className="text-xs leading-5 text-muted-foreground">
                        {b.support
                          ? '원문 근거 ' + b.support.level + ' · '
                          : ''}
                        {confidenceDescription(b.support)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="space-y-3 py-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                {b.state === 'failed' ? (
                  <CircleAlert className="size-4 text-destructive" />
                ) : b.state === 'loading' ? (
                  <LoaderCircle className="size-4 motion-safe:animate-spin" />
                ) : (
                  <Clock3 className="size-4 text-muted-foreground" />
                )}
                {b.state === 'failed'
                  ? '응답을 받지 못했어요'
                  : b.state === 'loading'
                    ? '질문에 대한 의견을 정리하고 있어요'
                    : '차례를 기다리고 있어요'}
              </p>
              {b.reason && (
                <p className="text-sm leading-7 text-muted-foreground">
                  {b.reason}
                </p>
              )}
              {modern && b.state === 'failed' && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  이 멘토만 다시 요청
                  <ArrowRight />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
      {modern && b.state === 'done' && (
        <MentorEvidenceDialog
          open={evidenceOpen}
          onOpenChange={setEvidenceOpen}
          tag={evidenceTag}
          name={mentorName(index, modern)}
          ballot={b}
          choices={round.opts}
          onRecheck={onRecheck}
        />
      )}
    </Card>
  );
}

export function RoundResults({
  round,
  onRepeat,
  onRetry,
  onRecheck,
}: {
  round: Round;
  onRepeat: () => void;
  onRetry: (index: number) => void;
  onRecheck: (index: number) => Promise<void>;
}) {
  const [filter, setFilter] = useState('all'),
    [school, setSchool] = useState('all');
  const ballots = ballotsFor(round),
    done = ballots.filter((b) => b.state === 'done'),
    failed = ballots.filter((b) => b.state === 'failed').length,
    modern = round.panel === panelId;
  const choices = round.opts.map((label, id) => ({ label, id }));
  if (done.some((b) => b.choice === -1))
    choices.push({ label: '판단 보류', id: -1 });
  const visible = ballots
    .map((b, i) => ({ b, i }))
    .filter(
      ({ b, i }) =>
        (filter === 'all' ||
          (b.state === 'done' && String(b.choice) === filter)) &&
        (modern || school === 'all' || schools[Math.floor(i / 3)] === school),
    );
  return (
    <section className="space-y-8">
      <Card className="gap-0">
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="highlight">
                {round.topic?.week ?? (modern ? '내 질문' : '이전 12인 패널')}
              </Badge>
              {round.topic && (
                <span className="text-xs text-muted-foreground">
                  {round.topic.theme}
                </span>
              )}
            </div>
            <h2 className="max-w-4xl break-keep text-xl font-semibold leading-relaxed sm:text-2xl">
              {round.q}
            </h2>
            {round.topic && round.topic.question !== round.q && (
              <p className="text-xs leading-6 text-muted-foreground">
                처음 고른 질문 · {round.topic.question}
              </p>
            )}
          </div>
          <div className="grid items-center gap-6 border-t pt-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-8">
            <div className="space-y-2">
              <SeatChart ballots={ballots} />
              <p aria-live="polite" className="text-center text-sm">
                <strong className="tabular-nums">{done.length}</strong> /{' '}
                {ballots.length}명 응답
              </p>
              {modern && failed > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  {failed}명은 다시 요청할 수 있어요
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="mb-3 text-xs text-muted-foreground">
                선택지를 누르면 해당 의견을 모아 볼 수 있어요. 비율은 응답한
                멘토 기준이에요.
              </p>
              {choices.map(({ id, label }) => {
                const count = done.filter((b) => b.choice === id).length,
                  percent = done.length
                    ? +((100 * count) / done.length).toFixed(1)
                    : 0;
                return (
                  <Button
                    key={id}
                    variant="ghost"
                    aria-pressed={filter === String(id)}
                    aria-label={`${choiceLetter(id)} · ${label} · ${count}명, ${percent}% 응답 보기`}
                    onClick={() =>
                      setFilter(filter === String(id) ? 'all' : String(id))
                    }
                    className={
                      'h-auto w-full flex-col items-stretch gap-2 whitespace-normal rounded-lg border p-3 text-left ' +
                      (filter === String(id)
                        ? 'border-foreground/35 bg-muted/50'
                        : 'border-transparent')
                    }
                  >
                    <span className="flex w-full items-start gap-2.5">
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
                        style={choiceLabelStyle(id)}
                      >
                        {choiceLetter(id)}
                      </span>
                      <span className="min-w-0 flex-1 break-keep text-sm leading-6">
                        {label}
                      </span>
                      <span className="shrink-0 text-right text-sm leading-6 tabular-nums">
                        {count}명{' '}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {percent}%
                        </span>
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="ml-8 h-1.5 overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: percent + '%',
                          background: choiceColors[id] ?? '#777',
                        }}
                      />
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
          <p className="border-t pt-4 text-xs leading-6 text-muted-foreground">
            {modern
              ? '멘토의 과거 경험을 바탕으로 정리한 조언이에요. 멘토가 이번 질문에 직접 답한 내용은 아니에요.'
              : '이전 12인 패널의 저장된 응답입니다. 현재 28인 패널의 원문 대조 정보와는 구분됩니다.'}
          </p>
          {modern && done.some((b) => b.explanation?.version === '2') && (
            <Button variant="outline" onClick={onRepeat}>
              이 질문으로 새 조언 받기
              <ArrowRight />
            </Button>
          )}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mr-auto space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              멘토별 의견 <Badge variant="count">{visible.length}</Badge>
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              선택과 함께 참고한 경험을 읽고, 내 상황과 비교해 보세요.
            </p>
          </div>
          <div className="flex max-w-full flex-wrap gap-2">
            {!modern && (
              <Select
                value={school}
                onValueChange={(v) => setSchool(v ?? 'all')}
              >
                <SelectTrigger aria-label="대학 필터">
                  <SelectValue>
                    {school === 'all' ? '모든 대학' : school}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {['all', ...schools].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === 'all' ? '모든 대학' : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filter} onValueChange={(v) => setFilter(v ?? 'all')}>
              <SelectTrigger aria-label="선택지 필터">
                <SelectValue>
                  {filter === 'all'
                    ? '전체 선택지'
                    : Number(filter) < 0
                      ? '판단 보류'
                      : '선택지 ' + choiceLetter(Number(filter))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 선택지</SelectItem>
                {choices.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="max-w-72 whitespace-normal break-words">
                      {choiceLetter(c.id)} · {c.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {filter !== 'all' && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0" />
            <p className="min-w-0 flex-1 break-keep leading-6">
              {choices.find((c) => String(c.id) === filter)?.label}
            </p>
            <Button size="sm" variant="ghost" onClick={() => setFilter('all')}>
              전체 보기
            </Button>
          </div>
        )}
        <div className="space-y-4">
          {visible.map(({ b, i }) => (
            <MentorAnswer
              key={i}
              ballot={b}
              index={i}
              round={round}
              modern={modern}
              onRetry={() => onRetry(i)}
              onRecheck={() => onRecheck(i)}
            />
          ))}
        </div>
        {!visible.length && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">아직 이 조건의 응답이 없어요</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              다른 선택지를 보거나 전체 의견을 비교해 보세요.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setFilter('all');
                setSchool('all');
              }}
            >
              전체 응답 보기
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

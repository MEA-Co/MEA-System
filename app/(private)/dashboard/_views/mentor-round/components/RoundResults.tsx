import { useState } from 'react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cards } from '@/features/mentor-round/client/cards.mjs';
import { legacy } from '@/features/mentor-round/client/legacy.mjs';
import { methods } from '@/features/mentor-round/shared/mentor-methods.mjs';
import { data } from '@/features/mentor-round/shared/mentors.mjs';

import {
  type Ballot,
  ballotsFor,
  panelId,
  type Round,
  type SourcePair,
} from '../lib/rounds';

const palette = ['#228463', '#c68b2e', '#627ebb', '#985789', '#798646'];
const schools = ['서울대', '고려대', '연세대', 'KAIST'];
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
    <CardHeader>
      <CardTitle>{modern ? m.name : old[0]} 멘토</CardTitle>
      <CardDescription>
        {modern
          ? m.affiliation + ' · ' + m.year + '학번'
          : schools[Math.floor(index / 3)] + ' · ' + old[1]}
      </CardDescription>
    </CardHeader>
  );
}
export function MentorPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((_, i) => (
        <Card key={i} size="sm">
          <MentorIdentity index={i} />
          <CardContent className="space-y-3">
            <Badge variant="highlight">{data[i][2]}</Badge>
            <p className="leading-relaxed">{data[i][4]}</p>
            <div className="flex flex-wrap gap-1">
              {methods[i].map((t) => (
                <Badge
                  key={t.label}
                  variant={t.kind === '전략' ? 'highlight' : 'subtle'}
                >
                  {t.kind} · {t.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
function RecheckSource({ onRecheck }: { onRecheck: () => Promise<void> }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function run() {
    setBusy(true);
    setError('');
    try {
      await onRecheck();
    } catch (e) {
      setError(e instanceof Error ? e.message : '원문 대조에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button variant="outline" size="sm" disabled={busy} onClick={run}>
        {busy ? '원문 대조 중…' : '원문으로 신뢰도 다시 평가'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
function SourcePairs({ sources }: { sources: SourcePair[] }) {
  return (
    <div className="mt-3 space-y-3">
      {sources.map(({ summary, question, quote }) => (
        <dl
          key={question + quote}
          className="space-y-1 border-l-2 border-brand pl-3 text-sm leading-relaxed"
        >
          <dt className="text-xs font-medium text-muted-foreground">
            페르소나 경험 요약
          </dt>
          <dd>{summary}</dd>
          <dt className="pt-1 text-xs font-medium text-muted-foreground">
            제출 질문지의 질문 원문
          </dt>
          <dd className="whitespace-pre-line">{question}</dd>
          <dt className="pt-1 text-xs font-medium text-muted-foreground">
            멘토의 답변 원문 · 관련 구절
          </dt>
          <dd>
            <blockquote className="whitespace-pre-line">{quote}</blockquote>
          </dd>
        </dl>
      ))}
    </div>
  );
}
function Confidence({ support }: { support: Ballot['support'] }) {
  if (support === undefined) return null;
  if (!support)
    return (
      <p className="text-xs text-muted-foreground">
        답변 근거 신뢰도 · 평가 미완료
      </p>
    );
  const levels = {
    상: {
      n: 3,
      color: 'bg-emerald-600',
      label: '핵심 조언 대부분을 직접 언급',
    },
    중: { n: 2, color: 'bg-amber-400', label: '일부 조언을 직접 언급' },
    하: { n: 1, color: 'bg-red-600', label: '직접 근거 미확인 · 추론 중심' },
  };
  const level = levels[support.level];
  if (!level) return null;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer">
        답변 근거 신뢰도 <b>{support.level}</b>{' '}
        <span aria-hidden className="inline-flex gap-0.5 align-middle">
          {[1, 2, 3].map((n) => (
            <i
              key={n}
              className={
                'h-1.5 w-4 rounded-sm ' +
                (n <= level.n ? level.color : 'bg-muted')
              }
            />
          ))}
        </span>
        {Boolean(support.sources?.length || support.quotes?.length) && (
          <span className="ml-2 underline">
            원문 {support.sources?.length ?? support.quotes?.length}개 보기
          </span>
        )}
      </summary>
      <p className="mt-2 text-muted-foreground">
        {level.label}. 해당 멘토의 제출 답변에서 정리한 근거와 대조한
        결과입니다.
      </p>
      {support.sources?.length ? (
        <SourcePairs sources={support.sources} />
      ) : support.quotes?.length ? (
        <div className="mt-3 space-y-2">
          <p className="font-medium">멘토 제출 답변 · 원문 발췌</p>
          {support.quotes.map((quote) => (
            <blockquote
              key={quote}
              className="border-l-2 border-brand pl-3 text-sm leading-relaxed"
            >
              {quote}
            </blockquote>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">
          {support.sources || support.quotes
            ? '대조한 제출 답변에서 이 코멘트를 직접 뒷받침하는 구절을 찾지 못했습니다.'
            : '이전 판정에는 원문 근거가 저장되지 않았습니다.'}
        </p>
      )}
    </details>
  );
}
function SeatChart({ ballots }: { ballots: Ballot[] }) {
  let i = 0;
  return (
    <svg
      viewBox="0 0 252 140"
      role="img"
      aria-label={ballots.length + '명의 멘토 의석 분포'}
      className="mx-auto w-full max-w-72"
    >
      {(ballots.length === 28 ? [6, 9, 13] : [5, 7]).map((count, row) =>
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
              rx="2"
              className={
                b?.state === 'done' && choice >= 0
                  ? ''
                  : 'fill-muted-foreground/25'
              }
              fill={palette[choice]}
            >
              <title>
                {'멘토 ' +
                  (idx + 1) +
                  ' · ' +
                  (b?.state === 'done'
                    ? choice >= 0
                      ? '선택지 ' + String.fromCharCode(65 + choice)
                      : '판단 보류'
                    : b?.state === 'failed'
                      ? '응답 실패'
                      : '대기 중')}
              </title>
            </rect>
          );
        }),
      )}
    </svg>
  );
}
export function RoundResults({
  round,
  onRetry,
  onRecheck,
}: {
  round: Round;
  onRetry: (index: number) => void;
  onRecheck: (index: number) => Promise<void>;
}) {
  const [filter, setFilter] = useState('all'),
    [school, setSchool] = useState('all');
  const ballots = ballotsFor(round),
    done = ballots.filter((b) => b.state === 'done'),
    modern = round.panel === panelId;
  const choices = round.opts.map((label, i) => ({ label, id: i }));
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
    <section className="space-y-5">
      <Card variant="accent">
        <CardHeader variant="emphasis">
          <CardDescription>
            {round.topic
              ? round.topic.week + ' · ' + round.topic.theme
              : modern
                ? '내 질문'
                : '이전 12인 패널'}
          </CardDescription>
          <CardTitle className="text-lg">{round.q}</CardTitle>
          {round.topic && (
            <CardDescription>
              중심 질문 · {round.topic.question}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid items-center gap-5 sm:grid-cols-2">
          <div>
            <SeatChart ballots={ballots} />
            <p aria-live="polite" className="text-center text-sm font-medium">
              {done.length} / {ballots.length}명 응답
            </p>
          </div>
          <ul className="space-y-3">
            {choices.map(({ id, label }) => {
              const n = done.filter((b) => b.choice === id).length;
              return (
                <li key={id} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-sm"
                    style={{ background: palette[id] ?? '#999' }}
                  />
                  <span className="flex-1">{label}</span>
                  <span className="whitespace-nowrap tabular-nums">
                    {n}명 ·{' '}
                    {done.length ? +((100 * n) / done.length).toFixed(1) : 0}%
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">멘토별 응답</h2>
        {!modern && (
          <Select value={school} onValueChange={(v) => setSchool(v ?? 'all')}>
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
          <SelectTrigger aria-label="선택지 필터" className="max-w-full">
            <SelectValue>
              {filter === 'all'
                ? '전체 선택지'
                : choices.find((c) => String(c.id) === filter)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 선택지</SelectItem>
            {choices.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map(({ b, i }) => (
          <Card key={i} size="sm">
            <MentorIdentity index={i} modern={modern} />
            <CardContent className="space-y-3">
              <Badge
                variant={
                  b.state === 'failed'
                    ? 'destructive'
                    : b.state === 'done'
                      ? 'highlight'
                      : 'subtle'
                }
                className="h-auto whitespace-normal"
              >
                {b.state === 'done'
                  ? (round.opts[b.choice ?? -1] ?? '판단 보류')
                  : b.state === 'failed'
                    ? '응답 실패'
                    : b.state === 'loading'
                      ? '응답 중'
                      : '대기 중'}
              </Badge>
              {b.reason && <p className="leading-relaxed">{b.reason}</p>}
              {modern && b.state === 'done' && (
                <>
                  {b.sources?.length ? (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium">
                        이 선택에 사용한 경험 · 원문 Q&A {b.sources.length}개
                      </summary>
                      <SourcePairs sources={b.sources} />
                    </details>
                  ) : (
                    b.sources && (
                      <p className="text-xs text-muted-foreground">
                        이번 선택에 직접 적용한 원문 Q&A가 없습니다.
                      </p>
                    )
                  )}
                  <Confidence support={b.support} />
                  {!b.support?.sources && (
                    <RecheckSource onRecheck={() => onRecheck(i)} />
                  )}
                  {b.applied?.map((t) => (
                    <details key={t.label} className="text-xs">
                      <summary className="cursor-pointer">
                        <Badge
                          variant={t.kind === '전략' ? 'highlight' : 'subtle'}
                        >
                          {t.kind} · {t.label}
                        </Badge>
                      </summary>
                      <blockquote className="mt-2 border-l-2 pl-3 text-muted-foreground">
                        {t.evidence}
                      </blockquote>
                    </details>
                  ))}
                </>
              )}
              {modern && b.state === 'failed' && (
                <Button variant="outline" size="sm" onClick={() => onRetry(i)}>
                  다시 요청
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {!visible.length && (
        <p className="text-sm text-muted-foreground">
          해당하는 응답이 없습니다.
        </p>
      )}
    </section>
  );
}

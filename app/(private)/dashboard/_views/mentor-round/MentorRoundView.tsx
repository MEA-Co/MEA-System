'use client';
import { Inbox, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  CollectionEmptyState,
  CollectionHeader,
} from '@/components/patterns/collection';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cards } from '@/features/mentor-round/client/cards.mjs';

import { QuestionEditor } from './components/QuestionEditor';
import { MentorPanel, RoundResults } from './components/RoundResults';
import { WeeklyThemes } from './components/WeeklyThemes';
import {
  type Ballot,
  type Draft,
  newRound,
  panelId,
  postRound,
  restoreRounds,
  type Round,
  type Topic,
} from './lib/rounds';

export function MentorRoundView({
  userId,
  preview = false,
}: {
  userId: string;
  preview?: boolean;
}) {
  const key =
    (preview ? 'mea:mentor-round:lead-preview:v1:' : 'mea:mentor-round:v1:') +
    userId;
  const [tab, setTab] = useState('home'),
    [selected, setSelected] = useState<string | null>(null),
    [editor, setEditor] = useState<{ topic?: Topic } | null>(null),
    [rounds, setRounds] = useState<Round[]>([]);
  const records = useRef<Round[]>([]),
    life = useRef<AbortController | null>(null);
  useEffect(() => {
    life.current = new AbortController();
    records.current = restoreRounds(key);
    setRounds(records.current);
    return () => life.current?.abort();
  }, [key]);
  function save(next: Round[]) {
    records.current = next;
    setRounds(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Browser storage may be full or disabled. */
    }
  }
  function update(id: string, index: number, b: Ballot) {
    save(
      records.current.map((r) =>
        r.id === id
          ? {
              ...r,
              ballots: r.ballots?.map((old, i) => (i === index ? b : old)),
            }
          : r,
      ),
    );
  }
  async function vote(r: Round, index: number, signal: AbortSignal) {
    if (signal.aborted) return;
    update(r.id, index, { state: 'loading' });
    try {
      const b = await postRound<{
        choice: number;
        reason: string;
        applied?: Ballot['applied'];
        support?: Ballot['support'];
      }>(
        'vote',
        { q: r.q, opts: r.opts, mentor: index, panel: panelId },
        signal,
      );
      if (!Number.isInteger(b.choice) || !r.opts[b.choice] || !b.reason)
        throw Error('응답을 확인할 수 없습니다.');
      if (!signal.aborted) update(r.id, index, { ...b, state: 'done' });
    } catch (e) {
      if (!signal.aborted)
        update(r.id, index, {
          state: 'failed',
          reason: e instanceof Error ? e.message : '연결이 중단됐습니다.',
        });
    }
  }
  function start(d: Draft) {
    const signal = life.current?.signal;
    if (!signal) return;
    const r = newRound(d, editor?.topic);
    save([r, ...records.current]);
    setEditor(null);
    setSelected(r.id);
    setTab('result');
    let next = 0;
    async function lane() {
      while (!signal!.aborted && next < cards.length)
        await vote(r, next++, signal!);
    }
    void Promise.all([lane(), lane(), lane()]);
  }
  const round = rounds.find((r) => r.id === selected);
  return (
    <section className="min-w-0 space-y-5">
      <CollectionHeader
        id="mentor-round-heading"
        title={preview ? '학생 화면 체험하기' : '멘토라운드'}
        description={
          preview
            ? '학생과 같은 멘토라운드를 체험합니다. 만든 질문과 투표 결과는 이 브라우저의 내 체험 질문함에 저장됩니다.'
            : '중심 질문을 골라 28명의 멘토 자료에 기반한 AI 투표를 비교하세요.'
        }
        action={
          <Button onClick={() => setEditor({})}>
            <Plus />새 질문
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="h-auto max-w-full flex-wrap">
          <TabsTrigger value="home">주차별 테마</TabsTrigger>
          <TabsTrigger value="mentors">멘토 패널</TabsTrigger>
          <TabsTrigger value="history">내 질문함</TabsTrigger>
          {round && <TabsTrigger value="result">개표 결과</TabsTrigger>}
        </TabsList>
        <TabsContent value="home">
          <WeeklyThemes onQuestion={(topic) => setEditor({ topic })} />
        </TabsContent>
        <TabsContent value="mentors">
          <MentorPanel />
        </TabsContent>
        <TabsContent value="history">
          {rounds.length ? (
            <div className="space-y-2">
              {rounds.map((r) => (
                <Card size="sm" key={r.id}>
                  <CardContent>
                    <Button
                      variant="ghost"
                      className="h-auto w-full flex-col items-start whitespace-normal text-left"
                      onClick={() => {
                        setSelected(r.id);
                        setTab('result');
                      }}
                    >
                      <span>{r.q}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.topic?.week ?? '내 질문'} · 선택지 {r.opts.length}개
                      </span>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <CollectionEmptyState
              icon={<Inbox />}
              title="저장된 질문이 없습니다"
              description="첫 질문을 만들면 이 브라우저의 질문함에 응답이 저장됩니다."
            />
          )}
        </TabsContent>
        {round && (
          <TabsContent value="result">
            <RoundResults
              key={round.id}
              round={round}
              onRecheck={async (i) => {
                const ballot = round.ballots?.[i],
                  signal = life.current?.signal;
                if (
                  !signal ||
                  ballot?.state !== 'done' ||
                  ballot.choice === undefined
                )
                  return;
                const { support } = await postRound<{
                  support: NonNullable<Ballot['support']>;
                }>(
                  'support',
                  {
                    panel: round.panel,
                    mentor: i,
                    q: round.q,
                    choice: round.opts[ballot.choice],
                    comment: ballot.reason,
                  },
                  signal,
                );
                if (!signal.aborted)
                  update(round.id, i, { ...ballot, support });
              }}
              onRetry={(i) => {
                const signal = life.current?.signal;
                if (
                  signal &&
                  records.current.find((r) => r.id === round.id)?.ballots?.[i]
                    ?.state === 'failed'
                )
                  void vote(round, i, signal);
              }}
            />
          </TabsContent>
        )}
      </Tabs>
      {editor && (
        <QuestionEditor
          topic={editor.topic}
          onClose={() => setEditor(null)}
          onStart={start}
        />
      )}
    </section>
  );
}

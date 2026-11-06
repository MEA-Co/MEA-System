import { cards } from '@/features/mentor-round/client/cards.mjs';
import { legacy, legacyVote } from '@/features/mentor-round/client/legacy.mjs';

export const panelId = 'mea28-v1';
export type Topic = { week: string; theme: string; question: string };
export type Draft = { q: string; opts: string[] };
export type SourcePair = {
  id?: string;
  summary: string;
  question: string;
  quote: string;
};
export type PersonaComponent = {
  id: string;
  version: string;
  kind: 'strategy' | 'skill' | 'experience';
  label: string;
  statement: string;
  sourceRefs: string[];
  provenance: { personaId: string; componentId: string; version: string };
  status: 'reviewed-summary';
};
export type PersonaSnapshot = {
  id: string;
  version: string;
  kind: 'source-based';
  displayName: string;
  components: PersonaComponent[];
  limitations: string[];
};
export type Ballot = {
  state: 'waiting' | 'loading' | 'done' | 'failed';
  choice?: number;
  reason?: string;
  applied?: {
    id?: string;
    kind: string;
    label: string;
    evidence: string;
    sourceRefs?: string[];
  }[];
  persona?: PersonaSnapshot;
  confidence?: {
    status: 'assessed' | 'unavailable';
    label: string;
    sourceCoverage: { verified: number; total: number };
    appliedCoverage: { verified: number; total: number };
    limitations: string[];
  };
  explanation?: {
    version: '1' | '2' | '3';
    context: string;
    criteria: {
      componentId: string;
      label: string;
      application: string;
      sourceRefs: string[];
    }[];
    alternatives: { choice: number; tradeoff: string }[];
    conclusion: string;
    caveats: string[];
    disclosure: string;
  };
  sources?: SourcePair[];
  support?: {
    sources?: SourcePair[];
    level: '상' | '중' | '하';
    quotes?: string[];
  } | null;
};
export type Round = Draft & {
  id: string;
  topic?: Topic;
  panel?: string;
  ballots?: Ballot[];
};
export function ballotsFor(round: Round): Ballot[] {
  if (round.ballots) return round.ballots;
  return legacy.map((d) => {
    const [choice, reason] = legacyVote(round, d);
    return { state: 'done', choice: Number(choice), reason: String(reason) };
  });
}
export function restoreRounds(key: string): Round[] {
  try {
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    return rows
      .filter(
        (r: Round) =>
          typeof r?.q === 'string' &&
          Array.isArray(r.opts) &&
          r.opts.length >= 2 &&
          r.opts.length <= 5 &&
          r.opts.every((o) => typeof o === 'string'),
      )
      .map((r: Round, i: number) => ({
        ...r,
        id: r.id || 'saved-' + i,
        ballots: r.ballots?.map((b) =>
          b?.state === 'done' || b?.state === 'failed'
            ? b
            : {
                state: 'failed',
                reason: '이전 투표가 중단됐습니다. 다시 요청해 주세요.',
              },
        ),
      }));
  } catch {
    return [];
  }
}
export function newRound(draft: Draft, topic?: Topic): Round {
  return {
    ...draft,
    topic,
    id: crypto.randomUUID(),
    panel: panelId,
    ballots: cards.map(() => ({ state: 'waiting' })),
  };
}
export async function postRound<T>(
  operation: 'vote' | 'question-draft' | 'support',
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
  const res = await fetch('/api/mentor-round/' + operation, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const value = await res.json();
  if (!res.ok) throw Error(value.error || '요청을 처리하지 못했습니다.');
  return value;
}

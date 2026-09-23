'use client';

import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Fragment, useId, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type QuestionBlockRow, questionName } from '../lib/question-blocks';
import { describeClause, questionGraphLayout } from '../lib/question-list';
import { richTextPlainText } from '../lib/rich-text';

export function QuestionRelationshipGraph({
  questions,
  matchedQuestions,
  canManage,
  onOpen,
}: {
  questions: QuestionBlockRow[];
  matchedQuestions: QuestionBlockRow[];
  canManage: (q: QuestionBlockRow) => boolean;
  onOpen: (q: QuestionBlockRow) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const markerId = useId().replace(/:/g, '');
  const graph = useMemo(
    () =>
      questionGraphLayout(
        questions,
        matchedQuestions.map((q) => q.id),
      ),
    [questions, matchedQuestions],
  );
  const matched = new Set(matchedQuestions.map((q) => q.id));
  const nodesById = new Map(graph.nodes.map((n) => [n.question.id, n]));
  const positions = new Map<string, number>();
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>앞선 질문 → 후속 질문 · 화살표 위에서 조건을 확인하세요.</p>
          <p>
            질문 {graph.nodes.length}개 · 연결 {graph.edges.length}개
            {graph.nodes.length > matched.size
              ? ' · 연결된 앞선 질문을 함께 표시합니다.'
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-1" aria-label="그래프 확대 축소">
          <Button
            size="sm"
            variant="ghost"
            aria-label="그래프 축소"
            disabled={zoom <= 0.4}
            onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(1)))}
          >
            <Minus aria-hidden="true" />
          </Button>
          <span
            className="w-12 text-center text-xs tabular-nums"
            aria-live="polite"
          >
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            aria-label="그래프 확대"
            disabled={zoom >= 1.5}
            onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))}
          >
            <Plus aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="그래프 배율 초기화"
            onClick={() => setZoom(1)}
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div
        className="h-[620px] overflow-auto bg-muted/20"
        tabIndex={0}
        role="region"
        aria-label="질문 관계 그래프. 가로와 세로로 스크롤할 수 있습니다."
      >
        <div style={{ width: graph.width * zoom, height: graph.height * zoom }}>
          <div
            className="relative origin-top-left"
            style={{
              width: graph.width,
              height: graph.height,
              transform: `scale(${zoom})`,
            }}
          >
            <svg
              className="absolute inset-0 overflow-visible text-muted-foreground/60"
              width={graph.width}
              height={graph.height}
              aria-label="질문 조건 연결"
              role="img"
            >
              <defs>
                <marker
                  id={markerId}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
              </defs>
              {graph.edges.map((edge) => {
                const source = nodesById.get(edge.source)!;
                const target = nodesById.get(edge.target)!;
                const slot = positions.get(edge.target) ?? 0;
                positions.set(edge.target, slot + 1);
                const sx = source.x + source.width;
                const sy = source.y + source.height / 2;
                const tx = target.x;
                const ty = target.y + 52 + slot * 52;
                const joiner =
                  target.question.condition?.mode === 'any'
                    ? ' 또는 '
                    : ' 그리고 ';
                const label = [edge.labels.join(joiner), ...edge.notes]
                  .filter(Boolean)
                  .join(' · ');
                const clauses = (target.question.condition?.clauses ?? [])
                  .filter((clause) => clause.blockId === edge.source)
                  .map((clause) => describeClause(clause, questions));
                return (
                  <g key={`${edge.source}:${edge.target}`}>
                    <title>
                      {questionName(source.question)} →{' '}
                      {questionName(target.question)}: {label}
                    </title>
                    <path
                      d={`M ${sx} ${sy} C ${sx + 50} ${sy}, ${tx - 355} ${ty}, ${tx - 310} ${ty} L ${tx - 5} ${ty}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      markerEnd={`url(#${markerId})`}
                    />
                    <foreignObject
                      x={tx - 305}
                      y={ty - 41}
                      width={290}
                      height={40}
                    >
                      <div
                        className="line-clamp-2 rounded bg-background/95 px-2 py-1 text-center text-[11px] leading-4 text-muted-foreground"
                        title={label}
                      >
                        {clauses.map((clause, index) => (
                          <Fragment key={index}>
                            {index > 0 && joiner}
                            <Badge
                              variant="secondary"
                              className="h-4 max-w-28 px-1.5 py-0 align-middle text-[10px]"
                            >
                              <span
                                className="truncate"
                                title={clause.fieldLabel}
                              >
                                {clause.fieldLabel}
                              </span>
                            </Badge>
                            {clause.particle}{' '}
                            {clause.valueLabel !== null &&
                              `‘${clause.valueLabel}’ `}
                            {clause.suffix}
                          </Fragment>
                        ))}
                        {edge.notes.length > 0 && (
                          <>
                            {clauses.length > 0 && ' · '}
                            {edge.notes.join(' · ')}
                          </>
                        )}
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
            {graph.nodes.map(({ question: q, x, y, width, height }) => {
              const content = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 break-words text-sm font-semibold">
                      {questionName(q)}
                    </span>
                    {!matched.has(q.id) && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        앞선 질문
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {richTextPlainText(q.prompt)}
                  </p>
                  {(q.condition?.clauses.length ?? 0) > 1 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {q.condition?.mode === 'any'
                        ? '조건 중 하나 충족'
                        : '모든 조건 충족'}
                    </p>
                  )}
                </>
              );
              const className = `absolute overflow-hidden rounded-xl border bg-background p-4 text-left shadow-sm ${matched.has(q.id) ? 'border-neutral-300 dark:border-neutral-600' : 'border-dashed'} `;
              return canManage(q) ? (
                <button
                  key={q.id}
                  type="button"
                  style={{ left: x, top: y, width, height }}
                  className={`${className} cursor-pointer transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
                  onClick={() => onOpen(q)}
                  title={questionName(q)}
                  aria-label={`${questionName(q)} 수정`}
                >
                  {content}
                </button>
              ) : (
                <div
                  key={q.id}
                  style={{ left: x, top: y, width, height }}
                  className={className}
                  title={questionName(q)}
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

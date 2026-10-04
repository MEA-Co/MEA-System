'use client';

import { Plus, Rows3 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { careerFlowPlaceholder } from '../../lib/career-flow-placeholders';

import {
  QuestionAnswerTable,
  type QuestionAnswerTableProps,
} from './QuestionAnswerTable';

const middle = 'f4689fea-ba91-400f-82be-f0b1dbf185db';
const beforeHigh = '720f88bd-1ace-4b86-828f-5df7abbe0a10';
const admission = 'e75649e4-82f5-4175-8c14-2298c522a45d';
const groups = [
  '고교 입학 전',
  '고1-1',
  '고1-2',
  '고2-1',
  '고2-2',
  '고3-1',
  '고3-2',
  '졸업 후',
];

export function CareerFlowThread(props: QuestionAnswerTableProps) {
  const { document, rows, renderField, summary, disabled, waiting } = props;
  const hasAnswer = (id: string) => {
    const field = document.fields.find((item) => item.id === id);
    return (
      !!field && rows.some((row) => !!summary(field, row.answers[id] ?? ''))
    );
  };
  const [start, setStart] = useState(() =>
    document.fields.some((field) => field.id === beforeHigh) &&
    hasAnswer(beforeHigh) &&
    !hasAnswer(middle)
      ? beforeHigh
      : middle,
  );
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const visible = document.fields.filter(
    (field) =>
      field.id === start ||
      field.id === admission ||
      added.includes(field.id) ||
      hasAnswer(field.id),
  );
  const groupFor = (id: string, label: string) =>
    id === middle || id === beforeHigh
      ? groups[0]
      : (groups.find((group) => label.replace(/\s/g, '').startsWith(group)) ??
        '졸업 후');
  const requiredDone =
    Number(
      [middle, beforeHigh].some(
        (id) =>
          document.fields.some((field) => field.id === id) && hasAnswer(id),
      ),
    ) +
    Number(
      document.fields.some((field) => field.id === admission) &&
        hasAnswer(admission),
    );
  if (waiting)
    return (
      <p className="text-sm text-muted-foreground">
        앞선 질문에 응답하면 진로 흐름을 작성할 수 있어요.
      </p>
    );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Dialog open={open && !waiting} onOpenChange={setOpen}>
        <DialogTrigger
          render={<Button type="button" variant="outline" disabled={waiting} />}
        >
          <Rows3 aria-hidden="true" />
          {disabled ? '스레드로 답변 보기' : '스레드로 응답하기'}
        </DialogTrigger>
        <DialogContent className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-4 rounded-2xl bg-neutral-100 p-4 sm:max-w-none sm:p-6 dark:bg-neutral-950">
          <DialogHeader className="shrink-0 pr-10">
            <DialogTitle>{document.title || '진로 흐름'}</DialogTitle>
            <DialogDescription>
              시기별로 진로 흐름을 작성하세요. 닫아도 입력 내용은 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-6">
              <p className="text-sm leading-6 text-muted-foreground">
                진로 희망이{' '}
                <strong className="text-foreground">
                  처음 생긴 때 · 바뀐 때 · 확정된 때
                </strong>
                , 그리고 기억에 남는 대응이 있었던 때만 골라 적어주세요.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  [
                    '모든 시기를 채울 필요는 없어요',
                    '고교 입학 전과 수시 원서 접수 시기는 필수예요. 나머지는 필요한 시기만 추가하세요.',
                  ],
                  [
                    '시기는 최대한 정확하게',
                    '학기를 누르면 중간·기말고사 전후로 나누어 고를 수 있어요.',
                  ],
                  [
                    '빈 구간은 변화 없음으로 봐요',
                    '추가한 시기 사이에는 앞 시기의 희망이 이어진 것으로 봐요.',
                  ],
                ].map(([title, description], index) => (
                  <div
                    key={title}
                    className="rounded-2xl border bg-background p-5"
                  >
                    <p className="font-medium">
                      <span className="mr-2 rounded bg-muted px-2 py-0.5 text-muted-foreground">
                        {index + 1}
                      </span>
                      {title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                ))}
              </div>
              <section
                className="rounded-2xl border bg-background p-5"
                aria-label="시기 추가하기"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">시기 추가하기</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      학기를 누르면 세부 시기가 펼쳐져요 ·{' '}
                      <span className="text-amber-700">● 필수</span> ·{' '}
                      <span className="text-blue-600">● 작성함</span>
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                  {groups.map((group) => {
                    const fields = document.fields.filter(
                      (field) => groupFor(field.id, field.label) === group,
                    );
                    if (!fields.length) return null;
                    return (
                      <button
                        key={group}
                        type="button"
                        aria-expanded={expandedGroup === group}
                        onClick={() =>
                          setExpandedGroup(
                            expandedGroup === group ? null : group,
                          )
                        }
                        className={`rounded-xl border p-3 text-sm font-medium hover:bg-muted ${expandedGroup === group ? 'border-primary bg-muted' : ''}`}
                      >
                        {group}
                        <span className="mt-1 flex justify-center gap-1">
                          {fields.map((field) => (
                            <span
                              key={field.id}
                              className={`text-xs ${hasAnswer(field.id) ? 'text-blue-600' : [start, admission].includes(field.id) ? 'text-amber-700' : 'text-muted-foreground/40'}`}
                            >
                              ●
                            </span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {expandedGroup && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                    {document.fields
                      .filter(
                        (field) =>
                          groupFor(field.id, field.label) === expandedGroup,
                      )
                      .map((field) => (
                        <Button
                          key={field.id}
                          type="button"
                          variant="outline"
                          disabled={
                            disabled ||
                            visible.some((item) => item.id === field.id)
                          }
                          onClick={() =>
                            setAdded((current) => [...current, field.id])
                          }
                        >
                          <Plus className="size-4" />
                          {field.label}
                          {visible.some((item) => item.id === field.id)
                            ? ' · 표시 중'
                            : ''}
                        </Button>
                      ))}
                  </div>
                )}
              </section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    필수 시기 {requiredDone}/2 작성
                  </span>
                  <span className="rounded-full border px-3 py-2">
                    추가한 시기{' '}
                    {
                      visible.filter(
                        (field) => field.id !== start && field.id !== admission,
                      ).length
                    }
                    개
                  </span>
                  <span className="rounded-full border px-3 py-2 text-muted-foreground">
                    변화 없음 {document.fields.length - visible.length}개 시기
                  </span>
                </div>
              </div>
              <div className="ml-2 space-y-5 border-l-2 border-muted pl-6 sm:pl-8">
                {visible.map((field, fieldIndex) => {
                  const initial = field.id === start;
                  const required = initial || field.id === admission;
                  const previous = visible[fieldIndex - 1];
                  const gap = previous
                    ? document.fields.indexOf(field) -
                      document.fields.indexOf(previous) -
                      1
                    : 0;
                  const input = (row: (typeof rows)[number], index: number) => (
                    <div key={row.id} className="space-y-2">
                      <p className="text-sm font-medium">
                        {document.rowLabels?.[index] || `답변 ${index + 1}`}
                      </p>
                      {renderField(
                        row,
                        field,
                        document.fields.indexOf(field),
                        careerFlowPlaceholder(
                          document.id,
                          document.rowLabels?.[index] ?? '',
                          field.id,
                        ) || '어떤 일이 있었고, 어떻게 생각하고 대응했나요?',
                      )}
                    </div>
                  );
                  return (
                    <div key={field.id}>
                      {gap > 0 && (
                        <p className="mb-5 text-xs text-muted-foreground">
                          {gap}개 시기 · 변화 없음 · 위에서 시기를 추가할 수
                          있어요
                        </p>
                      )}
                      <section className="relative rounded-2xl border bg-background p-5 sm:p-6">
                        <span
                          className={`absolute top-6 -left-[34px] size-4 rounded-full border-[3px] bg-background sm:-left-[42px] ${required ? 'border-amber-700' : 'border-blue-600'}`}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-semibold">
                            {initial
                              ? '고교 입학 전 · 진로의 출발점'
                              : field.label}
                          </h4>
                          {required ? (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                              필수
                            </span>
                          ) : (
                            !hasAnswer(field.id) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={disabled}
                                onClick={() =>
                                  setAdded((current) =>
                                    current.filter((id) => id !== field.id),
                                  )
                                }
                              >
                                시기 숨기기
                              </Button>
                            )
                          )}
                        </div>
                        {initial && (
                          <div className="mt-3 space-y-3">
                            <p className="text-sm text-muted-foreground">
                              기억나는 시작 시기 하나를 골라 적어주세요. 두 시기
                              모두 경험이 있다면 다른 시기도 추가할 수 있어요.
                            </p>
                            <div className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1">
                              {document.fields
                                .filter((item) =>
                                  [middle, beforeHigh].includes(item.id),
                                )
                                .map((item) => (
                                  <Button
                                    key={item.id}
                                    type="button"
                                    size="sm"
                                    variant={
                                      start === item.id ? 'secondary' : 'ghost'
                                    }
                                    disabled={disabled}
                                    aria-pressed={start === item.id}
                                    onClick={() => setStart(item.id)}
                                  >
                                    {item.id === middle
                                      ? '중등'
                                      : '예비 고1 (중3 11월~)'}
                                  </Button>
                                ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-5 space-y-5">
                          {rows.slice(0, 3).map(input)}
                          {rows.length > 3 && (
                            <details
                              className="border-t border-dashed pt-4"
                              open={
                                rows
                                  .slice(3)
                                  .some(
                                    (row) =>
                                      !!summary(
                                        field,
                                        row.answers[field.id] ?? '',
                                      ),
                                  ) || undefined
                              }
                            >
                              <summary className="cursor-pointer text-sm text-muted-foreground">
                                더 남기기 (선택) · 대입에 준 영향, 이 시기 조언
                              </summary>
                              <div className="mt-4 space-y-5">
                                {rows
                                  .slice(3)
                                  .map((row, index) => input(row, index + 3))}
                              </div>
                            </details>
                          )}
                        </div>
                      </section>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 justify-end">
            <DialogClose render={<Button type="button" />}>닫기</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      <QuestionAnswerTable
        {...props}
        triggerLabel={disabled ? '표로 답변 보기' : '표로 응답하기'}
      />
    </div>
  );
}

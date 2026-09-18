'use client';

import { ArrowLeft, NotebookPen, Plus, Search, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';

const groups = [
  {
    title: '기본 정보',
    description: '탐구 주제와 생활기록부에 기재할 영역을 입력해 주세요.',
    fields: [
      {
        key: 'topic',
        label: '주제',
        placeholder: '탐구활동의 주제를 입력해 주세요',
        required: true,
      },
      { key: 'grade', label: '기재 영역 · 학년', placeholder: '예: 2학년' },
      { key: 'semester', label: '기재 영역 · 학기', placeholder: '예: 1학기' },
      {
        key: 'recordType',
        label: '기재 영역 · 창체 또는 세특',
        placeholder: '예: 창체, 세특',
      },
      {
        key: 'recordArea',
        label: '기재 영역 · 활동 영역 또는 교과명',
        placeholder: '예: 자율자치, 동아리, 진로, 화학Ⅰ',
      },
      {
        key: 'competencies',
        label: '역량',
        placeholder: '예: 비판적 사고력, 자료 분석력',
      },
    ],
  },
  {
    title: '활동 내용',
    description: '세특 원문과 탐구 과정에서 드러난 생각을 기록해 주세요.',
    fields: [
      {
        key: 'record',
        label: '세특 원문',
        placeholder: '세특 원문을 입력해 주세요',
        multiline: true,
      },
      {
        key: 'story',
        label: '스토리',
        placeholder:
          '챌린지 극복 과정, 활동을 우수하게 만들기 위한 모든 생각과 고민 과정을 입력해 주세요',
        multiline: true,
      },
      {
        key: 'motivation',
        label: '포지셔닝 · 계기',
        placeholder:
          '이 탐구활동을 시작하게 된 계기와 이전 활동과의 연결을 입력해 주세요',
        multiline: true,
      },
      {
        key: 'followup',
        label: '포지셔닝 · 후속 연계 활동',
        placeholder: '탐구 이후 이어갈 활동을 입력해 주세요',
        multiline: true,
      },
    ],
  },
  {
    title: '탐구 유형과 참고자료',
    description: '탐구 방식과 참고자료, 활동에 대한 진단을 정리해 주세요.',
    fields: [
      {
        key: 'inquiryType',
        label: '탐구 유형',
        placeholder: '예: 이론형, 사례응용형, 가치관형 등 택일',
      },
      {
        key: 'inquirySubtype',
        label: '탐구 세부 유형',
        placeholder:
          '예: 프로토타입 제작형, 실험형, 사례 비교형, 데이터 활용형, 문제 해결·정책 제언형, 인터뷰형 등',
      },
      {
        key: 'references',
        label: '참고자료와 각각의 활용 방안',
        placeholder:
          '자료명 또는 링크와 해당 자료를 어떻게 활용했는지 입력해 주세요',
        multiline: true,
      },
      {
        key: 'selfAssessment',
        label: '자가 진단',
        placeholder:
          '탐구의 강점과 부족한 점, 대입에 영향을 미쳤다고 생각하는 요소 등을 입력해 주세요',
        multiline: true,
      },
    ],
  },
] satisfies {
  title: string;
  description: string;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    required?: boolean;
    multiline?: boolean;
  }[];
}[];

type FieldKey = (typeof groups)[number]['fields'][number]['key'];
type Activity = { clientKey: number; values: Record<FieldKey, string> };
const emptyValues = () =>
  Object.fromEntries(
    groups.flatMap((group) => group.fields.map((field) => [field.key, ''])),
  ) as Activity['values'];

export function ExplorationWorkspace() {
  const nextClientKey = useRef(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [draft, setDraft] = useState<Activity | null>(null);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const existing = activities.find(
    (activity) => activity.clientKey === draft?.clientKey,
  );
  const filtered = activities.filter((activity) =>
    Object.values(activity.values).some((value) =>
      value.toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );

  function returnToList() {
    if (
      draft &&
      JSON.stringify(draft.values) !==
        JSON.stringify(existing?.values ?? emptyValues())
    ) {
      setConfirmDiscard(true);
    } else {
      setDraft(null);
    }
  }

  return (
    <section
      aria-labelledby="exploration-management-title"
      className="space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">운영 관리</p>
          <h1
            id="exploration-management-title"
            className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl"
          >
            {draft
              ? existing
                ? '탐구활동 상세 · 수정'
                : '탐구활동 작성'
              : '탐구활동 관리'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {draft
              ? '탐구의 과정과 결과를 한곳에 정리해 주세요.'
              : '탐구활동을 추가하고 작성한 내용을 확인하세요.'}
          </p>
        </div>
        {!draft && (
          <Button
            onClick={() =>
              setDraft({
                clientKey: nextClientKey.current++,
                values: emptyValues(),
              })
            }
          >
            <Plus aria-hidden="true" />
            탐구활동 추가
          </Button>
        )}
      </div>
      <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        화면 미리보기 단계입니다. 입력한 내용은 현재 화면에서만 유지되며,
        새로고침하거나 다른 메뉴로 이동하면 초기화됩니다.
      </p>
      {draft ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.values.topic.trim()) return;
            const saved = {
              ...draft,
              values: { ...draft.values, topic: draft.values.topic.trim() },
            };
            setActivities((current) =>
              existing
                ? current.map((activity) =>
                    activity.clientKey === saved.clientKey ? saved : activity,
                  )
                : [saved, ...current],
            );
            setDraft(null);
            toast.add({
              title: existing
                ? '탐구활동을 수정했습니다.'
                : '탐구활동을 추가했습니다.',
              type: 'success',
            });
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={returnToList}
            >
              <ArrowLeft aria-hidden="true" />
              목록으로
            </Button>
          </div>
          {groups.map((group, index) => (
            <section
              key={group.title}
              aria-labelledby={`activity-group-${index}`}
              className="rounded-2xl border p-5 md:p-6"
            >
              <h2 id={`activity-group-${index}`} className="font-semibold">
                {group.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {group.description}
              </p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {group.fields.map((field) => {
                  const multiline = 'multiline' in field && field.multiline;
                  const required = 'required' in field && field.required;
                  const props = {
                    id: `activity-${field.key}`,
                    name: field.key,
                    value: draft.values[field.key],
                    placeholder: field.placeholder,
                    required,
                    onChange: (
                      event: React.ChangeEvent<
                        HTMLInputElement | HTMLTextAreaElement
                      >,
                    ) =>
                      setDraft({
                        ...draft,
                        values: {
                          ...draft.values,
                          [field.key]: event.target.value,
                        },
                      }),
                  };
                  return (
                    <div
                      key={field.key}
                      className={
                        multiline || field.key === 'topic'
                          ? 'space-y-2 md:col-span-2'
                          : 'space-y-2'
                      }
                    >
                      <Label htmlFor={props.id}>
                        {field.label}
                        {required && (
                          <span className="text-xs text-muted-foreground">
                            필수
                          </span>
                        )}
                      </Label>
                      {multiline ? (
                        <Textarea
                          {...props}
                          className="min-h-32 resize-y rounded-xl"
                        />
                      ) : (
                        <Input {...props} className="rounded-xl" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <div className="flex justify-end gap-2 border-t pt-5">
            <Button type="button" variant="outline" onClick={returnToList}>
              취소
            </Button>
            <Button type="submit" disabled={!draft.values.topic.trim()}>
              {existing ? '변경 내용 저장' : '목록에 추가'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold">
              탐구활동 목록{' '}
              <Badge variant="secondary">{activities.length}</Badge>
            </h2>
            <div className="relative w-full sm:w-72">
              <Search
                aria-hidden="true"
                className="absolute top-2.5 left-3 size-4 text-muted-foreground"
              />
              <Input
                aria-label="탐구활동 검색"
                placeholder="주제, 교과명, 활동 내용 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="rounded-xl pl-9"
              />
            </div>
          </div>
          {filtered.length ? (
            <ul className="divide-y rounded-2xl border">
              {filtered.map((activity) => (
                <li
                  key={activity.clientKey}
                  className="flex flex-wrap items-center gap-4 p-5"
                >
                  <div className="min-w-0 flex-1 basis-60">
                    <button
                      className="rounded-sm text-left font-semibold break-words hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() =>
                        setDraft({
                          ...activity,
                          values: { ...activity.values },
                        })
                      }
                    >
                      {activity.values.topic}
                    </button>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[
                        activity.values.grade,
                        activity.values.semester,
                        activity.values.recordType,
                        activity.values.recordArea,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '기재 영역 미입력'}
                    </p>
                    {activity.values.record && (
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {activity.values.record}
                      </p>
                    )}
                    {activity.values.inquiryType && (
                      <Badge variant="outline" className="mt-3">
                        {activity.values.inquiryType}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraft({
                          ...activity,
                          values: { ...activity.values },
                        })
                      }
                    >
                      상세 · 수정
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`${activity.values.topic} 삭제`}
                      onClick={() => setPendingDelete(activity)}
                    >
                      <Trash2 aria-hidden="true" />
                      삭제
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
              <NotebookPen
                aria-hidden="true"
                className="mb-4 size-8 text-muted-foreground"
              />
              <h3 className="font-medium">
                {activities.length
                  ? '검색 결과가 없습니다'
                  : '아직 등록한 탐구활동이 없습니다'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {activities.length
                  ? '다른 검색어로 찾아보세요.'
                  : '첫 탐구활동을 추가하고 내용을 작성해 보세요.'}
              </p>
              {!activities.length && (
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() =>
                    setDraft({
                      clientKey: nextClientKey.current++,
                      values: emptyValues(),
                    })
                  }
                >
                  <Plus aria-hidden="true" />
                  탐구활동 추가
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>탐구활동을 삭제할까요?</DialogTitle>
            <DialogDescription className="break-words">
              ‘{pendingDelete?.values.topic}’의 작성 내용이 목록에서 삭제됩니다.
              삭제한 내용은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setActivities((current) =>
                  current.filter(
                    (activity) =>
                      activity.clientKey !== pendingDelete?.clientKey,
                  ),
                );
                setPendingDelete(null);
                toast.add({
                  title: '탐구활동을 삭제했습니다.',
                  type: 'success',
                });
              }}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>작성을 취소할까요?</DialogTitle>
            <DialogDescription>
              저장하지 않은 변경 내용이 사라집니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              계속 작성
            </Button>
            <Button
              onClick={() => {
                setConfirmDiscard(false);
                setDraft(null);
              }}
            >
              변경 내용 버리기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

'use client';
import { useId, useState } from 'react';
import useSWR from 'swr';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { questionnaireFetcher } from '../../lib/questionnaire/api-client';
import type { SubmissionReference } from '../../lib/questionnaire/types';
import { richTextPlainText } from '../../lib/rich-text';

type Item = { id: string; title: string };
type SourceQuestion = Item & {
  prompt: string;
  fields: { id: string; label: string }[];
};
const options = {
  refreshInterval: 0,
  revalidateOnFocus: false,
  shouldRetryOnError: false,
};
export function SubmissionReferencePicker({
  questionnaireId,
  value,
  disabled,
  onChange,
}: {
  questionnaireId: string;
  value?: SubmissionReference;
  disabled: boolean;
  onChange: (value?: SubmissionReference) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SubmissionReference>({
    questionnaireId: '',
    questionId: '',
    fieldIds: [],
  });
  const current = open ? draft : value;
  const url = `/api/questionnaires/${questionnaireId}/reference-sources`;
  const sources = useSWR<Item[]>(
    open || value ? url : null,
    questionnaireFetcher,
    options,
  );
  const questions = useSWR<SourceQuestion[]>(
    current?.questionnaireId
      ? url + '?source=' + current.questionnaireId
      : null,
    questionnaireFetcher,
    options,
  );
  const selected = questions.data?.find((q) => q.id === current?.questionId);
  const title = (q: SourceQuestion) =>
    q.title || richTextPlainText(q.prompt).slice(0, 120) || '제목 없는 질문';
  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">이전 제출 답변</legend>
      {!open && (
        <>
          {value && (
            <p className="text-sm">
              {sources.data?.find((s) => s.id === value.questionnaireId)?.title}{' '}
              · {selected ? title(selected) : '연결된 질문'} ·{' '}
              {value.fieldIds.length}개 항목
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(
                value ?? { questionnaireId: '', questionId: '', fieldIds: [] },
              );
              setOpen(true);
            }}
          >
            {value ? '연결 수정' : '이전 제출 답변 추가'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(undefined)}
            >
              연결 해제
            </Button>
          )}
        </>
      )}
      {open && (
        <>
          <div className="grid gap-2">
            <Label htmlFor={id + '-source'}>이전 배포 질문지</Label>
            <Select
              value={draft.questionnaireId || null}
              disabled={disabled || !sources.data?.length}
              onValueChange={(value) =>
                setDraft({
                  questionnaireId: value ?? '',
                  questionId: '',
                  fieldIds: [],
                })
              }
            >
              <SelectTrigger id={id + '-source'} className="w-full min-w-0">
                <SelectValue placeholder="질문지 선택">
                  {
                    sources.data?.find((s) => s.id === draft.questionnaireId)
                      ?.title
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sources.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {draft.questionnaireId && (
            <div className="grid gap-2">
              <Label htmlFor={id + '-question'}>참조할 질문</Label>
              <Select
                value={draft.questionId || null}
                disabled={disabled || !questions.data?.length}
                onValueChange={(value) => {
                  const question = questions.data?.find((q) => q.id === value);
                  setDraft({
                    ...draft,
                    questionId: question?.id ?? '',
                    fieldIds: question?.fields.map((f) => f.id) ?? [],
                  });
                }}
              >
                <SelectTrigger id={id + '-question'} className="w-full min-w-0">
                  <SelectValue placeholder="질문 선택">
                    {selected ? title(selected) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {questions.data?.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {title(q)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {selected && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">보여줄 항목</legend>
              {selected.fields.map((field) => (
                <Label key={field.id} className="w-fit">
                  <Checkbox
                    checked={draft.fieldIds.includes(field.id)}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      setDraft({
                        ...draft,
                        fieldIds: checked
                          ? [...draft.fieldIds, field.id]
                          : draft.fieldIds.filter((id) => id !== field.id),
                      })
                    }
                  />
                  {field.label}
                </Label>
              ))}
            </fieldset>
          )}
          {(sources.isLoading || questions.isLoading) && (
            <p>목록을 불러오는 중이에요.</p>
          )}
          {sources.data?.length === 0 && <p>선택할 배포 질문지가 없어요.</p>}
          {questions.data?.length === 0 && <p>선택할 응답형 질문이 없어요.</p>}
          <Button
            type="button"
            disabled={!selected || !draft.fieldIds.length}
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            안내에 적용
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            취소
          </Button>
        </>
      )}
      {(sources.error || questions.error) && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (sources.error) void sources.mutate();
            if (questions.error) void questions.mutate();
          }}
        >
          목록 다시 불러오기
        </Button>
      )}
    </fieldset>
  );
}

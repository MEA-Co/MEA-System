'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type {
  QuestionnaireNotice,
  QuestionnaireSection,
} from '../../lib/questionnaire/types';
import { QuestionRichTextEditor } from '../question/QuestionRichTextEditor';

import { QuestionnaireNoticeImages } from './QuestionnaireNoticeImages';

export function QuestionnaireNoticeEditor({
  notice,
  questionnaireId,
  beforeUpload,
  onBusyChange,
  sections,
  disabled,
  onChange,
  onDelete,
}: {
  notice: QuestionnaireNotice;
  questionnaireId: string;
  beforeUpload: () => Promise<boolean>;
  onBusyChange: (busy: boolean) => void;
  sections: QuestionnaireSection[];
  disabled: boolean;
  onChange: (notice: QuestionnaireNotice) => void;
  onDelete: () => void;
}) {
  const positions = [
    { value: 'start', label: '질문지 처음' },
    ...sections.flatMap((section, si) =>
      section.questions.map((question, qi) => ({
        value: question.id,
        label: `${section.title || `섹션 ${si + 1}`} · 질문 ${qi + 1} 다음`,
      })),
    ),
    { value: 'end', label: '질문지 마지막' },
  ];
  const position =
    positions.find((item) => item.value === notice.position) ??
    positions.at(-1)!;
  return (
    <Card variant="accent">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`notice-title-${notice.id}`}>안내</Label>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="안내 삭제"
            disabled={disabled}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
        <Select
          value={position.value}
          onValueChange={(value) =>
            value && onChange({ ...notice, position: value })
          }
          disabled={disabled}
        >
          <SelectTrigger aria-label="안내 위치">
            <SelectValue>{position.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {positions.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={`notice-title-${notice.id}`}
          aria-label="안내 제목"
          placeholder="안내 제목"
          maxLength={200}
          value={notice.title}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...notice, title: event.target.value })
          }
        />
        <QuestionRichTextEditor
          id={`notice-body-${notice.id}`}
          ariaLabel="안내 내용"
          value={notice.body}
          disabled={disabled}
          onChange={(body) => onChange({ ...notice, body })}
        />
        <QuestionnaireNoticeImages
          questionnaireId={questionnaireId}
          noticeId={notice.id}
          images={notice.images ?? []}
          disabled={disabled}
          beforeUpload={beforeUpload}
          onBusyChange={onBusyChange}
          onChange={(images) => onChange({ ...notice, images })}
        />
        {(
          [
            ['buttonLabel', '학습법', '학습법 추가'],
            ['explorationButtonLabel', '탐구활동', '탐구활동 추가'],
            ['linkButtonLabel', '탐구줄기', '탐구줄기 등록'],
          ] as const
        ).map(([field, name, defaultLabel]) => (
          <div key={field} className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!notice[field]}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange({ ...notice, [field]: checked ? defaultLabel : '' })
                }
              />
              {name} 등록 버튼 표시
            </label>
            {!!notice[field] && (
              <Input
                aria-label={`${name} 등록 버튼 문구`}
                maxLength={100}
                value={notice[field]}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...notice, [field]: event.target.value })
                }
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

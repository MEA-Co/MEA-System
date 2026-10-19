'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useSkillDiscard } from '../hooks/useSkillDiscard';

import type { LinkSkillset } from './ExplorationLinkGraph';

export function ExplorationSkillEditDialog({
  skill,
  usageCount,
  onSave,
  onClose,
  onReplace,
  onDirtyChange,
}: {
  skill: LinkSkillset;
  usageCount: number;
  onSave: (skill: LinkSkillset) => void;
  onClose: () => void;
  onReplace: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const id = useId();
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const { requestDiscard, discardDialog } = useSkillDiscard(
    name !== skill.name || description !== skill.description,
    onDirtyChange,
  );
  return (
    <>
      {discardDialog}
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) requestDiscard(onClose);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>탐구활동 연계 스킬셋 수정</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim() && description.trim())
                onSave({
                  ...skill,
                  name: name.trim(),
                  description: description.trim(),
                });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${id}-name`}>
                연계 스킬 이름 <span className="text-destructive">*</span>
                <span className="sr-only">필수</span>
              </Label>
              <Input
                id={`${id}-name`}
                required
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-description`}>
                설명 <span className="text-destructive">*</span>
                <span className="sr-only">필수</span>
              </Label>
              <Textarea
                id={`${id}-description`}
                required
                maxLength={5000}
                className="min-h-32"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            {(usageCount > 1 || !!skill.updatedAt) && (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {skill.updatedAt
                  ? '수정 후 탐구줄기를 확정하면 이 스킬을 사용하는 다른 탐구줄기에도 함께 반영됩니다.'
                  : `이 스킬은 현재 ${usageCount}개 연결에서 사용 중이에요. 수정하면 모두 함께 반영됩니다.`}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => requestDiscard(onReplace)}
              >
                다른 스킬로 변경
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => requestDiscard(onClose)}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={!name.trim() || !description.trim()}
                >
                  수정 적용
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

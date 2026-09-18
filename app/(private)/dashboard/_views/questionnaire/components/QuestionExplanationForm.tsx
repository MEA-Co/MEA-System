'use client';

import { Pencil, Plus, Save, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';

import { useQuestionnaireApi } from '../lib/api-client';
import type { QuestionDetail } from '../lib/types';

import { QuestionAnnotationEditor } from './QuestionAnnotationEditor';

export function QuestionExplanationForm({
  versionId,
  questionId,
  count,
  detail,
  revision,
  defaultEditing = false,
  onClose,
}: {
  versionId: string;
  questionId: string;
  count: number;
  detail?: QuestionDetail;
  revision?: number;
  defaultEditing?: boolean;
  onClose?: () => void;
}) {
  const { command } = useQuestionnaireApi();
  const [editRevision, setEditRevision] = useState(revision);
  const [editing, setEditing] = useState(defaultEditing);
  const [title, setTitle] = useState(detail?.title ?? '');
  const [description, setDescription] = useState(detail?.text ?? '');
  const [visible, setVisible] = useState(detail?.visibleToConsultants ?? false);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  function reset() {
    setEditing(false);
    setTitle('');
    setDescription('');
    setVisible(false);
    request.current = null;
    onClose?.();
  }
  async function submit() {
    if (inFlight.current || !title.trim() || !description.trim()) return;
    inFlight.current = true;
    setPending(true);
    const toastId = toast.add({
      type: 'loading',
      title: detail ? '설명을 수정하고 있어요.' : '설명을 추가하고 있어요.',
      timeout: 0,
    });
    try {
      const payload = {
        questionId,
        title: title.trim(),
        description: description.trim(),
        visibleToConsultants: visible,
      };
      const key = JSON.stringify(payload);
      if (request.current?.key !== key)
        request.current = { key, id: crypto.randomUUID() };
      const result = detail
        ? await command(`/${versionId}/explanations/${detail.id}`, 'PATCH', {
            ...payload,
            revision: editRevision,
          })
        : await command(`/${versionId}/explanations`, 'POST', {
            ...payload,
            id: request.current.id,
          });
      if (result.error) {
        toast.update(toastId, {
          type: 'error',
          title: result.error,
          timeout: 8000,
        });
        return;
      }
      reset();
      toast.update(toastId, {
        type: 'success',
        title: detail ? '설명을 수정했어요.' : '설명을 추가했어요.',
        timeout: 3000,
      });
    } catch {
      toast.update(toastId, {
        type: 'error',
        title: '저장 결과를 확인하지 못했어요. 다시 시도해 주세요.',
        timeout: 8000,
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <div className={detail ? 'mt-4' : 'mt-4 border-l-2 border-muted pl-4'}>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <QuestionAnnotationEditor
            id={`explanation-${detail?.id ?? questionId}`}
            label="설명 항목"
            title={title}
            text={description}
            onTitleChange={setTitle}
            onTextChange={setDescription}
            required
            disabled={pending}
            titleMaxLength={500}
            textMaxLength={20000}
            actions={
              <>
                <label
                  htmlFor={`explanation-visible-${detail?.id ?? questionId}`}
                  className={`mr-2 cursor-pointer text-xs font-medium ${visible ? 'text-blue-600' : 'text-muted-foreground'}`}
                >
                  {visible ? '컨설턴트 공개' : '컨설턴트 비공개'}
                </label>
                <Switch
                  id={`explanation-visible-${detail?.id ?? questionId}`}
                  checked={visible}
                  onCheckedChange={setVisible}
                  disabled={pending}
                  className="data-checked:bg-blue-600 focus-visible:ring-blue-500/50"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending}
                  aria-label="설명 작성 취소"
                  onClick={reset}
                >
                  <X aria-hidden="true" />
                </Button>
              </>
            }
          >
            <div className="mt-3 flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={pending || !title.trim() || !description.trim()}
              >
                <Save aria-hidden="true" />
                {detail ? '수정 저장' : '설명 추가'}
              </Button>
            </div>
          </QuestionAnnotationEditor>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={!detail && count >= 30}
          onClick={() => {
            setTitle(detail?.title ?? '');
            setDescription(detail?.text ?? '');
            setVisible(detail?.visibleToConsultants ?? false);
            setEditRevision(revision);
            setEditing(true);
          }}
        >
          {detail ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {detail ? '설명 수정' : '설명 항목 추가'}
        </Button>
      )}
    </div>
  );
}

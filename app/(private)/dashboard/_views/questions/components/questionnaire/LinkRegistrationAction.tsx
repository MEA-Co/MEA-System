'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

export function LinkRegistrationAction({
  label,
  beforeNavigate,
  disabled = false,
}: {
  label: string;
  beforeNavigate?: () => Promise<boolean>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  async function open() {
    if (busy.current || disabled) return;
    busy.current = true;
    setSaving(true);
    try {
      if (beforeNavigate && !(await beforeNavigate())) {
        toast.add({
          type: 'error',
          title: '저장을 완료한 뒤 탐구줄기를 등록할 수 있어요.',
          description: '현재 화면의 저장 상태를 확인해 주세요.',
        });
        return;
      }
      router.push('/dashboard?view=exploration&tab=links&linkEditor=new');
    } catch {
      toast.add({
        type: 'error',
        title: '저장하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.',
      });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <Button
      size="wrap"
      disabled={disabled || saving}
      onClick={open}
    >
      <Plus aria-hidden="true" />
      {saving ? '저장 중…' : label}
    </Button>
  );
}

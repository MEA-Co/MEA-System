'use client';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ConsultingPreviousButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="absolute top-4 left-3 z-30 text-muted-foreground md:left-5"
      aria-label="이전 단계로 돌아가기"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      이전으로
    </Button>
  );
}

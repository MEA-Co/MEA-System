'use client';

import { LoaderCircle } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { MEMBER_ROLE_LABELS } from '@/lib/profile';

import { updateConsultantRole } from '../_actions/update-consultant-role';

type ConsultantRole = 'consultant' | 'consultant_lead';

export function ConsultantRoleSelect({
  memberId,
  memberName,
  role: initialRole,
}: {
  memberId: string;
  memberName: string;
  role: ConsultantRole;
}) {
  const [role, setRole] = useState<ConsultantRole>(initialRole);
  const [serverRole, setServerRole] = useState(initialRole);
  const [pending, startTransition] = useTransition();

  // Revalidation may bring a new role from this or another administrator.
  if (serverRole !== initialRole) {
    setServerRole(initialRole);
    setRole(initialRole);
  }

  const changed = role !== initialRole;

  function saveRole() {
    if (pending || !changed) return;

    const formData = new FormData();
    formData.set('targetId', memberId);
    formData.set('role', role);
    const toastId = toast.add({
      type: 'loading',
      title: '직책을 저장하고 있어요.',
      description: `${memberName} · ${MEMBER_ROLE_LABELS[role]}`,
      timeout: 0,
    });

    startTransition(async () => {
      try {
        const result = await updateConsultantRole({}, formData);
        toast.update(toastId, {
          type: result.error ? 'error' : 'success',
          title: result.error
            ? '직책을 저장하지 못했어요.'
            : '직책을 저장했어요.',
          description: `${memberName} · ${result.error || result.success}`,
          timeout: result.error ? 8000 : 5000,
        });
      } catch {
        toast.update(toastId, {
          type: 'error',
          title: '저장 결과를 확인하지 못했어요.',
          description: `${memberName} · 새로고침 후 직책을 확인해 주세요.`,
          timeout: 8000,
        });
      }
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        saveRole();
      }}
      aria-label={`${memberName}의 직책 변경`}
      aria-busy={pending}
      className="flex flex-col items-start gap-1.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={role}
          disabled={pending}
          onValueChange={(value) => {
            if (value === 'consultant' || value === 'consultant_lead') {
              setRole(value);
            }
          }}
        >
          <SelectTrigger
            aria-label={`${memberName}의 직책`}
            className="w-40 rounded-md border-border bg-background"
          >
            <SelectValue>{MEMBER_ROLE_LABELS[role]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="consultant">
              {MEMBER_ROLE_LABELS.consultant}
            </SelectItem>
            <SelectItem value="consultant_lead">
              {MEMBER_ROLE_LABELS.consultant_lead}
            </SelectItem>
          </SelectContent>
        </Select>
        {changed || pending ? (
          <div className="flex items-center gap-1">
            <Button
              type="submit"
              size="sm"
              className="rounded-md"
              disabled={pending}
              aria-label={`${memberName}의 직책 저장`}
            >
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : null}
              {pending ? '저장 중' : '저장'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-md"
              disabled={pending}
              onClick={() => {
                setRole(initialRole);
              }}
              aria-label={`${memberName}의 직책 변경 취소`}
            >
              취소
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  );
}

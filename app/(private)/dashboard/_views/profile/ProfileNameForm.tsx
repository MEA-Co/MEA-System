'use client';

import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { updateMyName } from './actions';

export function ProfileNameForm({ name }: { name: string }) {
  const [value, setValue] = useState(name);
  const [state, action, pending] = useActionState(updateMyName, {});
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="name"
          aria-label="이름"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
          maxLength={50}
          disabled={pending}
          className="min-w-32 flex-1"
          aria-describedby="profile-name-message"
        />
        <Button
          type="submit"
          size="sm"
          disabled={pending || !value.trim() || value.trim() === name}
        >
          {pending ? '저장 중…' : '저장'}
        </Button>
      </div>
      <p
        id="profile-name-message"
        role="status"
        className={`text-xs ${state.error ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {state.error || state.success}
      </p>
    </form>
  );
}

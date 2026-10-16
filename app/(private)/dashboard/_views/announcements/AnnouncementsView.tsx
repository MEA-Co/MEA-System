'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CollectionHeader } from '@/components/patterns/collection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { readAnnouncement } from '@/lib/announcements/client';
import {
  type Announcement,
  announcementInput,
} from '@/lib/announcements/schema';

function localTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function AnnouncementForm({
  notice,
  onSaved,
}: {
  notice: Announcement;
  onSaved: (value: Announcement) => void;
}) {
  const [title, setTitle] = useState(notice.title);
  const [body, setBody] = useState(notice.body);
  const [enabled, setEnabled] = useState(notice.enabled);
  const [starts, setStarts] = useState(localTime(notice.starts_at));
  const [ends, setEnds] = useState(localTime(notice.ends_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  async function save(stop = false) {
    if (busy) return;
    const toISO = (value: string) =>
      value ? new Date(value).toISOString() : null;
    const input = stop
      ? {
          title: notice.title,
          body: notice.body,
          enabled: false,
          starts_at: notice.starts_at,
          ends_at: notice.ends_at,
          revision: notice.revision,
        }
      : {
          title,
          body,
          enabled,
          starts_at: toISO(starts),
          ends_at: toISO(ends),
          revision: notice.revision,
        };
    const parsed = announcementInput.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/announcements', {
        method: 'PUT',
        signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok) {
        setConflict(response.status === 409);
        throw new Error(result.error ?? '공지를 저장하지 못했습니다.');
      }
      onSaved(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '공지를 저장하지 못했습니다. 입력은 유지됩니다.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadLatest() {
    setBusy(true);
    try {
      onSaved(await readAnnouncement());
    } catch {
      setError('최신 공지를 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="space-y-6"
    >
      <Card variant="accent">
        <CardHeader variant="emphasis">
          <CardTitle>전체 사용자 안내</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset disabled={busy} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="notice-title">제목</Label>
              <Input
                id="notice-title"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="서비스 점검 예정 안내"
                required={enabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notice-body">내용</Label>
              <Textarea
                id="notice-body"
                maxLength={1000}
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="점검 시간과 작성 중인 내용을 저장해야 하는 시점을 안내해 주세요."
                required={enabled}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="notice-start">표시 시작 (선택)</Label>
                <Input
                  id="notice-start"
                  type="datetime-local"
                  value={starts}
                  onChange={(e) => setStarts(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notice-end">표시 종료 (선택)</Label>
                <Input
                  id="notice-end"
                  type="datetime-local"
                  value={ends}
                  onChange={(e) => setEnds(e.target.value)}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              현재 기기 시간 기준입니다. 시작을 비우면 바로 표시하고, 종료를
              비우면 직접 종료할 때까지 표시합니다.
            </p>
            <Label className="flex items-center gap-2">
              <Checkbox
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(Boolean(checked))}
              />
              공지 표시
            </Label>
          </fieldset>
          <p className="text-sm text-muted-foreground">
            저장하면 로그인한 모든 사용자에게 반영됩니다. 예약·종료된 내용도
            회원이 조회할 수 있으므로 공개 가능한 안내만 입력해 주세요.
          </p>
        </CardContent>
      </Card>
      {(title || body) && (
        <Card>
          <CardHeader>
            <CardTitle>미리보기</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold wrap-anywhere">{title}</p>
            <p className="mt-2 text-sm leading-6 whitespace-pre-wrap wrap-anywhere">
              {body}
            </p>
          </CardContent>
        </Card>
      )}
      <div role="status" className="min-h-6 text-sm text-destructive">
        {error}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {conflict && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void loadLatest()}
          >
            입력을 버리고 최신 공지 불러오기
          </Button>
        )}
        {notice.enabled && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void save(true)}
          >
            현재 공지 종료
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}공지 저장
        </Button>
      </div>
    </form>
  );
}

export function AnnouncementsView() {
  const [notice, setNotice] = useState<Announcement | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    setError('');
    try {
      setNotice(await readAnnouncement());
    } catch {
      setError('공지를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    void readAnnouncement()
      .then((value) => {
        if (!cancelled) setNotice(value);
      })
      .catch(() => {
        if (!cancelled) setError('공지를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <section className="space-y-6" aria-labelledby="announcements-title">
      <CollectionHeader
        id="announcements-title"
        title="서비스 공지"
        description="배포 없이 점검 일정과 서비스 안내를 전달하세요."
      />
      <div role="status" className="min-h-6 text-sm text-muted-foreground">
        {message}
      </div>
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : notice ? (
        <AnnouncementForm
          key={notice.revision}
          notice={notice}
          onSaved={(value) => {
            setNotice(value);
            setMessage('최신 공지가 반영되었습니다.');
          }}
        />
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <p role="alert">{error}</p>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw />
              다시 불러오기
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

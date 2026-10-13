import { Eye, Pencil, Trash2 } from 'lucide-react';

import { StudyIcon } from '@/components/feature-icons';
import {
  CollectionCount,
  CollectionEmptyState,
  CollectionFilter,
  CollectionSearch,
  CollectionStatus,
} from '@/components/patterns/collection';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { type Activity, studySummary, studyTitle } from '../lib/fields';

type StudyListProps = {
  canViewOthers: boolean;
  scope: 'mine' | 'others';
  setScope: (value: 'mine' | 'others') => void;
  query: string;
  setQuery: (value: string) => void;
  mine: Activity[];
  others: Activity[];
  showOthers: boolean;
  otherMode: 'all' | 'person';
  setOtherMode: (value: 'all' | 'person') => void;
  owner: string;
  setOwner: (value: string) => void;
  ownerLabel: (id?: string) => string;
  people: { id: string; label: string }[];
  filtered: Activity[];
  busy: boolean;
  ready: boolean;
  isLoading: boolean;
  remoteError: unknown;
  localError: unknown;
  canEdit: (activity: Activity) => boolean;
  onOpen: (activity: Activity, opener: HTMLElement) => void;
  onDelete: (activity: Activity) => void;
};

export function StudyList({
  canViewOthers,
  scope,
  setScope,
  query,
  setQuery,
  mine,
  others,
  showOthers,
  otherMode,
  setOtherMode,
  owner,
  setOwner,
  ownerLabel,
  people,
  filtered,
  busy,
  ready,
  isLoading,
  remoteError,
  localError,
  canEdit,
  onOpen,
  onDelete,
}: StudyListProps) {
  return (
    <div className="space-y-5">
      {canViewOthers && (
        <div
          className="flex flex-wrap gap-2 border-b pb-5"
          role="group"
          aria-label="학습법 구분"
        >
          <CollectionFilter
            type="button"
            selected={scope === 'mine'}
            aria-pressed={scope === 'mine'}
            onClick={() => {
              setScope('mine');
              setQuery('');
            }}
          >
            내 학습법 <CollectionCount>{mine.length}</CollectionCount>
          </CollectionFilter>
          <CollectionFilter
            type="button"
            selected={scope === 'others'}
            aria-pressed={scope === 'others'}
            onClick={() => {
              setScope('others');
              setQuery('');
            }}
          >
            다른 사람의 학습법{' '}
            <CollectionCount>{others.length}</CollectionCount>
          </CollectionFilter>
        </div>
      )}
      {showOthers && (
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="다른 사람의 학습법 보기 방식"
          >
            <CollectionFilter
              type="button"
              size="sm"
              selected={otherMode === 'all'}
              aria-pressed={otherMode === 'all'}
              onClick={() => setOtherMode('all')}
            >
              전체 보기
            </CollectionFilter>
            <CollectionFilter
              type="button"
              size="sm"
              selected={otherMode === 'person'}
              aria-pressed={otherMode === 'person'}
              onClick={() => setOtherMode('person')}
            >
              사람별 보기
            </CollectionFilter>
          </div>
          {otherMode === 'person' && (
            <Select
              value={owner || null}
              onValueChange={(value) => setOwner(value ?? '')}
            >
              <SelectTrigger
                className="h-10 w-full rounded-md border-border bg-background sm:w-56"
                aria-label="학습법 작성자 선택"
              >
                <SelectValue placeholder="작성자를 선택해 주세요">
                  {owner ? ownerLabel(owner) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-md">
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.label} (
                    {
                      others.filter(
                        (activity) => activity.ownerId === person.id,
                      ).length
                    }
                    개)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          {showOthers
            ? otherMode === 'person' && owner
              ? `${ownerLabel(owner)}님의 학습법`
              : '다른 사람의 학습법'
            : '내 학습법'}{' '}
          <CollectionCount>{filtered.length}</CollectionCount>
        </h2>
        <CollectionSearch
          aria-label="학습법 검색"
          placeholder="과목, 문제 상황, 학습 전략 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {filtered.length ? (
        <ul className="divide-y rounded-lg border bg-background">
          {filtered.map((activity) => (
            <li
              key={activity.clientKey}
              className="flex flex-wrap items-start gap-4 p-5 transition-colors hover:bg-muted/40 sm:p-6"
            >
              <div className="min-w-0 flex-1 basis-60">
                <button
                  type="button"
                  disabled={busy || !ready}
                  className="rounded-sm text-left text-base font-bold leading-6 wrap-break-word hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                  onClick={(event) => onOpen(activity, event.currentTarget)}
                >
                  {studyTitle(activity.values)}
                </button>
                <CollectionStatus draft={activity.status === 'draft'}>
                  {activity.status === 'draft'
                    ? activity.revision > 0
                      ? '수정 중 · 임시저장'
                      : '임시저장'
                    : '확정'}
                </CollectionStatus>
                {showOthers && (
                  <p className="mt-2 text-sm font-medium">
                    작성자: {ownerLabel(activity.ownerId)}
                  </p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  {studySummary(activity.values) || '기본 정보 미입력'}
                </p>
                {activity.values.problem && (
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {activity.values.problem}
                  </p>
                )}
              </div>
              <div className="ml-auto flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-md"
                  disabled={busy || !ready}
                  title={canEdit(activity) ? '상세 · 수정' : '상세 보기'}
                  aria-label={`${studyTitle(activity.values)} ${canEdit(activity) ? '상세 · 수정' : '상세 보기'}`}
                  onClick={(event) => onOpen(activity, event.currentTarget)}
                >
                  {canEdit(activity) ? (
                    <Pencil aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </Button>
                {canEdit(activity) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-md"
                    disabled={busy}
                    title="삭제"
                    aria-label={`${studyTitle(activity.values)} 삭제`}
                    onClick={() => onDelete(activity)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <CollectionEmptyState
          icon={<StudyIcon className="size-6" aria-hidden="true" />}
          title={
            !ready || isLoading
              ? '학습법을 불러오는 중입니다'
              : remoteError
                ? '목록을 불러오지 못했습니다'
                : localError
                  ? '임시저장을 확인하지 못했습니다'
                  : showOthers && otherMode === 'person' && !owner
                    ? '작성자를 선택해 주세요'
                    : query.trim()
                      ? '검색 결과가 없습니다'
                      : '등록된 학습법이 없습니다'
          }
          description={
            !ready || isLoading
              ? '잠시만 기다려 주세요.'
              : remoteError || localError
                ? '위의 오류 안내를 확인해 주세요.'
                : showOthers && otherMode === 'person' && !owner
                  ? '작성자를 선택하면 해당 학습법을 볼 수 있습니다.'
                  : query.trim()
                    ? '다른 검색어로 찾아보세요.'
                    : showOthers
                      ? '다른 작성자가 확정한 학습법이 여기에 표시됩니다.'
                      : '학습법 추가 버튼으로 나만의 학습 전략을 기록해 보세요.'
          }
        />
      )}
    </div>
  );
}

import { Eye, Pencil, Trash2 } from 'lucide-react';

import { StudyIcon } from '@/components/feature-icons';
import {
  CollectionEmptyState,
  CollectionLoadingState,
  CollectionSearch,
} from '@/components/patterns/collection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item';
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
  const loading = !ready || isLoading;
  return (
    <div className="space-y-5">
      {canViewOthers && (
        <div
          className="flex flex-wrap gap-2 border-b pb-5"
          role="group"
          aria-label="학습법 구분"
        >
          <Button
            variant="filter"
            type="button"
            aria-pressed={scope === 'mine'}
            onClick={() => {
              setScope('mine');
              setQuery('');
            }}
          >
            내 학습법{' '}
            <Badge
              variant="count"
              aria-label={loading ? '불러오는 중' : undefined}
            >
              {loading ? '—' : mine.length}
            </Badge>
          </Button>
          <Button
            variant="filter"
            type="button"
            aria-pressed={scope === 'others'}
            onClick={() => {
              setScope('others');
              setQuery('');
            }}
          >
            다른 사람의 학습법{' '}
            <Badge
              variant="count"
              aria-label={loading ? '불러오는 중' : undefined}
            >
              {loading ? '—' : others.length}
            </Badge>
          </Button>
        </div>
      )}
      {showOthers && (
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="다른 사람의 학습법 보기 방식"
          >
            <Button
              variant="filter"
              type="button"
              size="sm"
              aria-pressed={otherMode === 'all'}
              onClick={() => setOtherMode('all')}
            >
              전체 보기
            </Button>
            <Button
              variant="filter"
              type="button"
              size="sm"
              aria-pressed={otherMode === 'person'}
              onClick={() => setOtherMode('person')}
            >
              사람별 보기
            </Button>
          </div>
          {otherMode === 'person' && (
            <Select
              value={owner || null}
              onValueChange={(value) => setOwner(value ?? '')}
            >
              <SelectTrigger
                className="w-full sm:w-56"
                aria-label="학습법 작성자 선택"
              >
                <SelectValue placeholder="작성자를 선택해 주세요">
                  {owner ? ownerLabel(owner) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
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
          <Badge
            variant="count"
            aria-label={loading ? '불러오는 중' : undefined}
          >
            {loading ? '—' : filtered.length}
          </Badge>
        </h2>
        <CollectionSearch
          aria-label="학습법 검색"
          placeholder="과목, 문제 상황, 학습 전략 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="min-h-64" aria-busy={loading}>
        {filtered.length ? (
          <ul className="overflow-hidden rounded-lg border bg-background">
            {filtered.map((activity) => (
              <Item
                key={activity.clientKey}
                render={<li />}
                variant="list"
                className="items-start"
              >
                <ItemContent className="basis-60">
                  <ItemTitle>
                    <button
                      type="button"
                      disabled={busy || !ready}
                      className="min-w-0 rounded-sm text-left wrap-break-word hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                      onClick={(event) => onOpen(activity, event.currentTarget)}
                    >
                      {studyTitle(activity.values)}
                    </button>
                    <Badge
                      variant={
                        activity.status === 'draft' ? 'highlight' : 'subtle'
                      }
                    >
                      {activity.status === 'draft'
                        ? activity.revision > 0
                          ? '수정 중 · 임시저장'
                          : '임시저장'
                        : '확정'}
                    </Badge>
                  </ItemTitle>
                  {showOthers && (
                    <p className="mt-2 text-sm font-medium">
                      작성자: {ownerLabel(activity.ownerId)}
                    </p>
                  )}
                  <ItemDescription>
                    {studySummary(activity.values) || '기본 정보 미입력'}
                  </ItemDescription>
                  {activity.values.problem && (
                    <ItemDescription className="mt-1 whitespace-pre-wrap">
                      {activity.values.problem}
                    </ItemDescription>
                  )}
                </ItemContent>
                <ItemActions>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
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
                      disabled={busy}
                      title="삭제"
                      aria-label={`${studyTitle(activity.values)} 삭제`}
                      onClick={() => onDelete(activity)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </ItemActions>
              </Item>
            ))}
          </ul>
        ) : loading ? (
          <CollectionLoadingState label="학습법을 불러오는 중입니다" />
        ) : (
          <CollectionEmptyState
            icon={<StudyIcon className="size-6" aria-hidden="true" />}
            title={
              remoteError
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
              remoteError || localError
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
    </div>
  );
}

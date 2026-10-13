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
import { Tabs, TabsContent,TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const content = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <CollectionSearch
          aria-label="학습법 검색"
          placeholder="과목, 문제 상황, 학습 전략 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          containerClassName="sm:w-auto sm:min-w-0 sm:flex-1"
        />
        {showOthers && (
          <Select
            value={owner || 'all'}
            onValueChange={(value) =>
              setOwner(!value || value === 'all' ? '' : value)
            }
          >
            <SelectTrigger
              className="w-full sm:w-56"
              aria-label="학습법 작성자 필터"
            >
              <SelectValue>
                {owner ? ownerLabel(owner) : '전체 작성자'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 작성자</SelectItem>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.label} (
                  {
                    others.filter((activity) => activity.ownerId === person.id)
                      .length
                  }
                  개)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <h2 className="font-medium">
          {showOthers
            ? owner
              ? `${ownerLabel(owner)}님의 학습법`
              : '다른 작성자가 공유한 학습법'
            : '내가 작성한 학습법'}
        </h2>
        <span aria-live="polite" className="tabular-nums">
          {loading
            ? '불러오는 중'
            : `${filtered.length}개${query.trim() || (showOthers && owner) ? ' 검색됨' : ''}`}
        </span>
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
                  : query.trim() || (showOthers && owner)
                    ? '검색 결과가 없습니다'
                    : '등록된 학습법이 없습니다'
            }
            description={
              remoteError || localError
                ? '위의 오류 안내를 확인해 주세요.'
                : query.trim() || (showOthers && owner)
                  ? showOthers
                    ? '검색어를 바꾸거나 전체 작성자로 선택해 보세요.'
                    : '다른 검색어로 찾아보세요.'
                  : showOthers
                    ? '다른 작성자가 확정한 학습법이 여기에 표시됩니다.'
                    : '학습법 추가 버튼으로 나만의 학습 전략을 기록해 보세요.'
            }
          />
        )}
      </div>
    </div>
  );
  if (!canViewOthers) return content;
  return (
    <Tabs
      value={scope}
      onValueChange={(value) => {
        if ((value === 'mine' || value === 'others') && value !== scope) {
          setScope(value);
          setQuery('');
        }
      }}
    >
      <TabsList
        className="grid w-full grid-cols-2 gap-1 rounded-lg bg-control-track p-1 sm:inline-flex sm:w-fit"
        aria-label="학습법 구분"
      >
        <TabsTrigger
          type="button"
          className="min-w-0 px-3 sm:flex-none sm:px-4"
          value="mine"
        >
          내 학습법{' '}
          <Badge
            variant="count"
            aria-label={loading ? '불러오는 중' : undefined}
          >
            {loading ? '—' : mine.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger
          type="button"
          className="min-w-0 px-3 sm:flex-none sm:px-4"
          aria-label="다른 사람의 학습법"
          value="others"
        >
          <span className="sm:hidden">다른 사람</span>
          <span className="hidden sm:inline">다른 사람의 학습법</span>
          <Badge
            variant="count"
            aria-label={loading ? '불러오는 중' : undefined}
          >
            {loading ? '—' : others.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      {(['mine', 'others'] as const).map((value) => (
        <TabsContent key={value} value={value}>
          {scope === value ? content : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}

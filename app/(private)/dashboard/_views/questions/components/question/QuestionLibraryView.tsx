'use client';
import { Network, Plus, Table2 } from 'lucide-react';

import {
  CollectionEmptyState,
  CollectionHeader,
  CollectionLoadingState,
  CollectionSearch,
} from '@/components/patterns/collection';
import { CollectionPagination } from '@/components/patterns/collection-pagination';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import {
  Tabs as CollectionTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

import { DashboardPageCategory } from '../../../../_components/DashboardPageCategory';
import { useQuestionEditorSession } from '../../hooks/useQuestionEditorSession';
import { questionName } from '../../lib/question-blocks';
import type { QuestionLibraryProps } from '../../lib/question-editor-types';
import { QuestionsNavigation } from '../QuestionsNavigation';

import { QuestionEditorContent } from './QuestionEditorContent';
import { QuestionManagementTable } from './QuestionManagementTable';
import { QuestionRelationshipGraph } from './QuestionRelationshipGraph';
export function QuestionLibraryView({
  displayRole,
  embedded,
}: QuestionLibraryProps = {}) {
  const editor = useQuestionEditorSession({ displayRole, embedded });
  const {
    requestedId,
    blocks,
    userId,
    role,
    query,
    setQuery,
    search,
    total,
    setPage,
    listMode,
    setListMode,
    busy,
    fetching,
    loadError,
    pendingArchive,
    setPendingArchive,
    loading,
    loadBlocks,
    filtered,
    pageCount,
    currentPage,
    pageQuestions,
    opener,
    listHeading,
    leaveEditor,
    openEditor,
    archive,
  } = editor;
  const editorContent = (
    <QuestionEditorContent editor={editor} embedded={embedded} />
  );
  return (
    <section
      aria-label={embedded ? '새 질문 만들기' : undefined}
      aria-labelledby={embedded ? undefined : 'question-management-title'}
      className="space-y-6"
    >
      {!embedded && (
        <>
          <CollectionHeader
            id="question-management-title"
            category={<DashboardPageCategory view="questions" />}
            titleRef={listHeading}
            title="질문 관리"
            description="질문을 만들고, 질문 간 참조와 사용 중인 질문지를 확인하세요."
            action={
              <Button
                disabled={loading || loadError}
                onClick={() => openEditor()}
              >
                <Plus aria-hidden="true" />
                <span className="hidden sm:inline">새 질문 만들기</span>
                <span className="sm:hidden">추가</span>
              </Button>
            }
          />
          <QuestionsNavigation
            questionnaire={false}
            questionCount={
              !search && !loading && !loadError ? total : undefined
            }
          />
          <div aria-busy={fetching}>
            <CollectionTabs
              value={listMode}
              onValueChange={(value) => {
                if (value === 'table' || value === 'graph') setListMode(value);
              }}
              className="gap-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CollectionSearch
                  aria-label="질문 검색"
                  maxLength={200}
                  value={query}
                  containerClassName="sm:w-auto sm:flex-1"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="이름이나 질문 내용으로 검색"
                />
                <TabsList
                  aria-label="질문 목록 보기 방식"
                  className="w-full sm:w-auto"
                >
                  <TabsTrigger value="table">
                    <Table2 aria-hidden="true" />
                    테이블
                  </TabsTrigger>
                  <TabsTrigger value="graph">
                    <Network aria-hidden="true" />
                    그래프(Beta)
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value={listMode}>
                {listMode === 'table' ? (
                  <div className="space-y-4">
                    <QuestionManagementTable
                      showCreator={(displayRole ?? role) === 'admin'}
                      questions={pageQuestions}
                      loading={loading || fetching}
                      error={loadError}
                      filtered={!!query}
                      onRetry={() => void loadBlocks()}
                      canManage={(q) =>
                        role === 'admin' || q.created_by === userId
                      }
                      onOpen={openEditor}
                      onArchive={setPendingArchive}
                    />
                    <CollectionPagination
                      label="질문 목록 페이지"
                      total={total}
                      page={currentPage}
                      pages={pageCount}
                      loading={loading || fetching}
                      error={loadError}
                      onPageChange={setPage}
                    />
                  </div>
                ) : loading ? (
                  <CollectionLoadingState label="질문을 불러오는 중입니다" />
                ) : loadError ? (
                  <div
                    role="alert"
                    className="rounded-lg border p-8 text-center"
                  >
                    <p className="text-sm text-muted-foreground">
                      질문 목록을 불러오지 못했습니다.
                    </p>
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => void loadBlocks()}
                    >
                      다시 시도
                    </Button>
                  </div>
                ) : !filtered.length ? (
                  <CollectionEmptyState
                    icon={<Network />}
                    title={
                      query ? '검색 결과가 없습니다' : '등록된 질문이 없습니다'
                    }
                    description={
                      query
                        ? '다른 이름이나 내용으로 검색해 보세요.'
                        : '새 질문 만들기 버튼으로 질문을 등록하세요.'
                    }
                  />
                ) : (
                  <QuestionRelationshipGraph
                    questions={blocks}
                    matchedQuestions={filtered}
                    canManage={(q) =>
                      role === 'admin' || q.created_by === userId
                    }
                    onOpen={openEditor}
                  />
                )}
              </TabsContent>
            </CollectionTabs>
          </div>
        </>
      )}
      {embedded ? (
        editorContent
      ) : (
        <Drawer
          open={Boolean(requestedId)}
          onOpenChange={(open) => {
            if (!open) leaveEditor();
          }}
        >
          <DrawerContent
            className="h-dvh max-h-dvh rounded-none md:w-[min(960px,90vw)] md:max-w-none"
            finalFocus={() =>
              opener.current?.isConnected ? opener.current : listHeading.current
            }
          >
            {editorContent}
          </DrawerContent>
        </Drawer>
      )}

      <Dialog
        open={Boolean(pendingArchive)}
        onOpenChange={(open) => !open && setPendingArchive(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingArchive?.purpose === 'study_registration'
                ? '안내 카드를 삭제할까요?'
                : '질문을 삭제할까요?'}
            </DialogTitle>
            <DialogDescription>
              ‘{pendingArchive ? questionName(pendingArchive) : '이 질문'}’을
              {pendingArchive?.purpose === 'study_registration'
                ? '삭제합니다. 이미 등록한 학습법은 유지됩니다.'
                : '삭제합니다. 이 질문에 연결된 게시 단계의 응답도 함께 삭제되며 되돌릴 수 없습니다.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingArchive(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void archive()}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

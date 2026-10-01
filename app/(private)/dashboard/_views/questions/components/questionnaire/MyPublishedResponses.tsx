'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { questionnaireFetcher } from '../../lib/questionnaire/api-client';

type Item = {
  id: string;
  title: string;
  updated_at: string;
  source_deleted: boolean;
};
export function MyPublishedResponses() {
  const { data, error } = useSWR<Item[]>(
    '/api/questionnaires/my-responses',
    questionnaireFetcher,
    { revalidateOnFocus: true },
  );
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil((data?.length ?? 0) / 10));
  const current = Math.min(page, pages);
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">내 응답</h2>
      <p className="text-sm text-muted-foreground">
        열어 본 질문지와 내 답변입니다. 원본 질문지가 삭제되어도 다시 보고
        수정할 수 있어요.
      </p>
      {error ? (
        <p role="alert">내 응답을 불러오지 못했어요.</p>
      ) : !data ? (
        <p>불러오는 중…</p>
      ) : !data.length ? (
        <p className="text-sm text-muted-foreground">
          아직 작성한 응답이 없어요.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>질문지</TableHead>
                <TableHead>최근 저장</TableHead>
                <TableHead>원본</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice((current - 1) * 10, current * 10).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      className="block py-2 font-medium hover:underline"
                      prefetch={false}
                      href={`/dashboard?view=questions&response=${item.id}`}
                    >
                      {item.title || '제목 없는 질문지'}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {new Date(item.updated_at).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell>
                    {item.source_deleted ? '삭제됨 · 응답 보관 중' : '연결됨'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <nav
            aria-label="내 응답 페이지"
            className="flex items-center justify-end gap-3"
          >
            <Button
              variant="outline"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              이전
            </Button>
            <span>
              {current} / {pages}
            </span>
            <Button
              variant="outline"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              다음
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}

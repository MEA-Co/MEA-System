'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type QuestionBlockRow, questionName } from '../lib/question-blocks';
import { readError } from '../lib/question-editor-draft';
import { richTextPlainText } from '../lib/rich-text';
export function useQuestionLibraryList() {
  const [blocks, setBlocks] = useState<QuestionBlockRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const requestSerial = useRef(0);
  const [page, setPage] = useState(1);
  const [listMode, setListMode] = useState<'table' | 'graph'>('table');
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const fullLibrary = listMode === 'graph';
  const requestUrl = fullLibrary
    ? '/api/questions'
    : `/api/questions?page=${page}&search=${encodeURIComponent(search)}`;
  const loading =
    loadedUrl !== requestUrl || (!fullLibrary && query.trim() !== search);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadBlocks = useCallback(async () => {
    const serial = ++requestSerial.current;
    setFetching(true);
    setLoadError(false);
    try {
      const response = await fetch(requestUrl, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(readError(data));
      if (serial !== requestSerial.current) return;
      setBlocks(data.blocks);
      setTotal(data.total ?? data.blocks.length);
      setUserId(data.userId);
      setRole(data.role);
      if (!fullLibrary && data.page !== page) setPage(data.page);
    } catch {
      if (serial === requestSerial.current) setLoadError(true);
    } finally {
      if (serial === requestSerial.current) {
        setLoadedUrl(requestUrl);
        setFetching(false);
      }
    }
  }, [requestUrl, fullLibrary, page, setPage]);

  useEffect(() => {
    // This fetch synchronizes the editor or current server page with its URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBlocks();
    return () => {
      requestSerial.current += 1;
    };
  }, [loadBlocks]);

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return blocks.filter(
      (block) =>
        questionName(block).toLocaleLowerCase().includes(search) ||
        richTextPlainText(block.prompt).toLocaleLowerCase().includes(search),
    );
  }, [blocks, query]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageQuestions = blocks;

  return {
    blocks,
    userId,
    role,
    query,
    setQuery,
    search,
    total,
    page,
    setPage,
    listMode,
    setListMode,
    fetching,
    loadError,
    loading,
    loadBlocks,
    filtered,
    currentPage,
    pageCount,
    pageQuestions,
  };
}

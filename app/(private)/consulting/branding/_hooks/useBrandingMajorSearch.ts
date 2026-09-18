'use client';
import { useEffect, useRef, useState } from 'react';

import {
  majorSearchApi as api,
  type SearchResult,
} from '@/features/keywords/major-search/client';
import {
  type Candidate,
  type MajorDraft,
  normalizeMajorInput,
  parseMajorDraft,
  searchCatalog,
} from '@/features/keywords/major-search/domain';

import { useBrandingMajorSearchContext } from '../_context/BrandingMajorSearchContext';

export function useBrandingMajorSearch(
  value: string,
  onChange: (value: string) => void,
  onConfirmed?: (value: string) => void,
) {
  const session = useBrandingMajorSearchContext();
  const [draft, setDraft] = useState<MajorDraft>(
    () =>
      parseMajorDraft(value) ?? {
        input: value,
        sessionId: session.sessionId,
        confirmed: null,
      },
  );
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [noMatch, setNoMatch] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);
  const noMatchRequest = useRef<string | null>(null);
  const callback = useRef(onChange);
  const confirmedCallback = useRef(onConfirmed);
  useEffect(() => {
    callback.current = onChange;
    confirmedCallback.current = onConfirmed;
  }, [onChange, onConfirmed]);
  const currentDraft = useRef(draft);
  const selection = useRef<{
    requestId: string;
    input: string;
    majorId: string;
    result: SearchResult;
  } | null>(null);
  function update(next: MajorDraft) {
    currentDraft.current = next;
    setDraft(next);
    callback.current(JSON.stringify(next));
  }
  const { snapshot, loading, error: catalogError } = session;
  useEffect(() => {
    const token = ++generation.current;
    let disposed = false;
    const current = () => !disposed && token === generation.current;
    if (
      loading ||
      catalogError ||
      !snapshot ||
      !normalizeMajorInput(draft.input) ||
      currentDraft.current.confirmed
    )
      return;
    const timer = setTimeout(() => {
      if (!current() || selection.current) return;
      const candidates = searchCatalog(snapshot.catalog, draft.input);
      setResult({ candidates, source: 'db', catalogVersion: snapshot.version });
      setState('ready');
      setError('');
      setNoMatch(false);
    }, 300);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [draft.input, retry, snapshot, loading, catalogError]);
  async function feedback(
    action: 'selected' | 'confirmed' | 'rejected' | 'no_match',
    candidate: Candidate | null,
  ) {
    if (!result || busy.current) return false;
    if (action === 'selected' && candidate) {
      selection.current = {
        requestId: crypto.randomUUID(),
        input: draft.input,
        majorId: candidate.id,
        result,
      };
      setSelected(candidate);
      setError('');
      return true;
    }
    if (action === 'rejected') {
      selection.current = null;
      setSelected(null);
      setNoMatch(false);
      setError('');
      return true;
    }
    if (action === 'no_match') {
      if (noMatch) return true;
      const requestId = (noMatchRequest.current ??= crypto.randomUUID());
      const token = generation.current;
      busy.current = true;
      setState('saving-no-match');
      setError('');
      try {
        const saved = await api({
          op: 'no_match',
          requestId,
          sessionId: draft.sessionId,
          input: draft.input,
          catalogVersion: result.catalogVersion,
        });
        if (token !== generation.current) return false;
        if (saved.noMatch?.requestId !== requestId)
          throw new Error('기록 결과를 확인하지 못했습니다. 다시 눌러 주세요.');
        selection.current = null;
        setSelected(null);
        setNoMatch(true);
        setState('ready');
        return true;
      } catch (cause) {
        if (token === generation.current) {
          setState('ready');
          setError(
            cause instanceof Error
              ? cause.message
              : '기록을 저장하지 못했습니다. 다시 눌러 주세요.',
          );
        }
        return false;
      } finally {
        busy.current = false;
      }
    }
    const choice = selection.current;
    if (action !== 'confirmed' || !choice || choice.majorId !== candidate?.id)
      return false;
    busy.current = true;
    const token = generation.current;
    setState('saving');
    setError('');
    try {
      const saved = await api({
        op: 'confirm',
        requestId: choice.requestId,
        sessionId: draft.sessionId,
        input: choice.input,
        majorId: choice.majorId,
        catalogVersion: choice.result.catalogVersion,
      });
      if (token !== generation.current) return false;
      if (!saved.confirmed) throw new Error('확정 결과를 확인하지 못했습니다.');
      const confirmedDraft = {
        ...currentDraft.current,
        confirmed: saved.confirmed,
      };
      update(confirmedDraft);
      setState('ready');
      confirmedCallback.current?.(JSON.stringify(confirmedDraft));
      return true;
    } catch (cause) {
      if (token === generation.current) {
        setState('ready');
        setError(
          cause instanceof Error
            ? cause.message
            : '확정을 저장하지 못했습니다.',
        );
      }
      return false;
    } finally {
      busy.current = false;
    }
  }
  function changeInput(input: string) {
    if (input === currentDraft.current.input) return;
    generation.current++;
    noMatchRequest.current = null;
    selection.current = null;
    update({ ...draft, input, confirmed: null });
    setSelected(null);
    setResult(null);
    setError('');
    setState(normalizeMajorInput(input) ? 'searching' : 'idle');
    setNoMatch(false);
  }
  function retrySearch() {
    generation.current++;
    noMatchRequest.current = null;
    selection.current = null;
    setSelected(null);
    setResult(null);
    setRetry((n) => n + 1);
    session.reload();
  }
  return {
    draft,
    result,
    selected,
    noMatch,
    state: loading ? 'db' : catalogError ? 'error' : state,
    error: catalogError || error,
    waiting:
      loading || ['searching', 'saving', 'saving-no-match'].includes(state),
    changeInput,
    retrySearch,
    feedback,
  };
}

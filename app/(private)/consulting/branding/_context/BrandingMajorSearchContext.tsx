'use client';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  type CatalogSnapshot,
  fetchMajorCatalog,
} from '@/features/keywords/major-search/client';

type Session = {
  sessionId: string;
  snapshot: CatalogSnapshot | null;
  loading: boolean;
  error: string;
  reload: () => void;
};
const SessionContext = createContext<Session | null>(null);
export function BrandingMajorSearchProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const pending = useRef<Promise<CatalogSnapshot> | null>(null);
  const load = useCallback(() => {
    const request = (pending.current ??= fetchMajorCatalog());
    void request
      .then(setSnapshot, (cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : '전공 목록을 불러오지 못했습니다.',
        ),
      )
      .finally(() => {
        pending.current = null;
        setLoading(false);
      });
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const reload = () => {
    setLoading(true);
    setError('');
    load();
  };
  return (
    <SessionContext value={{ sessionId, snapshot, loading, error, reload }}>
      {children}
    </SessionContext>
  );
}
export function useBrandingMajorSearchContext() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('BrandingMajorSearchProvider is required.');
  return session;
}

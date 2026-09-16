'use client';

import { createContext, type ReactNode, useContext } from 'react';

const Context = createContext<string | null>(null);
export function ValuesSessionProvider({
  ownerId,
  children,
}: {
  ownerId: string | null;
  children: ReactNode;
}) {
  return <Context value={ownerId}>{children}</Context>;
}
export function useValuesOwner() {
  return useContext(Context);
}

'use client';

import { useState } from 'react';

export type ConsultingTurn = 'service' | 'user';

export function useConsultingTurn(initialTurn: ConsultingTurn = 'service') {
  const [turn, setTurn] = useState<ConsultingTurn>(initialTurn);

  return {
    turn,
    startServiceTurn: () => setTurn('service'),
    startUserTurn: () => setTurn('user'),
  };
}

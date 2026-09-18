'use server';

import { handleMajorCatalog, handleMajorSearch } from './handlers';

// Catalog reads and explicit confirmation/no-match records only.
export async function getMajorCatalog() {
  const response = await handleMajorCatalog();
  return response.json();
}
export async function recordMajorSearch(input: unknown) {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('op' in input) ||
    (input.op !== 'confirm' && input.op !== 'no_match')
  )
    return { error: '잘못된 기록 요청입니다.' };
  const response = await handleMajorSearch(input);
  return response.json();
}

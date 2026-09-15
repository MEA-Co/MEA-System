import { getMajorCatalog, recordMajorSearch } from './actions';
import type { Candidate, CatalogMajor, ConfirmedMajor } from './domain';
export type CatalogSnapshot = { catalog: CatalogMajor[]; version: string };
export type SearchResult = {
  candidates: Candidate[];
  source: 'db';
  catalogVersion: string;
};
export async function majorSearchApi(
  body: object,
): Promise<{ confirmed?: ConfirmedMajor; noMatch?: { requestId: string } }> {
  const data = await recordMajorSearch(body);
  if (data.error) throw new Error(data.error);

  return data;
}
export async function fetchMajorCatalog(): Promise<CatalogSnapshot> {
  const data = await getMajorCatalog();
  if (data.error) throw new Error(data.error);
  return data;
}

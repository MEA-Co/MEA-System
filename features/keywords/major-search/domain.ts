import { z } from 'zod';

export const normalizeMajorInput = (value: string) =>
  value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/\s+/gu, '');
export type Alias = {
  name: string;
  alias_type: 'alternative_name' | 'abbreviation' | 'group_member';
};
export type CatalogMajor = {
  id: string;
  name: string;
  description: string | null;
  field_id: string;
  field_name: string;
  group_name: string | null;
  item_type: 'major' | 'major_group';
  sort_order: number;
  aliases: Alias[];
};
export type Candidate = CatalogMajor & {
  rank: number;
  matched_alias: Alias | null;
  match_type: 'exact_name' | 'exact_alias' | 'prefix' | 'contains';
};
export const confirmedMajorSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  requestId: z.uuid(),
});
export type ConfirmedMajor = z.infer<typeof confirmedMajorSchema>;
export type MajorDraft = {
  input: string;
  sessionId: string;
  confirmed: ConfirmedMajor | null;
};
export function parseMajorDraft(value: string): MajorDraft | null {
  try {
    return z
      .object({
        input: z.string(),
        sessionId: z.uuid(),
        confirmed: confirmedMajorSchema.nullable(),
      })
      .parse(JSON.parse(value));
  } catch {
    return null;
  }
}
export function searchCatalog(
  catalog: CatalogMajor[],
  input: string,
): Candidate[] {
  const query = normalizeMajorInput(input);
  if (!query) return [];
  return catalog
    .flatMap((major) => {
      const matches: {
        score: number;
        matched_alias: Alias | null;
        match_type: Candidate['match_type'];
      }[] = [];
      for (const alias of [null, ...major.aliases]) {
        const name = normalizeMajorInput(alias?.name ?? major.name);
        if (name === query)
          matches.push({
            score: alias ? 1 : 0,
            matched_alias: alias,
            match_type: alias ? 'exact_alias' : 'exact_name',
          });
        else if (name.startsWith(query))
          matches.push({
            score: 2,
            matched_alias: alias,
            match_type: 'prefix',
          });
        else if (name.includes(query))
          matches.push({
            score: 3,
            matched_alias: alias,
            match_type: 'contains',
          });
      }
      const match = matches.sort((a, b) => a.score - b.score)[0];
      return match ? [{ ...major, ...match, rank: 0 }] : [];
    })
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.sort_order - b.sort_order ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 5)
    .map(({ score: _score, ...major }, i) => ({ ...major, rank: i + 1 }));
}

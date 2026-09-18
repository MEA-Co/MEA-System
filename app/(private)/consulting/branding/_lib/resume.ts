import type { ValuesState } from '@/features/major-values/domain';

import { brandingPlan, type MajorList } from './plan';

export function resumeBrandingValues(state: ValuesState): typeof brandingPlan {
  const majors: MajorList = { first: '', ids: {} };
  const keys = ['first', 'second', 'third'] as const;
  for (const interest of state.context.interests) {
    majors[keys[interest.rank - 1]] = interest.majorName;
    if (interest.majorId) majors.ids![interest.majorName] = interest.majorId;
  }
  const keywords = keys
    .filter((key) => majors[key])
    .map(
      (key) =>
        `[${majors[key]}]\n${state.context.interests
          .filter((i) => i.majorName === majors[key])
          .map((i) => i.keyword)
          .join('\n')}`,
    )
    .join('\n\n');
  return {
    ...brandingPlan,
    entry: 'values',
    createInitialContext: () => ({
      outputs: { keywords, values: '', competencies: '', story: '' },
      resumedMajors: majors,
    }),
  };
}

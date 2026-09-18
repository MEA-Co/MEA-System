import { RECOMMENDATION_SOURCES } from '@/features/subject-selection/recommendations';

import type { ConfirmedCurriculum } from '../../_lib/curriculum';

export function CourseSelectionSources({
  linkedRules,
}: Pick<ConfirmedCurriculum, 'linkedRules'>) {
  return (
    <>
      {linkedRules.length ? (
        <section className="border-t pt-4">
          <h2 className="text-sm font-semibold">학기 간 이수 조건</h2>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {linkedRules.map((rule, index) => (
              <li key={`${rule}-${index}`}>{rule}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <details className="border-t pt-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium">
          대학별 자료 기준
        </summary>
        <ul className="mt-2 space-y-1.5">
          {RECOMMENDATION_SOURCES.map((source) => (
            <li key={source.university}>
              {source.university} · {source.title}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

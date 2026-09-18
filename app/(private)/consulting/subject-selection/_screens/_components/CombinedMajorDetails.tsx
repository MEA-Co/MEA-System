import type { buildCombinedMajorDraft } from '../../_lib/combined-major';

export function CombinedMajorDetails({
  department,
  secondaryDepartment,
  primaryLabel,
  secondaryLabel,
  result,
}: {
  department: string;
  secondaryDepartment: string;
  primaryLabel?: string;
  secondaryLabel: string;
  result: ReturnType<typeof buildCombinedMajorDraft>;
}) {
  return (
    <>
      <details key={secondaryDepartment} className="border-y py-4">
        <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4">
          학과별 준비 기준 및 과목 변경 내역
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {result.assessments.map((assessment, index) => (
              <section key={index} className="border-t pt-4">
                <h3 className="font-semibold">
                  {index === 0 ? department : secondaryDepartment}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  적용 기준: {index === 0 ? primaryLabel : secondaryLabel}
                </p>
                <p className="mt-3 text-sm">
                  미확보 코어: {assessment.missing.join(', ') || '없음'}
                </p>
                <p className="mt-2 text-sm font-medium">
                  준비 깊이:{' '}
                  {(index === 0 ? result.depth.first : result.depth.second)
                    .sufficient
                    ? '임시 기준 충족'
                    : '보완 필요'}
                </p>
                <p className="mt-1 text-sm">
                  심화·지정 보완 과목 (
                  {
                    (index === 0 ? result.depth.first : result.depth.second)
                      .depth.length
                  }
                  /
                  {
                    (index === 0 ? result.depth.first : result.depth.second)
                      .minimum
                  }
                  ):{' '}
                  {(index === 0
                    ? result.depth.first
                    : result.depth.second
                  ).depth
                    .map((course) => course.name)
                    .join(', ') || '없음'}
                </p>
                <p className="mt-1 text-sm">
                  코어 최소조건 외 추가 보완 (필수 조건 아님):{' '}
                  {(index === 0
                    ? result.depth.first
                    : result.depth.second
                  ).beyondCore
                    .map((course) => course.name)
                    .join(', ') || '없음'}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {(index === 0
                    ? result.depth.first
                    : result.depth.second
                  ).evidence.map(({ course, reason }) => (
                    <li key={course.id}>
                      {course.name} · {reason}
                    </li>
                  ))}
                </ul>
                {assessment.choices.map((rule) => (
                  <p key={rule.id} className="mt-2 text-sm text-amber-800">
                    {rule.label}: {rule.courses.join(', ')} 중 {rule.choose}개 ·
                    현재 {rule.count}개
                    {rule.include
                      ? ` / ${rule.include.label}: ${rule.included}/${rule.include.choose}`
                      : ''}
                  </p>
                ))}
                <p className="mt-2 text-sm">
                  그 외 관련 과목 참고 (깊이 충족과 별도):{' '}
                  {[
                    ...new Set(assessment.support.map((course) => course.name)),
                  ].join(', ') || '미확보'}
                </p>
              </section>
            ))}
          </div>
          <dl className="space-y-4 border-y py-4 text-sm">
            {[
              ['공통으로 도움 되는 과목', result.shared],
              ['코어·선행 조건을 위해 추가한 과목', result.additions],
              ['현재 추천안에서 빠지는 과목', result.displaced],
            ].map(([label, courses]) => (
              <div key={String(label)}>
                <dt className="font-medium">{String(label)}</dt>
                <dd className="mt-1 text-muted-foreground">
                  {[
                    ...new Set(
                      (courses as { name: string }[]).map(
                        (course) => course.name,
                      ),
                    ),
                  ].join(', ') || '없음'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
      <aside className="border-l-4 border-rose-400 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-900">
        <p className="font-semibold">
          현재 초안은 과목 구성상 병행 가능하다는 뜻이지, 두 학과의 지원
          경쟁력을 보장하는 것은 아니에요.
        </p>
        <p className="mt-2">
          이 초안은 {department} 및 {secondaryDepartment}에 실제로 지원하는
          경우를 가정해, 선택과목 구성으로 두 학과의 준비를 함께 담을 수 있는지
          검토한 결과예요. 탐구활동의 내용과 깊이, 활동 간 연결성, 각 학과에
          지원하려는 이유까지 종합적으로 판단한 결과는 아니에요.
        </p>
        <p className="mt-2">
          따라서 여기서 가능하다고 나와도 두 학과의 학생부종합전형에서 모두
          강점을 갖췄다는 뜻은 아니에요. 학과 조합과 활동 내용에 따라 한쪽
          분야는 다른 전공을 보완하는 소재에 그칠 수 있어요. 실제 지원 전에는 각
          학과에 대한 관심과 탐구가 독립적으로도 드러나는지, 전체 학생부의
          흐름과 함께 따로 점검해 주세요.
        </p>
      </aside>
    </>
  );
}

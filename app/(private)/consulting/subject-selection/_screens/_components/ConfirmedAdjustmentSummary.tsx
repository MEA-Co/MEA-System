import type { ConfirmedAdjustment } from '../../_lib/confirmed-adjustment';

export function ConfirmedAdjustmentSummary({
  proposal,
  department,
}: {
  proposal: ConfirmedAdjustment;
  department: string;
}) {
  const names = (courses: { name: string }[]) =>
    courses.map((course) => course.name).join(', ') || '없음';
  return (
    <>
      <ul className="list-disc space-y-2 pl-5 text-sm">
        {proposal.swaps.map((swap) => (
          <li key={swap.from.id}>
            <strong>
              {swap.term} · {swap.from.name} → {swap.to.name}
            </strong>
            <br />
            {swap.group} · {swap.from.credit}학점 유지. {department}의 코어·선행
            또는 심화 준비를 확보하기 위한 변경입니다.
            {swap.compensations?.map((item) => (
              <p key={item.course.id} className="mt-2 text-emerald-800">
                졸업요건 보충: {item.term} · {item.course.name} (
                {item.course.credit}학점)
                <br />
                {item.group} · 교체와 함께 1단계 확정 과목으로 반영
              </p>
            ))}
          </li>
        ))}
      </ul>
      <p className="text-sm text-emerald-800">
        1단계 교체 없이 2단계 빈자리에 배치할 코어·선행 과목:{' '}
        {names(proposal.result.additions)}
      </p>
      <p className="text-sm">
        조정 후 양쪽 코어·선행·준비 깊이 기준 충족. 기존 전공 심화 유지율{' '}
        {Math.round((proposal.result.depth.retention ?? 0) * 100)}%.
      </p>
      <p className="text-sm text-amber-800">
        기존 전공에서 빠지는 심화·보완 과목: {names(proposal.result.depth.lost)}
        . 적용 시 기존 2단계 교체·되돌리기 내역은 초기화되고 초안을 다시
        만듭니다. 원문에만 있는 미지원 이수조건·실제 시간표는 별도 확인이
        필요해요.
      </p>
    </>
  );
}

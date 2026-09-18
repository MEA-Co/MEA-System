import type { ConfirmedAdjustment } from '../../_lib/confirmed-adjustment';

export function ConfirmedAdjustmentSummary({
  proposal,
  department,
}: {
  proposal: ConfirmedAdjustment;
  department: string;
}) {
  return (
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
  );
}

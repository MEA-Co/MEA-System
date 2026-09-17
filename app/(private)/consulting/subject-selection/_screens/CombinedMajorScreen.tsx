'use client';

import { ArrowRight, Search } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  findPriorityProfile,
  PRIORITY_PROFILES,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';

import {
  buildCombinedMajorDraft,
  type MajorBalance,
} from '../_lib/combined-major';
import {
  type ConfirmedAdjustment,
  findConfirmedAdjustment,
} from '../_lib/confirmed-adjustment';
import type { ConfirmedCurriculum } from '../_lib/curriculum';

import { ConfirmedAdjustmentSummary } from './_components/ConfirmedAdjustmentSummary';
import { StandardDraftPlan } from './_components/StandardDraftPlan';

const departments = [
  ...new Set(PRIORITY_PROFILES.flatMap((profile) => profile.departments)),
].sort();

export function CombinedMajorScreen({
  curriculum,
  department,
  profile,
  confirmedIds,
  recommendedIds,
  onViewStandard,
  onApplyAdjustment,
}: {
  curriculum: ConfirmedCurriculum;
  department: string;
  profile: PriorityProfile | null;
  confirmedIds: string[];
  recommendedIds: string[];
  onViewStandard: () => void;
  onApplyAdjustment: (proposal: ConfirmedAdjustment) => string | null;
}) {
  const departmentInput = useRef<HTMLInputElement>(null);
  const [other, setOther] = useState('');
  const [balance, setBalance] = useState<MajorBalance>('primary');
  const [error, setError] = useState('');
  const [adjustment, setAdjustment] = useState<ReturnType<
    typeof findConfirmedAdjustment
  > | null>(null);
  const [consent, setConsent] = useState(false);
  const [applied, setApplied] = useState(false);
  const [review, setReview] = useState<{
    department: string;
    profile: PriorityProfile;
    result: ReturnType<typeof buildCombinedMajorDraft>;
  } | null>(null);
  const reset = () => {
    setAdjustment(null);
    setConsent(false);
    setApplied(false);
    setReview(null);
    setError('');
  };
  return (
    <section className="mt-6 space-y-6">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const name = other.trim();
          if (!profile) {
            setError('기존 희망 학과의 기준을 먼저 확인해 주세요.');
            return;
          }
          if (name === department.trim()) {
            setError('기존 희망 학과와 다른 학과를 골라 주세요.');
            return;
          }
          if (!departments.includes(name)) {
            setError(
              '목록에 등록된 학과를 선택해 주세요. 미등록 학과는 아직 검토할 수 없어요.',
            );
            return;
          }
          const match = findPriorityProfile(name);
          if (!match) {
            setError('해당 학과의 기준을 찾지 못했어요.');
            return;
          }
          setError('');
          setAdjustment(null);
          setConsent(false);
          setApplied(false);
          setReview({
            department: name,
            profile: match.profile,
            result: buildCombinedMajorDraft(
              curriculum,
              confirmedIds,
              profile,
              match.profile,
              balance,
              recommendedIds,
            ),
          });
        }}
      >
        <label className="block text-sm font-medium">
          실제 지원을 고려 중인 다른 학과가 있나요?
          <input
            ref={departmentInput}
            list="combined-major-departments"
            required
            value={other}
            onChange={(event) => {
              setOther(event.target.value);
              reset();
            }}
            placeholder="예: 행정학과"
            className="mt-2 block w-full rounded-md border bg-background p-3"
          />
          <datalist id="combined-major-departments">
            {departments
              .filter((name) => name !== department)
              .map((name) => (
                <option key={name} value={name} />
              ))}
          </datalist>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">
            추가 학과는 {department}에 비해 어느 정도로 고려하나요?
          </legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {(
              [
                ['primary', '조금 후순위로 고려해요'],
                ['equal', '같은 비중으로 고려해요'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="major-balance"
                  value={value}
                  checked={balance === value}
                  onChange={() => {
                    setBalance(value);
                    reset();
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit">
          <Search className="size-4" />
          함께 준비할 과목 검토
        </Button>
      </form>
      {review && (
        <>
          {applied && (
            <p role="status" className="text-sm text-emerald-800">
              동의한 변경안을 1단계 확정에 반영했습니다. 2단계 초안도 새
              기준으로 재생성했어요.
            </p>
          )}
          <div
            role="status"
            className={`border-l-4 p-4 ${review.result.status === 'both' ? 'border-emerald-500 bg-emerald-50' : 'border-amber-500 bg-amber-50'}`}
          >
            <h3 className="font-semibold">
              {review.result.status === 'both'
                ? '함께 준비할 수 있는 초안'
                : review.result.status === 'review'
                  ? '병행 검토를 위해 기존 선택 조정이 필요해요'
                  : `${department} 중심의 준비를 추천해요`}
            </h3>
            <p className="mt-2 text-sm leading-6">
              {review.result.status === 'both'
                ? '이 초안은 양쪽 코어와 심화 준비 기준을 충족하고, 기존 전공의 준비 깊이와 공통 기반도 확보했어요. 실제 지원 의사는 추가 상담으로 확인해 주세요.'
                : review.result.status === 'focused'
                  ? '양쪽 코어를 담을 수 있어도 준비 깊이·기존 전공의 손실·공통 기반을 함께 고려하면 병행을 추천할 근거가 부족해요.'
                  : '현재 확정을 유지한 자동 초안에서는 일부 코어·선행 조건을 충족하지 못했어요. 학과 조합 자체의 비추천 판정은 아니에요. 아래 미확보 과목의 개설 여부와 선택 자리를 확인하고, 기존 선택을 조정한 뒤 준비 깊이를 다시 검토해야 해요.'}
            </p>
            <p className="mt-2 text-xs leading-5">
              검토용 초안이며 기존 선택은 변경되지 않았어요. ‘함께 준비’는 입시
              경쟁력 판정이 아닙니다. 학교별 세부 이수조건·시간표와 실제 관심
              주제의 연결은 추가 확인이 필요해요.
            </p>
          </div>
          {review.result.status !== 'both' && profile && (
            <section className="space-y-3 border-y py-4">
              <h3 className="font-semibold">1단계 확정 과목 조정</h3>
              <p className="text-sm leading-6">
                기존 전공 코어와 등록된 이수조건을 유지하면서, 두 학과의 준비
                기준을 충족할 수 있는 교체안을 찾아봅니다. 확인 전에는 선택을
                바꾸지 않아요.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setError('');
                  setConsent(false);
                  setAdjustment(
                    findConfirmedAdjustment(
                      curriculum,
                      confirmedIds,
                      profile,
                      review.profile,
                      balance,
                      recommendedIds,
                    ),
                  );
                }}
              >
                <Search />
                조정안 찾아보기
              </Button>
              {adjustment && !adjustment.proposal && (
                <p role="status" className="text-sm text-amber-800">
                  최대 {adjustment.maxChanges}과목 교체 범위에서 조건을 지키는
                  병행 추천안을 찾지 못했어요.
                  {adjustment.limited ? ' 탐색 한도에 도달했습니다.' : ''} 모든
                  조합이 불가능하다는 뜻은 아니며, 편제와 확정 조건을 별도로
                  검토해야 해요.
                </p>
              )}
              {adjustment?.proposal && (
                <>
                  <ConfirmedAdjustmentSummary
                    proposal={adjustment.proposal}
                    department={review.department}
                  />
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                    />
                    위 과목의 1단계 확정 변경과 2단계 초안 재생성에 동의합니다.
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!consent}
                      onClick={() => {
                        const proposal = adjustment.proposal!;
                        const problem = onApplyAdjustment(proposal);
                        if (problem) {
                          setError(problem);
                          return;
                        }
                        setReview({ ...review, result: proposal.result });
                        setApplied(true);
                        setAdjustment(null);
                        setConsent(false);
                      }}
                    >
                      변경안 적용
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAdjustment(null);
                        setConsent(false);
                      }}
                    >
                      기존 선택 유지
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}
          {review.result.status !== 'both' ? (
            <div className="space-y-3">
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-amber-800">
                {review.result.assessments.map((assessment, index) => {
                  const name = index === 0 ? department : review.department;
                  const depth =
                    index === 0
                      ? review.result.depth.first
                      : review.result.depth.second;
                  return (
                    <li key={name}>
                      {name}:{' '}
                      {assessment.missing.length || assessment.choices.length
                        ? `코어 미확보 · ${[...assessment.missing, ...assessment.choices.map((rule) => `${rule.label} ${rule.count}/${rule.choose}${rule.include ? ` (${rule.include.label} ${rule.included}/${rule.include.choose})` : ''}`)].join(', ')}`
                        : '코어 확보'}
                      {!depth.sufficient &&
                        ` / 심화·보완 준비 부족 (${depth.depth.length}/${depth.minimum}과목${depth.missingFoundation.length ? ', 기초 과목 누락' : ''})`}
                    </li>
                  );
                })}
                {review.result.depth.shared.length < 2 && (
                  <li>
                    양쪽 준비에 직접 도움이 되는 공통 기반{' '}
                    {review.result.depth.shared.length === 0
                      ? '없음'
                      : `부족 · ${review.result.depth.shared.map((course) => course.name).join(', ')} (1과목)`}
                  </li>
                )}
                {review.result.depth.retention === null ? (
                  <li>
                    기존 전공 단독안에 비교할 심화·보완 과목이 없어 준비 깊이
                    유지 여부를 판단하기 어려움
                  </li>
                ) : (
                  review.result.depth.retention < 0.75 && (
                    <li>
                      기존 전공 심화·보완 과목 유지율{' '}
                      {Math.round(review.result.depth.retention * 100)}% ·{' '}
                      {review.result.depth.lost
                        .map((course) => course.name)
                        .join(', ')}
                      이 빠짐
                    </li>
                  )
                )}
                {review.result.gaps.map((gap) => (
                  <li key={gap.advanced}>
                    {gap.advanced}의 선행 기반인 {gap.basic}이 빠져 있음
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                메아의 임시 과목 준비 기준이며, 대학의 공식 요건이나 합격 가능성
                판정은 아닙니다.
              </p>
              <p className="text-sm leading-6">
                {review.result.status === 'review'
                  ? '위에서 조정안을 검토하거나 다른 학과·기본 추천안을 확인해 주세요. 변경안에 동의하기 전에는 현재 확정을 유지합니다.'
                  : `다른 학과를 검토하거나, 기존 희망 학과인 ${department} 위주로 준비하는 기본 추천안을 확인해 주세요.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOther('');
                    reset();
                    departmentInput.current?.focus();
                  }}
                >
                  <Search />
                  다른 학과 고르기
                </Button>
                <Button onClick={onViewStandard}>
                  <ArrowRight />
                  1번 기본 추천안 보기
                </Button>
              </div>
            </div>
          ) : (
            <>
              <section className="space-y-3 border-y py-4">
                <h3 className="font-semibold">
                  과목으로 확인하는 병행 준비의 현실성
                </h3>
                <p className="text-sm">
                  기존 전공 단독 준비안의 심화·보완 과목 유지:{' '}
                  {review.result.depth.retention === null
                    ? '비교할 과목 없음 · 판단 보류'
                    : `${Math.round(review.result.depth.retention * 100)}%`}
                </p>
                <p className="text-sm">
                  줄어드는 기존 전공 심화·보완 과목:{' '}
                  {review.result.depth.lost
                    .map((course) => course.name)
                    .join(', ') || '없음'}
                </p>
                <p className="text-sm">
                  양쪽 코어·심화에 직접 쓰이는 공통 기반:{' '}
                  {review.result.depth.shared
                    .map((course) => course.name)
                    .join(', ') || '없음'}
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {!review.result.depth.first.sufficient && (
                    <li>기존 희망 학과의 영역별 심화 준비가 부족합니다.</li>
                  )}
                  {!review.result.depth.second.sufficient && (
                    <li>추가 학과의 영역별 심화 준비가 부족합니다.</li>
                  )}
                  {review.result.depth.retention !== null &&
                    review.result.depth.retention < 0.75 && (
                      <li>
                        기존 전공 단독안보다 심화·보완 과목이 25% 넘게
                        줄어듭니다.
                      </li>
                    )}
                  {review.result.depth.shared.length < 2 && (
                    <li>
                      양쪽 준비를 함께 뒷받침하는 공통 기반이 2과목 미만입니다.
                      연결 가능한 이야기만으로 병행을 추천하지 않습니다.
                    </li>
                  )}
                </ul>
                <details className="text-xs leading-5 text-muted-foreground">
                  <summary className="cursor-pointer">
                    메아 임시 판단 기준
                  </summary>
                  <p className="mt-2">
                    학과의 핵심·Sub core 과학 영역에 연결된 진로선택과 지정 보완
                    과목을 깊이로 계산합니다. 예를 들어 화학이 보완 영역이면
                    물질과 에너지·화학 반응의 세계도 인정합니다. 과학 심화는
                    기초 과목 이수도 함께 확인하며, 단순히 추천 과목군에
                    속한다는 이유만으로 인정하지 않습니다. 심화 과목은 코어
                    여부와 무관하게 인정하고, 코어 밖 추가 과목은 참고 지표로만
                    봅니다. 기준에 등록된 깊이 과목 중 최대 2개 이상, 기존 전공
                    단독안 깊이 과목의 75% 이상 유지, 공통 코어·깊이 과목 2개
                    이상을 함께 확인합니다. 같은 과목은 한 번만 셉니다. 개설
                    과목이 부족하다고 기준을 낮추지는 않습니다. 대학의 공식
                    요구나 합격 가능성 기준이 아닌 상담용 초안이며, 단독안도
                    자동 생성 결과이므로 최적 조합을 보장하지 않습니다.
                  </p>
                </details>
              </section>
              <div className="grid gap-6 md:grid-cols-2">
                {review.result.assessments.map((assessment, index) => (
                  <section key={index} className="border-t pt-4">
                    <h3 className="font-semibold">
                      {index === 0 ? department : review.department}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      적용 기준:{' '}
                      {index === 0 ? profile?.label : review.profile.label}
                    </p>
                    <p className="mt-3 text-sm">
                      미확보 코어: {assessment.missing.join(', ') || '없음'}
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      준비 깊이:{' '}
                      {(index === 0
                        ? review.result.depth.first
                        : review.result.depth.second
                      ).sufficient
                        ? '임시 기준 충족'
                        : '보완 필요'}
                    </p>
                    <p className="mt-1 text-sm">
                      심화·지정 보완 과목 (
                      {
                        (index === 0
                          ? review.result.depth.first
                          : review.result.depth.second
                        ).depth.length
                      }
                      /
                      {
                        (index === 0
                          ? review.result.depth.first
                          : review.result.depth.second
                        ).minimum
                      }
                      ):{' '}
                      {(index === 0
                        ? review.result.depth.first
                        : review.result.depth.second
                      ).depth
                        .map((course) => course.name)
                        .join(', ') || '없음'}
                    </p>
                    <p className="mt-1 text-sm">
                      코어 최소조건 외 추가 보완 (필수 조건 아님):{' '}
                      {(index === 0
                        ? review.result.depth.first
                        : review.result.depth.second
                      ).beyondCore
                        .map((course) => course.name)
                        .join(', ') || '없음'}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {(index === 0
                        ? review.result.depth.first
                        : review.result.depth.second
                      ).evidence.map(({ course, reason }) => (
                        <li key={course.id}>
                          {course.name} · {reason}
                        </li>
                      ))}
                    </ul>
                    {assessment.choices.map((rule) => (
                      <p key={rule.id} className="mt-2 text-sm text-amber-800">
                        {rule.label}: {rule.courses.join(', ')} 중 {rule.choose}
                        개 · 현재 {rule.count}개
                        {rule.include
                          ? ` / ${rule.include.label}: ${rule.included}/${rule.include.choose}`
                          : ''}
                      </p>
                    ))}
                    <p className="mt-2 text-sm">
                      그 외 관련 과목 참고 (깊이 충족과 별도):{' '}
                      {[
                        ...new Set(
                          assessment.support.map((course) => course.name),
                        ),
                      ].join(', ') || '미확보'}
                    </p>
                  </section>
                ))}
              </div>
              <dl className="space-y-4 border-y py-4 text-sm">
                {[
                  ['공통으로 도움 되는 과목', review.result.shared],
                  [
                    '코어·선행 조건을 위해 추가한 과목',
                    review.result.additions,
                  ],
                  ['현재 추천안에서 빠지는 과목', review.result.displaced],
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
              {review.result.gaps.map((gap) => (
                <p key={gap.advanced} className="text-sm text-red-700">
                  {gap.advanced}의 기초 과목 {gap.basic}이 빠져 있어요.
                </p>
              ))}
              <StandardDraftPlan terms={review.result.terms} combined />
            </>
          )}
        </>
      )}
    </section>
  );
}

'use client';

import { ArrowRight, Search } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  findPriorityProfile,
  PRIORITY_PROFILES,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';

import { buildCombinedMajorDraft } from '../_lib/combined-major';
import {
  type ConfirmedAdjustment,
  findConfirmedAdjustment,
} from '../_lib/confirmed-adjustment';
import type { StandardDraftTerm } from '../_lib/course-selection-draft';
import type { ConfirmedCurriculum } from '../_lib/curriculum';
import {
  type MajorReviewScreening,
  screenMajorReview,
} from '../_lib/major-review-screening';

import { CombinedMajorDetails } from './_components/CombinedMajorDetails';
import { ConfirmedAdjustmentSummary } from './_components/ConfirmedAdjustmentSummary';
import { MajorIntentReview } from './_components/MajorIntentReview';
import { StandardDraftPlan } from './_components/StandardDraftPlan';
import { CombinedDraftCounselingScreen } from './CombinedDraftCounselingScreen';

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
  onFinalize,
}: {
  curriculum: ConfirmedCurriculum;
  department: string;
  profile: PriorityProfile | null;
  confirmedIds: string[];
  recommendedIds: string[];
  onViewStandard: () => void;
  onApplyAdjustment: (proposal: ConfirmedAdjustment) => string | null;
  onFinalize: (terms: StandardDraftTerm[], secondaryDepartment: string) => void;
}) {
  const departmentInput = useRef<HTMLInputElement>(null);
  const [other, setOther] = useState('');
  const [error, setError] = useState('');
  const [adjustment, setAdjustment] = useState<ReturnType<
    typeof findConfirmedAdjustment
  > | null>(null);
  const [consent, setConsent] = useState(false);
  const [applied, setApplied] = useState(false);
  const [intentReady, setIntentReady] = useState(false);
  const [reviewVersion, setReviewVersion] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [review, setReview] = useState<{
    department: string;
    profile: PriorityProfile;
    result: ReturnType<typeof buildCombinedMajorDraft>;
    screening: MajorReviewScreening;
  } | null>(null);
  const reset = () => {
    setAccepted(false);
    setAdjustment(null);
    setConsent(false);
    setApplied(false);
    setIntentReady(false);
    setReview(null);
    setError('');
  };
  if (accepted && review && profile)
    return (
      <section className="mt-6 space-y-6">
        <Button variant="outline" onClick={() => setAccepted(false)}>
          학과 조합 다시 검토 · 상담 교체 초기화
        </Button>
        <CombinedDraftCounselingScreen
          onFinalize={(terms) => onFinalize(terms, review.department)}
          curriculum={curriculum}
          department={department}
          secondaryDepartment={review.department}
          profile={profile}
          secondaryProfile={review.profile}
          confirmedIds={confirmedIds}
          initialTerms={review.result.terms}
        />
      </section>
    );
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
          setIntentReady(false);
          setReviewVersion((value) => value + 1);
          setReview({
            department: name,
            profile: match.profile,
            screening: screenMajorReview(curriculum, profile, match.profile),
            result: buildCombinedMajorDraft(
              curriculum,
              confirmedIds,
              profile,
              match.profile,
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
                  ? review.screening.worthReviewing
                    ? '과목 조정 전에 지원 목적을 확인해요'
                    : `${department} 중심의 준비를 우선 추천해요`
                  : `${department} 중심의 준비를 추천해요`}
            </h3>
            <p className="mt-2 text-sm leading-6">
              {review.result.status === 'both'
                ? '이 초안은 양쪽 코어와 보완 준비 기준을 충족하고, 기존 전공의 준비 깊이와 학문적 연결 기반도 확보했어요.'
                : review.result.status === 'focused'
                  ? '양쪽 코어를 담을 수 있어도 준비 깊이·기존 전공의 손실·공통 기반을 함께 고려하면 병행을 추천할 근거가 부족해요.'
                  : review.screening.worthReviewing
                    ? '학문적 연결은 검토할 만하지만 현재 초안의 코어·선행·보완 준비나 기존 전공 유지에 조정이 필요해요. 실제 지원을 고려하는지 확인한 뒤 조정안을 찾아봅니다.'
                    : '현재 초안의 코어 부족 외에도 공통 학습 기반이나 개설 과목에 제약이 있어요. 추가 질문보다는 기존 전공의 기본 추천안이나 다른 학과를 확인해 주세요.'}
            </p>
          </div>
          {review.result.status === 'review' && profile && (
            <MajorIntentReview
              key={`${reviewVersion}-${department}-${review.department}`}
              primary={department}
              secondary={review.department}
              screening={review.screening}
              onViewStandard={onViewStandard}
              onDecision={(ready) => {
                setIntentReady(ready);
                setAdjustment(null);
                setConsent(false);
              }}
            />
          )}
          {review.result.status !== 'both' &&
            profile &&
            (review.result.status !== 'review' || intentReady) && (
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
                    {adjustment.limited
                      ? ' 탐색 한도에 도달했습니다.'
                      : ''}{' '}
                    모든 조합이 불가능하다는 뜻은 아니며, 편제와 확정 조건을
                    별도로 검토해야 해요.
                  </p>
                )}
                {adjustment?.proposal && (
                  <>
                    <ConfirmedAdjustmentSummary
                      proposal={adjustment.proposal}
                      department={review.department}
                    />
                    <p className="text-sm leading-6 text-amber-900">
                      위 과목으로 바꾸면서 {department} 준비와 함께{' '}
                      {review.department}의 기초·심화 공부도 이어갈 수 있을까요?
                      부담이 크다면 기존 선택을 유지해도 괜찮아요.
                    </p>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(event) => setConsent(event.target.checked)}
                      />
                      위 과목의 1단계 확정 변경과 2단계 초안 재생성에
                      동의합니다.
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
                {review.result.depth.humanities && (
                  <li>
                    {review.result.depth.humanities.label}:{' '}
                    {review.result.depth.humanities.reason}{' '}
                    {review.result.depth.humanities.independentStudy} 공통 과목
                    수는 탈락 조건으로 사용하지 않아요.
                  </li>
                )}
                {!review.result.depth.connectionSupported && (
                  <li>
                    양쪽 준비에 직접 도움이 되는 공통 기반{' '}
                    {review.result.depth.shared.length === 0
                      ? '없음'
                      : `부족 · ${review.result.depth.shared.map((course) => course.name).join(', ')} (1과목)`}
                  </li>
                )}
                {review.result.depth.method.relationship && (
                  <li>
                    {review.result.depth.method.relationship.label}:{' '}
                    {review.result.depth.method.relationship.reason}
                    {review.result.depth.method.groups.map((group) => (
                      <p key={group.label}>
                        {group.label}: {group.count}/{group.choose}과목
                      </p>
                    ))}
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
              <p className="text-sm leading-6">
                {review.result.status === 'review' &&
                review.screening.worthReviewing
                  ? '지원 의향을 선택한 뒤 필요한 과목 변경을 확인하거나, 다른 학과·기본 추천안을 살펴보세요. 변경안에 동의하기 전에는 현재 확정을 유지합니다.'
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
                  양쪽 준비에 함께 쓰이는 과목 (참고):{' '}
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
                  {!review.result.depth.connectionSupported && (
                    <li>
                      양쪽 준비를 함께 뒷받침하는 공통 기반이 2과목 미만입니다.
                      연결 가능한 이야기만으로 병행을 추천하지 않습니다.
                    </li>
                  )}
                </ul>
                {review.result.depth.humanities && (
                  <p className="text-sm">
                    학문적 접점: {review.result.depth.humanities.reason}{' '}
                    {review.result.depth.humanities.independentStudy} 공통 과목
                    수와 별개로 각 전공의 준비를 확인했어요.
                  </p>
                )}
                {review.result.depth.method.relationship && (
                  <p className="text-sm">
                    연구 방법 연계:{' '}
                    {review.result.depth.method.relationship.reason}{' '}
                    {review.result.depth.method.groups
                      .map(
                        (group) =>
                          `${group.label} ${group.count}/${group.choose}`,
                      )
                      .join(' · ')}
                  </p>
                )}
              </section>
              <CombinedMajorDetails
                department={department}
                secondaryDepartment={review.department}
                primaryLabel={profile?.label}
                secondaryLabel={review.profile.label}
                result={review.result}
              />
              {review.result.gaps.map((gap) => (
                <p key={gap.advanced} className="text-sm text-red-700">
                  {gap.advanced}의 기초 과목 {gap.basic}이 빠져 있어요.
                </p>
              ))}
              <StandardDraftPlan terms={review.result.terms} combined />
              <Button onClick={() => setAccepted(true)}>
                <ArrowRight />이 초안으로 상담하기
              </Button>
            </>
          )}
        </>
      )}
    </section>
  );
}

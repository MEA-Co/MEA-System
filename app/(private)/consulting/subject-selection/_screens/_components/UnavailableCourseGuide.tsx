import { ChevronDown } from 'lucide-react';

export function UnavailableCourseGuide() {
  return (
    <section
      aria-label="학교 미개설 과목 안내"
      className="mt-5 space-y-5 border-y py-5 text-sm leading-7"
    >
      <div className="space-y-3 border-l-4 border-emerald-500 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
        <h3 className="font-semibold text-emerald-900 dark:text-emerald-200">
          학교에 과목이 없다고 너무 걱정하지 마세요
        </h3>
        <p>
          특정 과목이 개설되지 않아 수강하지 못한 상황을, 개설된 과목을 선택하지
          않은 상황과 똑같이 생각할 필요는 없어요. 대학은 학교의 교육과정 편성
          현황을 통해 과목 선택의 여건과 이수 노력을 확인할 수 있습니다. 따라서
          [안 들은 것]과 [못 들은 것]을 대학은 다르게 평가하며, 못 들은 것은
          참작하여 평가합니다.
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">
          온라인학교와 공동교육과정을 확인해 보세요
        </h3>
        <p>
          우리 학교에서 열리지 않는 과목을 다른 학교나 온라인학교에서 배울 수
          있는 길이에요. 관심 분야의 과목을 찾아 배우는 과정은 진로 탐색과 학습
          의지를 보여줄 수 있으니, 적절한 과목이 있다면 적극적으로 검토해
          보세요. 수강 자체가 가점이나 좋은 평가를 보장하는 것은 아니며, 실제로
          무엇을 배우고 탐구했는지도 중요합니다.
        </p>
        <p>
          신청 자격·개설 과목·운영 방식은 학교와 교육청마다 달라요. 신청 전 담임
          선생님이나 교육과정 담당 선생님께 수강 가능 여부, 일정, 학점 인정
          방식과 학생부 기록을 문의해 주세요.
        </p>
      </div>
      <div className="divide-y border-y">
        <details className="group py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
            공동교육과정과 온라인학교 중 무엇을 들어야 하나요?
            <ChevronDown
              className="mt-1 size-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="mt-3 space-y-2 text-muted-foreground">
            <p>
              먼저 내가 듣고 싶은 과목이 개설되는 쪽을 확인하세요. 둘 다
              열린다면 과목의 내용, 시간표, 이동 거리, 수업 방식과 학습 부담을
              비교해 꾸준히 참여할 수 있는 쪽을 고르면 됩니다.
            </p>
            <p>
              공동교육과정은 다른 학교에 가서 듣는 대면 방식뿐 아니라 온라인
              방식도 있어요. 온라인학교는 원격수업 중심이지만 출석·평가 등 세부
              운영은 확인해야 합니다. 어느 쪽이 대입에서 무조건 더 유리하다고
              보기보다는 과목의 적합성과 학습 내용을 우선하세요.
            </p>
          </div>
        </details>
        <details className="group py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
            석차등급이 나오지 않으면 불이익이 있나요?
            <ChevronDown
              className="mt-1 size-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="mt-3 space-y-2 text-muted-foreground">
            <p>
              석차등급이 없다는 이유만으로 불리하다고 생각할 필요는 없어요.
              공동교육과정과 온라인학교는 석차등급을 산출하지 않는 방식으로
              운영되며, 과목에 따라 원점수·성취도와 세부능력 및 특기사항 등 학습
              결과가 기록됩니다. 과목별 기록 항목은 학교에 확인해 주세요.
            </p>
            <p>
              학교에 없는 과목을 찾아 배우는 노력은 관심 분야를 더 깊게 공부한
              과정으로 설명할 수 있어요. 다만 학생부에 기록되는 것과 대학의 교과
              점수에 반영되는 것은 다릅니다. 특히 학생부교과전형의 성적 환산은
              대학마다 다를 수 있으므로 모집요강을 확인하고, 등급 유무만으로
              포기하거나 수강만으로 평가상 이익이 보장된다고 생각하지는 마세요.
            </p>
          </div>
        </details>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">
          참고 자료 · 2026년 9월 확인
        </summary>
        <ul className="mt-2 space-y-1">
          <li>
            <a
              className="underline underline-offset-2"
              href="https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=105223&lev=0"
              target="_blank"
              rel="noreferrer"
            >
              교육부 · 고교학점제 운영 개선 안내
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-2"
              href="https://home.pen.go.kr/hscredit/cm/cntnts/cntntsView.do?cntntsId=3734&mi=17427"
              target="_blank"
              rel="noreferrer"
            >
              부산교육청 · 공동교육과정과 온라인학교 운영 안내 (지역 사례)
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-2"
              href="https://star.moe.go.kr/web/contents/m20103.do?id=108056&schM=view"
              target="_blank"
              rel="noreferrer"
            >
              교육부 · 학교생활기록 작성 및 관리지침
            </a>
          </li>
        </ul>
      </details>
    </section>
  );
}

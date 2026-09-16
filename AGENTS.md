<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 컨설팅 공통 아키텍처 — 빠른 참조

컨설팅 작업은 아래 지도로 필요한 파일부터 읽는다. 전체 폴더 탐색보다 관련 구현을 우선 확인한다. 개별 컨설팅의 문구·단계·분석 내용은 공통 코어에 넣지 않는다.

### 구조와 책임

- **Plan → Agent ↔ Memory → Renderer / Tools**. 사용자 행동이 Agent에 들어오고, Agent가 Plan에 따라 화면 요청·도구 요청·단계 전환을 처리한다.
- **Plan** (`features/consulting/core/plan/{types,plan}.ts`): 시작 노드, 초기 context, 화면 노드, 행동별 전환(`on`), 조건(`guard`), 도구 실행(`effects`), 진행률, 완료 여부를 정의한다. 현재 노드 종류는 `screen`뿐이며, 고정된 컨설팅 순서는 없다.
- **Agent** (`features/consulting/core/agent/agent.ts`): Plan을 실행하는 상태 머신. LLM이 진행을 판단하는 구조가 아니다. 현재 노드·화면·대기 요청·세션·오류를 관리한다. 상태는 `waiting-for-user | complete | error`; 도구 실행 상태는 별도 Runtime이 관리한다.
- **Memory** (`features/consulting/core/agent/memory.ts`): 초기 `context`, 노드별 최신 `actions`, 결과 키별 `toolResults`·`toolErrors`, 최근 입력·결과·오류. 전체 대화 이력이 아니며 코어에 영속 저장·복원 기능은 없다. 현재 Agent는 전환이 있는 행동만 `actions`에 기록한다.
- **Renderer** (`features/consulting/core/renderer/`): 화면 ID를 실제 화면에 연결한다. `static`은 ID만, `dynamic`은 ID와 `data`를 전달한다. 진행 규칙과 화면 구현을 분리한다.
- **Tools** (`features/consulting/core/tools/`): 입력을 받아 결과/오류를 반환하는 작업 계약. AI·분석·생성 구현은 개별 도구에 둔다. `runtime.ts`는 상태 구독, 취소, 재시도, 그룹 관리, 동일 키의 `parallel/reuse/replace` 실행 정책을 제공한다.
- **User protocol** (`features/consulting/core/user/protocol.ts`): 제출·이전·재시도·초기화 등 공통 행동 타입. 새 행동 추가 시 이 계약과 Plan을 함께 확인한다.

### 실행 시 주의할 규칙

- 행동 처리 순서: 전환 조건 확인 → 입력 기록 → 도구 요청 등록 → 다음 노드 진입. 도구 완료를 기다리고 전환하는 구조가 아니다.
- 도구 응답은 Memory를 갱신하지만 자동으로 노드를 전환하지 않는다. 동일 `resultKey`에는 최신 호출의 응답만 반영한다.
- 화면과 도구는 요청/응답 프로토콜로 Agent와 연결된다. Agent는 요청을 대기 목록에 올리고, UI 연결층이 실행 후 `resolveModuleCall` / `rejectModuleCall`로 반환한다.
- `terminal` 노드 진입이 Agent의 완료 기준이다. 결과 저장 성공과는 별개다.

### 작업별 진입점

| 변경 대상 | 먼저 읽을 위치 |
| --- | --- |
| 공통 실행·상태·전환 | `features/consulting/core/agent/agent.ts`, `core/plan/types.ts` (후자는 `features/consulting/` 기준) |
| UI와 엔진 연결 | `app/(private)/consulting/_hooks/useConsultingAgent.ts` — Agent·Runtime·Logger 생성, 요청 실행, 상태 구독. 화면 요청 처리는 검증/응답이며 실제 화면 표시는 UI가 담당 |
| 공통 화면·버튼·작업 상태 | `app/(private)/consulting/_components/` — `ConsultingFlow`, `ConsultingScreenView`, `ConsultingFrame`, `ConsultingToolStatus` 등 |
| 개별 컨설팅 추가·수정 | `app/(private)/consulting/<컨설팅>/` — `_lib/plan.ts`, `_lib/renderer.ts`, `_lib/tools.ts`, `_lib/types.ts`, `_screens/`, `_tools/`. 현재 참고 구현은 `material-box` |
| 시나리오별 화면 검토 | `features/consulting/core/review/types.ts`, 공통 `ConsultingReview.tsx`, 개별 `_lib/review.ts` |
| 실행 로그 | `features/consulting/core/logger/`, 공통 `ConsultingDebugConsole.tsx` |
| 결과 저장·보고서 | `features/consulting/completion.ts`, `features/consulting/report/`, 개별 `_lib/completion.ts`·`_report/`. 저장·보고서 내용은 코어 밖에서 연결 |

새 컨설팅은 **Plan + 초기 데이터 구조 + 화면/Renderer 등록 + Tools**를 조립하고 공통 실행 엔진을 재사용한다. 위 내용은 현재 구현의 탐색 지도이며, 변경 시 관련 코드와 이 요약을 함께 갱신한다.

전체 검토의 단계별 `statePresentation: 'substeps'`는 여러 화면을 왼쪽 단계 목록의 들여쓰기된 하위 항목으로 표시한다. 기본값은 상태 탭이며, 모바일에서는 하위 화면도 탭으로 선택한다.

### 별도 컨설팅: 생활기록부 브랜딩

- `/consulting/branding` → `app/(private)/consulting/branding/`. 학생의 목록에서는 숨기고 직접 접속도 서버에서 차단한다. 컨설턴트와 관리자는 접근할 수 있다. 기존 `/consulting/material-box`와 독립된 컨설팅이며 Plan ID는 `branding-consulting`이다.
- 진행 순서: **도입 → 전공 세부 키워드 → 전공 가치관 → 계열 적합 역량 → 한 줄 서사 → 모아보기**. `_lib/plan.ts`에 단계·산출물 계약·전환을, `_components/BrandingConsulting.tsx`에 입력 화면·Renderer를 둔다.
- 도입은 `_components/BrandingIntro.tsx`에서 세특 선택 → 타이핑 설명과 강조 → 선행·후속 탐구 연결을 표시한다. Plan의 `intro` 노드는 진행률 `0/4`이며 `user.start-input`으로 `primary-major`에 진입한다. 도입 내부 설명 순서와 선택은 화면 로컬 상태이며 공통 코어에 넣지 않는다. 타이핑은 공통 `ConsultingPrompter`의 `flat` 스타일을 사용한다.
- 전공 세부 키워드는 `primary-major`(1순위 필수) → `additional-majors`(2·3순위 선택) → `major-confirmation` → `keyword-guide` → `keywords` 순서이며 모두 진행률 `1/4`다. `_components/BrandingMajorScreen.tsx`가 전공 입력을 담당하며 전공은 노드별 Memory actions, 작성 중 값은 Flow draft로 보존한다. 1·2·3순위는 `features/keywords/major-search/`의 검색·확인 로직과 브랜딩 UI `_components/BrandingMajorSearchInput.tsx`를 사용하며 확정 값은 DB `majors.id`·대표명·확인 요청 ID다. 1순위는 저장 성공 콜백의 최신 확정 draft로 user.submit을 보내 추가 전공 화면으로 자동 이동한다. 2·3순위는 자동 이동하지 않는다. 하단 이전 버튼은 키워드 작성 → 1순위 전공, 1순위 전공 → 도입 설명, 추가 전공 → 1순위 전공으로 이동한다. 키워드의 이전 이동은 누적 outputs를 user.submit으로 전달하고 작성 중 값은 Flow draft로 유지한다. 브랜딩 `_hooks/useBrandingMajorSearch.ts`가 Flow draft·확인 상태를 관리하고 `_context/BrandingMajorSearchContext.tsx`의 `BrandingMajorSearchProvider`로 세 순위가 내려받은 목록을 공유한다. 입력 중에는 한글 조합 여부와 무관하게 300ms 디바운스로 브라우저에서 검색하고, 후보 선택 시점의 입력 원문은 화면에서 보존하고, “네, 이 학과예요”로 확정할 때만 검색 스냅샷과 confirmed 피드백을 원자적으로 DB에 저장한다. “찾는 학과가 없어요”는 누른 당시 입력·후보 스냅샷과 no_match 피드백을 원자적으로 기록한다. 검색·후보 선택·거절은 DB에 기록하지 않는다. 검색 결과가 없으면 다른 명칭으로 검색하도록 안내하며 LLM은 호출하지 않는다. 목록 조회·최종 확정 저장은 공통 서버 함수를 사용하고 별도 검색 라우트는 없다. 이후 화면에서는 `readMajors`로 대표명을 읽어 브랜딩 노트에 표시한다. API·기록 테이블·필수 서버 설정과 적용 전 확인은 `docs/major-search.md`를 참고한다.
- `major-confirmation` → `keyword-guide`에서는 LLM 도구를 실행하지 않는다. `_components/MajorOverviews.tsx`가 확정된 majors.id로 `features/keywords/major-overview/actions.ts`를 호출하여 major_keywords·keyword_examples·major_university_sources·university_sources를 읽는다. `_components/MajorKeywordCloud.tsx`는 `d3-cloud`로 단어 크기·충돌을 계산한 수평 SVG 워드클라우드와 포인터·포커스·터치 강조 및 KeywordTooltip 말풍선 설명을 제공한다. 설명은 PC 마우스 위, 모바일 터치 위치 위에 표시하며 공간 부족 시 아래로 전환한다. 툴팁은 body 포털로 렌더링하고 바깥 누르기·스크롤·Escape로 닫는다. 배치는 브랜딩 `_hooks/useMajorCloudLayout.ts`에서 폰트 로딩 후 계산하며 크기 변경 시 재배치하고 대표 키워드와 보조 키워드를 같은 지역에 먼저 배치한 뒤 묶음의 외곽 사각형 대신 실제 개별 단어 경계로 충돌을 검사하여 묶음 사이 빈틈까지 채우는 타원형 나선 배치를 사용한다. 모든 단어의 회전은 0이며 미배치 단어는 공간을 늘려 재시도한다. 키워드 작성 화면은 전공 탭마다 BrandingKeywordInput → 워드클라우드 → 학과 사이트 순서다. 키워드는 하나씩 등록·삭제하는 배지로 표시하고 하나 이상 등록된 탭에 완료 배지를 표시한다. 등록값은 기존 [전공명] 및 줄바꿈 형식의 Flow draft로 보존하며 모든 전공에 키워드가 있어야 다음으로 진행한다. 학과 사이트는 DepartmentWebsitePreview에서 iframe과 새 탭으로 표시한다. 전체 검토도 같은 DB 자료를 읽으며 Runtime Provider를 요구하지 않는다.
- 키워드 작성 다음에는 `values-guide`(진행률 2/4)에서 `_components/BrandingValuesGuide.tsx`의 타이핑 안내를 보여준다. 키워드에 자신만의 생각을 더하는 의미를 설명하며, 같은 약학·신약 개발 키워드 앞에 환경 부담·안정성·접근성·개발 속도라는 네 가지 가치관을 붙인 예시를 보여준다. 각 가치관은 클릭해야 공개되며 네 개를 모두 열고 타이핑이 끝나야 다음으로 진행할 수 있다. 안내 이동은 누적 outputs를 담은 `user.submit`으로 처리하여 기존 입력을 보존한다.
- 전공 가치관(`values`, 진행률 2/4)은 `features/major-values/`의 독립적인 대화·메타데이터 조회·근거 검증·학생 확인 기능을 사용한다. 기존 전공 ID·순위와 전공별 키워드 원문을 관심사별로 보존하고 실제 `get_major_value_context` RPC로 설명·키워드·메타데이터를 조회한다. 왜 그 키워드에 관심이 있는지 먼저 묻고 학생이 말한 계기·끌리는 이유에서 중요한 기준과 방향으로 대화를 이어간다. 관심 초점 확인은 이유를 이해하는 데 필요한 경우에만 보조적으로 사용하며 연결은 학생 확인 후에만 공동 가설로 사용한다. 실제 학생 발언 참조, 잠정/확인/수정/제외, 조건·예외, 건너뛰기·조기 종료를 관리하고 확인된 문장과 남은 관심사를 `outputs.values`로 전달한다. Flow draft와 사용자별 sessionStorage에 저장하고 시작 화면에서 재입력 없이 재개한다. 브랜딩 `_lib/resume.ts`와 context의 `resumedMajors`가 재개 입력을 연결하며 공통 코어는 변경하지 않는다. 서버 함수는 컨설턴트·관리자 권한을 검증한다. 모델 설정은 `OPENAI_MAJOR_VALUES_MODEL`(기본 `gpt-5.6-luna`)이며 재료함·exploration에는 의존하지 않는다. 전체 검토에는 대화 시작과 근거가 있는 잠정 결과 샘플을 제공한다. 저장 범위·검증 명령·한계는 `docs/major-values-exploration.md`를 참고한다.
- 이전 이동도 누적 산출물과 방향을 담은 `user.submit`으로 처리한다. 일반 `user.back`은 노드의 기존 입력을 덮어쓰므로, 이 구조 변경 시 입력 보존을 확인한다. 공통 Flow의 단계별 draft를 사용한다. 가치관 탐색은 같은 탭의 sessionStorage에서도 재개할 수 있으나 브랜딩 산출물·대화의 서버 영속 저장은 연결하지 않았다.
- 전체 검토는 관리자·컨설턴트에게 제공하며 `_lib/review.ts`에서 도입 → 4개 산출물 → 모아보기로 구성한다. `전공 세부 키워드`의 하위 화면은 `1순위 전공`, `추가 전공`, `키워드 작성`을 같은 검토 단계의 `states`로 묶는다. 실제 Plan의 전공 입력 노드를 별도 최상위 검토 단계로 나열하지 않는다.

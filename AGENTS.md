<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 로컬 Supabase

- 로컬 구성·migration 복구와 운영 이력 차이는 `docs/local-supabase.md`를 먼저 확인한다. 전공 검색 migration 3개는 운영 객체가 있지만 운영 이력이 없고, 복구한 가치관 구조도 운영에 이미 있다. 이력 동등성 검토 없이 `db push`/원격 reset/`migration repair`를 실행하지 않는다. 개발 DB 초기화는 명시적으로 `db reset --local`을 사용한다. 로컬 Supabase 실행만으로 앱의 `.env` 연결이 바뀌지 않으며, 개발 환경 변수·Google OAuth·기준 데이터는 별도로 설정한다.

## 회원 역할

- 컨설턴트 배포본 맨 아래의 `QuestionnaireFreeResponse`는 선택 입력이다. `questionnaire_responses.free_response`에 일반 질문별 답변과 구분해 저장하며 기존 답변과 같은 10초 자동 저장·수동 저장·revision 충돌·완료 잠금을 적용한다. 입력 서식은 공통 RichText를 사용한다. 저장 요청의 `freeResponse`를 생략하는 이전 클라이언트는 기존 자유 응답을 보존하고, 빈 문자열을 보내면 지운다. 테스트는 `supabase/tests/questionnaire_free_response.sql`과 `scripts/verify-questionnaire-answers.mjs`다.

- 배포 후 검토 요청은 UI와 DB RPC 모두 차단하고 기존 요청 조회·확인은 유지한다. 컨설턴트 목록은 `ConsultantQuestionnaireList`의 답변 전/답변 완료 탭으로 나눈다. `QuestionnaireAnswers` + `QuestionAnswerEditor`는 `GET/PUT /api/questionnaires/:versionId/answers`와 `GET /responses`를 사용한다. 변경 시 10초 자동 저장·수동 저장, 모든 답변을 원자적으로 저장·잠그는 완료 확인 창을 제공한다. `answer-session.ts`는 중복 요청·불확실한 재시도·revision 충돌을 관리하고 미저장 입력은 원격 갱신으로 덮어쓰지 않는다. `questionnaire_responses`는 사용자/버전당 하나이며 `questionnaire_answers.id`는 수정 후에도 유지된다. 완료(submitted) 이후 DB RPC와 트리거가 수정을 차단한다. 배포본 상세를 열면 `open_questionnaire_response`로 assigned 응답을 만들고, 응답이 없는 배포본을 NEW로 표시한다. 컨설턴트 사이드바/답변 전 탭/목록의 NEW는 게시 확인 기록과 별개다. Realtime 사용자 채널로 본인의 답변·확인 변경만 알린다. 답변 쓰기는 본인만 가능하며 관리자 체험도 관리자 본인 응답으로 저장한다. 테스트: `supabase/tests/questionnaire_answers.sql`, `scripts/verify-questionnaire-answers.mjs`.

- 질문지의 질문·설명·검토 요청 본문은 `QuestionRichTextEditor`를 공유한다. 줄 시작 `- `는 글머리 목록, `+ `는 플러스 기호를 유지하는 들여쓴 목록으로, 선택 영역 BubbleMenu는 노란 하이라이트로 처리한다. 제목은 일반 텍스트다. 서식은 `lib/rich-text.ts`의 버전 접두사+제한된 JSON으로 기존 본문 text 열에 저장하며 기존 일반 텍스트와 호환한다. 읽기·미리보기·이전 검토 요청은 `RichTextContent`를 사용한다. 본문을 검색/AI 등에 전달할 때는 `richTextPlainText`로 추출한다. 관련 테스트는 `scripts/verify-questionnaire-rich-text.mjs`다.

- 학생 관리(`StudentsView`)와 컨설턴트 관리(`ConsultantsView`)는 각 화면의 `components/StudentManagementTable.tsx`, `components/ConsultantManagementTable.tsx`를 독립적으로 사용한다. 도메인 목록 컴포넌트를 공유하지 않으며 기본 UI 컴포넌트만 재사용한다.

- 대시보드 화면은 `_views/{profile,students,consultants,consulting,questionnaire,exploration}/`별로 모으고 각 화면 폴더 바로 아래에 `ProfileView.tsx`, `StudentsView.tsx`, `ConsultantsView.tsx`, `ConsultingView.tsx`, `QuestionnaireView.tsx`, `ExplorationView.tsx`를 진입 컴포넌트로 둔다. 보조 컴포넌트는 `components/`, 전용 코드는 `lib/`, `hooks/`, `actions/`에 둔다. 역할 공통 `Dashboard`의 레이아웃·사이드바·역할 전환은 `_components/`, 공통 페이지 접근 설정은 `_lib/`에 둔다. 탐구활동 입력 항목 정의는 `_views/exploration/lib/fields.ts`에 둔다.

- 대시보드 역할별 접근 페이지·사이드바 노출 여부(`DASHBOARD_ROLES`)와 메뉴명·그룹(`DASHBOARD_PAGES`)은 `app/(private)/dashboard/_lib/dashboard-access.ts`에서 관리한다. `page.tsx`는 서버 전용 `_lib/render-dashboard.tsx`의 `renderDashboard`만 호출한다. 이 함수가 인증·표시 역할·조회·공통 Dashboard 조립을 담당하고 `_lib/dashboard-views.tsx`의 `renderDashboardView`가 역할 접근 검사 후 뷰 컴포넌트를 반환한다. `resolveDashboardView`를 페이지 진입/본문 렌더링에, `getDashboardNavigation`을 사이드바에 사용한다. 허용되지 않은 view는 기본 컨설팅 화면으로 처리한다. 표시 역할에 따른 UI 정책이며 서버 액션/DB는 실제 계정 권한을 별도로 검증한다.

- 관리자 공통 함수(`getViewRole`, `setAdminView`, `updateConsultantRole`)와 관련 타입은 서버 전용 `lib/admin.ts`에 모은다. 대시보드 공통 `_actions/`와 화면별 `_views/<화면>/actions/`는 클라이언트에서 호출할 수 있는 얇은 서버 액션 연결층이다.
- `consultant_lead`는 컨설턴트 기능과 컨설턴트 관리 목록 조회 권한을 가진다. 리드는 학생·관리자 프로필을 조회하거나 회원 유형을 변경할 수 없다.
- 모든 역할은 `DashboardShell`의 사이드바·사용자 정보·로그아웃·모바일 메뉴와 `DashboardNavigation`을 공유한다. view가 없는 대시보드는 모든 역할에서 컨설팅 목록을 표시한다. 모든 역할은 공통 `Dashboard`를 사용하며 학생·컨설턴트는 사이드바에 내 정보를 표시한다. 컨설턴트와 컨설턴트 리드는 운영 관리 아래 탐구활동 관리(`?view=exploration`)도 표시하며 탐구활동 목록·검색·추가·상세/수정·삭제 화면을 제공한다. `_views/exploration/ExplorationView.tsx`에서 첨부 양식의 14개 항목을 입력하며 DB ID는 화면에 표시하거나 생성하지 않고 향후 DB 저장 시 생성한다. 현재 목록 식별에는 내부 임시 키만 사용한다. DB 연결 없이 컴포넌트 상태로만 유지하여 새로고침·메뉴 이동 시 초기화된다. 삭제와 미저장 편집 취소는 확인 창을 제공한다. 컨설턴트 기본 화면 제목은 컨설팅 목록이며 컨설팅 관리 메뉴는 제공하지 않는다. 내 정보는 `?view=profile`에서 이름·회원 유형·학생 학년/학기를 보여주고 컨설팅 목록과 분리한다. 사이드바 MEA 로고는 기본 대시보드로 연결한다. 리드도 같은 `Dashboard`를 사용하며 사이드바에는 컨설턴트 관리·컨설팅 관리가 표시된다. 회원 화면 미리보기는 제거했다. 관리자는 대시보드·컨설팅 우측 상단 `AdminRoleTabs`에서 학생·컨설턴트·컨설턴트 리드·관리자 화면으로 전환한다. 서버에서 관리자 여부를 확인한 뒤 `mea-admin-view` 세션 쿠키에 표시 역할을 저장하며, `lib/admin.ts`는 실제 관리자가 아닌 계정의 쿠키를 무시한다. 실제 `getUserAccess().role`과 DB 권한은 바꾸지 않는다. 학생 화면으로 체험하는 관리자는 재료함 완료 결과를 학생 데이터로 저장하지 않는다.
- 관리자·컨설턴트 리드·컨설턴트의 운영 관리에는 질문지 관리(`?view=questionnaire`)가 표시된다. `QuestionnaireView`의 기본 화면은 질문지 목록과 새 질문지 제작 버튼이며, `draft=new`는 새 편집기, `draft=<버전 UUID>`는 저장된 초안을 연다. 편집 화면에서 목록으로 돌아갈 수 있고 `QuestionnaireEditor`에서 제목·섹션·질문을 편집한다. `QuestionnaireLoading`은 콘텐츠 중앙의 회색 pulse 문구를 사용한다. 미확인 검토 요청은 작성자의 질문지 목록 행·탭 배지·문서 안내에서 초록색과 개수로 강조하며 확인 완료 시 초록 알림을 해제하고 회색 `이전 검토 요청`에 보존한다. 미확인 검토 카드는 초록색이며 확인 완료 버튼은 부드러운 연초록 배경을 사용한다. 검토 요청은 각 질문 아래에서 내용만 입력하고 제목은 입력하지 않는다. 게시된 질문에는 다른 리드·관리자도 제목·내용·컨설턴트 공개 여부를 가진 일반 설명을 추가할 수 있다. `questionnaire_question_details.created_by`로 설명 작성자를 자동 기록하며 제작자가 전체 저장해도 유지한다. 게시 상태에서 제작자와 해당 설명 작성자만 수정·삭제할 수 있고, 다른 관리자는 수정·삭제할 수 없다. 읽기 화면의 본인 설명에 수정·삭제 버튼을 제공하며 삭제 확인과 revision 충돌 검사를 한다. 일반 설명은 기존 details 테이블에 저장하며 검토 대상/초록 알림에서 제외한다. `QuestionAnnotationEditor`는 제목 유무에 맞춰 입력 카드를 공유한다. 설명 추가 API/RPC는 버전 revision을 올려 동시 편집 덮어쓰기를 방지하고 배포 후 추가를 차단한다. `questionnaire_review_requests.question_id`로 질문에 연결하고 질문 삭제 시 설명과 검토 요청(확인 완료 포함)을 함께 물리 삭제한다. 질문 원문 스냅샷은 저장하지 않는다. 기존 질문지 단위 요청만 화면 위에서 확인할 수 있다. `QuestionDetailsEditor`의 설명 항목은 제목·본문·컨설턴트 공개 여부를 가지며 기본 비공개다. 편집/미리보기 탭은 중립색이며 공개 스위치는 파란색과 공개/비공개 문구를 사용한다. 미리보기에는 공개 항목만 표시한다. 관리자는 관리자 화면에서도 질문지 관리에 직접 접근할 수 있다.
- 질문지 저장은 대시보드 `_views/questionnaire/lib/{types,schema,server,save-session}.ts`, 같은 화면 폴더의 `lib/api-client.ts`, `hooks/useQuestionnaireSave.ts`에 둔다. `hooks/useQuestionnaireRealtime.ts`는 Supabase private Broadcast 알림을 250ms 단위로 모아 SWR을 갱신한다. DB 트리거는 staff/배포/본인 확인 기록 채널로 내용 없는 알림만 전송하며 학생은 구독하지 않는다. 숨김·오프라인 탭은 복귀 후 갱신하고 60초 조회는 알림 누락 대비용이다. 질문지 CRUD/게시/배포/검토/확인 기록은 `app/api/questionnaires/[[...path]]/route.ts` REST API를 통하며 기존 질문지 서버 액션 파일은 제거했다. 화면은 useSWR로 60초 갱신·포커스/재연결 재검증을 하고 변경 성공 시 mutate한다. 계정·표시 역할별 SWRConfig 캐시를 분리한다. 깨끗한 편집기는 원격 revision을 반영하되 미저장 입력/저장 중 요청은 덮어쓰지 않고 충돌·삭제·배포 시 작성 내용을 보존하며 저장을 차단한다. 새 문서 준비 API는 편집 세션별 키로 한 번만 조회한다. API 검증은 `scripts/verify-questionnaire-api.mjs`에 둔다. 변경 시 10초 간격 자동 저장과 수동 저장, 저장한 질문지 열기/새 질문지를 제공한다. 목록의 삭제는 확인 창을 거쳐 `delete_questionnaire` RPC를 호출하며 실제 관리자 또는 작성자인 리드 권한과 revision을 검증한다. 배포 이력이 없으면 작업 중/게시 상태 모두 질문지·모든 버전·섹션·질문·설명·검토 요청·확인 기록·응답·답변을 물리 삭제하고, 배포 이력이 있으면 보관 처리하여 내용과 답변을 보존한다. 늦게 도착한 최초 저장 요청의 재생성을 막기 위해 private에는 삭제된 버전 UUID·삭제 시각만 남긴다. 확인 창은 배포 이력에 따라 영구 삭제/보존을 구분한다. UUID 유지·revision 충돌 검사·동일 요청 재시도로 덮어쓰기와 중복 생성을 방지한다. 첫 저장 후에는 `history.replaceState(null, ...)`로 URL만 갱신하며 `router.refresh()`나 Next 내부 history state 전달로 편집기를 재생성하지 않는다. DB는 질문지/버전/섹션/질문/설명/응답/답변을 분리하며 질문지 목록은 작업 중인 질문지/게시된 질문지/배포된 질문지 탭으로 구분한다. 컨설턴트는 배포된 질문지만 조회한다. 작업 중 목록은 작성자 질문지만 제공한다. 최초 작성자이며 실제 리드/관리자인 계정만 저장·게시·배포할 수 있다. 삭제는 작성자 또는 실제 관리자에게 허용한다. 목록의 `canDelete`는 표시 역할도 반영하고 `hasDistributed`로 삭제 설명을 구분한다. `publish_questionnaire`는 draft→published, `distribute_questionnaire`는 published→distributed로 전환하며 revision·제목·질문을 검증한다. 게시 중에는 작성자가 기존 편집기로 자동/수동 저장하고 타 리드/관리자는 전체 설명을 포함한 읽기 화면을 본다. 타 리드/관리자는 `QuestionnaireReviews`에서 설명과 함께 검토 요청을 등록하고 작성자만 확인 처리한다. `questionnaire_review_requests.resolved_at`으로 완료된 요청을 각 질문의 회색 `이전 검토 요청` 접기/펼치기에 표시하며 동일 UUID 재시도로 재생성하지 않는다. 컨설턴트는 배포 후에도 검토 요청을 남길 수 없다. 배포 후 같은 질문 ID를 유지하며 DB 트리거로 내용 수정을 금지한다. 컨설턴트는 공개 설명만 조회하고 리드/관리자는 비공개 설명까지 본다. 관리자 컨설턴트 표시 모드에서도 서버에서 비공개 설명을 제거한다. 보관 삭제는 배포 이력이 있는 경우에만 적용한다. `supabase/tests/questionnaire_published_deletion.sql`에서 DB 소유자 권한으로 관련 행의 실제 삭제를 검증한다. 검증은 `supabase/tests/questionnaire_workflow.sql`과 게시/저장/삭제 SQL 및 `scripts/verify-questionnaire-storage.mjs`에 둔다. 답변 쓰기 UI/RPC를 제공하며 별도 사용자 배정 UI는 아직 제공하지 않는다. 실제 관리자/리드만 초안을 저장하며 표시 역할 쿠키는 권한 근거가 아니다. 자세한 구조와 검증 범위는 `docs/questionnaire-storage-design.md`, 테스트는 `scripts/verify-questionnaire-storage.mjs`와 `supabase/tests/questionnaire_storage.sql`을 참고한다.
- 가입 화면에서는 학생·컨설턴트만 선택한다. 관리자는 대시보드의 컨설턴트 관리 화면에서 컨설턴트와 컨설턴트 리드 사이를 변경할 수 있다.
- 역할 변경은 `public.update_consultant_role` RPC가 관리자 여부, 대상의 현재 역할, 새 역할을 검증한다. 일반 사용자는 `profiles.role` 열을 직접 수정할 수 없다.
- 역할 선택 UI는 변경할 때만 저장·취소 버튼을 표시하고 저장 중에는 중복 입력을 막는다. 서버에서 갱신된 직책을 선택값에 반영한다. 저장 중·성공·실패는 `components/ui/toast.tsx`의 shadcn Base UI Toast 하나를 갱신해 안내하며, 공통 Toaster는 루트 레이아웃에 둔다.
- 역할 권한 검증은 `supabase/tests/consultant_lead_roles.sql`, 서버 함수 검증은 `node --test scripts/verify-consultant-role-action.mjs`에 둔다.

## 컨설팅 공통 아키텍처 — 빠른 참조

컨설팅 작업은 아래 지도로 필요한 파일부터 읽는다. 전체 폴더 탐색보다 관련 구현을 우선 확인한다. 개별 컨설팅의 문구·단계·분석 내용은 공통 코어에 넣지 않는다.

## 공통 실행 규칙

실제 브라우저 테스트는 별도 요청이 없으면 진행하지 않는다.

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

| 변경 대상                | 먼저 읽을 위치                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 공통 실행·상태·전환      | `features/consulting/core/agent/agent.ts`, `core/plan/types.ts` (후자는 `features/consulting/` 기준)                                                                 |
| UI와 엔진 연결           | `app/(private)/consulting/_hooks/useConsultingAgent.ts` — Agent·Runtime·Logger 생성, 요청 실행, 상태 구독. 화면 요청 처리는 검증/응답이며 실제 화면 표시는 UI가 담당 |
| 공통 화면·버튼·작업 상태 | `app/(private)/consulting/_components/` — `ConsultingFlow`, `ConsultingScreenView`, `ConsultingFrame`, `ConsultingToolStatus` 등                                     |
| 개별 컨설팅 추가·수정    | `app/(private)/consulting/<컨설팅>/` — `_lib/plan.ts`, `_lib/renderer.ts`, `_lib/tools.ts`, `_lib/types.ts`, `_screens/`, `_tools/`. 현재 참고 구현은 `material-box` |
| 시나리오별 화면 검토     | `features/consulting/core/review/types.ts`, 공통 `ConsultingReview.tsx`, 개별 `_lib/review.ts`                                                                       |
| 실행 로그                | `features/consulting/core/logger/`, 공통 `ConsultingDebugConsole.tsx`                                                                                                |
| 결과 저장·보고서         | `features/consulting/completion.ts`, `features/consulting/report/`, 개별 `_lib/completion.ts`·`_report/`. 저장·보고서 내용은 코어 밖에서 연결                        |

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

- 새 게시 표시는 `questionnaire_publication_reads`의 사용자·버전별 확인 기록으로 관리한다. 본인 게시·초안·배포본·보관본은 제외하고 미확인 게시본만 사이드바/게시 탭에 NEW 개수, 목록 항목에 NEW와 연한 파란 배경을 표시한다. `PublicationNotifications`가 상태를 공유하며 상세 화면의 `PublicationReadMarker`가 마운트된 뒤 REST API로 확인 처리한다. 프리패치·목록 방문은 확인 처리하지 않고 편집기를 새로고침하지 않는다. 수정/자동 저장은 확인 여부를 초기화하지 않는다. 기존 미확인 게시본도 새 게시로 표시하며 SWR로 열린 화면에서 60초마다 최신 목록을 조회한다. 컨설턴트 표시 역할에서는 게시 대신 새 배포 알림을 조회하고 응답 행 생성으로 확인 처리한다. 검증은 `supabase/tests/questionnaire_publication_reads.sql`.

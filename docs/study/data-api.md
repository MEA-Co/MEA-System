# 학습법 데이터·API·권한 계약

현재 코드 기준: 2026-10-13. 학습법 변경 전 이 문서를 먼저 읽는다.
입력·화면 규칙은 [학습법 관리](ui.md), DB 배포는 [운영 절차](operations.md)를 함께 따른다.
과거 UI 작업 기록은 현재 계약을 대체하지 않는다.

## 책임과 저장 위치

| 대상 | 저장 위치 | 수명·공유 |
| --- | --- | --- |
| 확정 학습법 | PostgreSQL public.study | 계정에 저장, 역할에 따라 공유 |
| 명시적 임시저장 본문 | localStorage | 브라우저·Supabase 환경·사용자별 분리 |
| 임시 첨부 원문 | IndexedDB mea-study-files | 브라우저 보관, 확정 전 업로드 |
| 새 학습법 작성 복원 | sessionStorage | 현재 탭·환경·사용자별 분리 |
| 추가 Drawer 열림 | URL studyEditor=new | 새로고침 시 sessionStorage 복원 |
| 확정 첨부 | 비공개 Storage study-reports | DB reports에 연결된 객체를 권한에 따라 조회 |

임시저장과 sessionStorage는 서로 다르다. 자동 복원이 명시적 임시저장 목록을 덮어쓰지 않는다.
새 추가 화면의 닫기·변경 버리기·확정 시 복원 상태와 쿼리를 정리한다.
기존 임시저장은 별도로 유지하며 명시적 삭제·확정에서 정리한다.
브라우저 저장 차단/용량 초과는 오류로 안내한다. 탭 종료 후 보존은 임시저장을 사용한다.
현재 입력 UI에서는 첨부 추가를 제공하지 않지만 과거 첨부·진단·참고자료 데이터는 보존한다.

## DB 모델

public.study는 확정본만 저장한다. 별도 초안 테이블이나 status 열은 없다.

| 열 | 타입 | 계약 |
| --- | --- | --- |
| id | uuid, PK | 클라이언트 생성 ID. 임시저장 clientKey와 동일 |
| owner_id | uuid, FK profiles.id | 최초 저장 시 auth.uid(), 다른 사용자로 변경 불가 |
| values | jsonb | 아래 입력 본문 |
| reports | jsonb 배열 | 파일 메타데이터·Storage 경로. 기본 [] |
| revision | integer > 0 | 신규 1, 변경·삭제 시 증가 |
| save_id | uuid | 동일 저장 요청의 재시도 식별자 |
| created_at / updated_at | timestamptz | 생성·마지막 수정 시각 |
| deleted_at | timestamptz nullable | 삭제 표식. 삭제 시 values={}·reports=[]로 정리 |

인덱스: study_owner_updated_idx(owner_id, updated_at DESC, id),
study_updated_idx(updated_at DESC, id) WHERE deleted_at IS NULL.
클라이언트의 status='draft'|'confirmed', clientKey, localVersion은 DB 열이 아니다.
owner 삭제 시 FK CASCADE로 학습법 행도 삭제된다. Storage 객체는 FK의 삭제 대상이 아니다.

### values

| 필드 | 의미 / 제한 |
| --- | --- |
| title | 선택 이름, 최대 100자. 빈 값은 기존 표시명 생성 규칙 사용 |
| category | 내신 / 모의고사(수능) / 기타 |
| subject | 국어 / 영어 / 수학 / 사회 / 과학 / 기타 |
| customSubject | 선택 세부 과목명 |
| problemSource | self / template. 구형 student는 self로 읽고 저장 |
| problem | 필수 문제 상황 |
| problemExperience | 선택 경험 |
| strategy | 필수 대응 솔루션 |
| practiceGuide | 필수 실천 가이드 |
| periodEnabled | boolean, 기본 true |
| practicePeriod | 기간 문자열. periodEnabled=true일 때 필수 |
| checklist | 필수 문자열. 줄바꿈이 체크 항목 경계 |
| followup | 필수 후속 대응 |
| resultDiagnosis | 구형 진단 문자열, 보존 |
| references | 구형 참고자료 배열, 최대 100개, 보존 |

일반 문자열은 최대 50,000자. references 원소는 clientKey UUID와 title/selection/usage 문자열.
확정 시 필수 항목의 공백-only 값을 거절한다. 전체 values는 PostgreSQL jsonb::text 표현의 UTF-8 크기로
**2,500,000바이트 이하**다. API와 클라이언트는 payload-size.ts로 JSON의 구분 공백·한글·이스케이프까지 계산한다.
초과 시 서버 요청 전에 안내하고 API에서도 400으로 차단한다. DB의 기존 제한은 유지한다.
임시저장은 불완전한 입력을 허용한다. 확정 제한을 이유로 임시저장 내용을 삭제하지 않는다.
공통 문제 상황 템플릿 56개는 코드 상수이며 사용자 저장 본문을 자동 치환하지 않는다.

### reports

최대 10개. 각 원소는 clientKey, name, size, type, lastModified, path.
파일당 20MiB 이하, pdf/hwp/hwpx/doc/docx/ppt/pptx.
경로는 owner UUID / study UUID / report UUID.확장자.
저장 RPC는 소유 경로·객체 존재·크기·중복 경로를 확인한다.
이미 업로드한 동일 경로는 재시도에 재사용하고, 확정본이 참조하는 파일의 직접 삭제는 Storage 정책이 차단한다.

## API

모든 응답은 private, no-store. 로그인·온보딩·실제 프로필 역할을 먼저 확인한다.
GET 이외에는 전달된 Origin이 현재 origin과 다르면 거절한다.
study 데이터 접근은 인증된 Supabase 클라이언트로 수행하며 service role로 우회하지 않는다.

| 요청 | 입력 | 결과 / 용도 |
| --- | --- | --- |
| GET /api/study 또는 ?mode=table | scope, page, q, owner | DB에서 검색·페이지 조회. 기본 scope=own |
| POST /api/study?mode=table | 위 쿼리 + JSON {ids, count} | 로컬 초안과 합칠 확정본 페이지 조회. 읽기 전용 |
| GET /api/study?mode=summary | 관리자 표시 역할 반영 | {mine, others, people:[{id,label,count}]} |
| GET /api/study?mode=context | 없음 | {userId, activities:[]}. 등록 화면의 계정 확인만 수행 |
| GET /api/study?reference=UUID | 선택적으로 scope=own | 단건 참조. activities는 0~1개 |
| PUT /api/study/:id | {id,expectedRevision,saveId,values,reports} | save_study RPC, {activity} |
| DELETE /api/study/:id | {expectedRevision} | delete_study RPC, {ok,cleanupPending} |
| GET /api/study/:id/files/:reportId | 경로 ID | 권한 검사 후 60초 다운로드 URL |

페이지 응답: {userId, activities, total, page, pageSize:10}.
page는 1~100000, q는 trim 후 최대 200자, owner는 UUID 또는 빈 값.
scope=own에서는 owner를 무시한다. scope=others는 리드·관리자만 사용한다.
reference는 기존 단건 참조 계약이며 실제 컨설턴트가 가이드에 연결된 타인 학습법을 읽는 예외 경로다.
일반 목록은 이 가이드 예외를 이용해 타인 전체를 나열하지 않는다.

400 입력 오류, 401 미로그인, 403 권한·교차 출처, 409 revision 충돌, 404 파일/경로 없음,
503 조회·저장 실패를 사용한다. 삭제 RPC 오류는 충돌 409, 나머지 403인 기존 계약을 유지한다.
전체 본문을 끝까지 반환하던 구형 GET 동작은 제거했다. 소비자는 page/total을 사용해야 한다.
본문 @ 선택기도 10개씩 검색하며, 선택한 기존 ID는 페이지와 별개로 단건 조회한다.

## 페이지·검색 계약

- DB RPC read_study_page가 삭제 제외·작성자·검색·로컬 대체 ID 제외·count·page를 한 SQL 문장의 snapshot에서 처리한다.
- 정렬은 updated_at DESC, id ASC. 삭제 등으로 요청 페이지가 범위를 벗어나면 마지막 유효 페이지로 보정한다.
- 검색은 제목·교과·문제·전략·가이드 등 list-query.ts의 studySearchKeys에 지정된 문자열 필드의 대소문자 무시 부분 일치.
  SQL에도 같은 키 배열을 유지해야 한다. %, _, *, 괄호는 와일드카드가 아닌 문자 그대로 검색한다.
- 전체 상태는 검색에 맞는 로컬 초안을 최신순으로 먼저 배치한다. 서버에는 본문 없이 대체 ID와 검색에 맞는 로컬 개수만 전달한다.
- ids는 최대 10000 UUID, count는 0~10000. DB에서도 검증한다. 이 값은 화면 구성용이며 권한의 근거가 아니다.
  others scope는 두 값을 무시한다.
- DB가 로컬 행의 자리를 빼고 필요한 서버 행만 반환하므로 합계 최대 10개다.
- 확정 필터는 확정본 자체를 표시·열기·삭제한다. 임시저장 필터는 로컬 초안만 사용한다.
  전체 상태의 같은 ID는 로컬 초안 한 행으로 표시하며 revision>0이면 ‘수정 중 · 임시저장’이다.
- TableRows는 전달받은 행 자체만 열고 삭제하며 숨은 로컬 치환을 하지 않는다.
- read_study_summary는 DB GROUP BY로 작성자별 집계만 반환한다. API 서버의 500행 전체 순회를 제거했다.

정확한 개수 집계·부분 일치 검색은 여전히 DB에서 대상 데이터를 검사하며 O(1) 조회를 보장하지 않는다.
현재 화면은 번호 페이지가 필요해 OFFSET을 유지한다. 실제 데이터 증가 후 EXPLAIN으로 검색 인덱스·커서 방식 전환을 판단한다.
목록 본문은 최대 10개지만 author summary는 작성자 수만큼 반환한다.

## 권한

| 주체 | 본인 | 타인 확정본 | 수정·삭제 |
| --- | --- | --- | --- |
| 비로그인·학생 | 불가 | 불가 | 불가 |
| 컨설턴트 | 가능 | 열람 가능한 가이드가 참조한 단건만 | 본인만 |
| 리드·관리자 | 가능 | 가능 | 본인만 |
| 관리자 역할 미리보기 | 실제 관리자 권한 유지 | API 목록은 표시 역할에 맞춰 축소 | 본인만 |

DB RLS: study_owner_read / study_staff_read / study_guide_reference_read.
authenticated는 테이블 SELECT만 허용한다. 쓰기는 save_study/delete_study에서 auth.uid와 실제 소유자를 재검사한다.
read_study_page/read_study_summary는 SECURITY INVOKER + 빈 search_path로 기존 RLS를 유지한다.
PUBLIC/anon 실행은 차단한다. RPC에 own_only=false를 보내도 실제 일반 컨설턴트에게 타인 목록 권한을 부여하지 않는다.
관리자 화면 전환은 권한 강등이나 별도 사용자 로그인 기능이 아니다.

첨부는 본인 객체 또는 열람 가능한 활성 확정본에서 참조하는 객체만 읽을 수 있다.
학생/비로그인에게 버킷을 공개하지 않는다. 삭제 시 행을 먼저 삭제 표식 처리하고 파일 정리는 후속 수행한다.

## 저장·충돌

신규 expectedRevision=0, 기존은 읽은 revision을 전송한다.
DB는 ID 기준 advisory lock과 행 잠금 아래 작성자·삭제·revision·save_id를 확인한다.
같은 save_id와 같은 본문 재시도는 기존 결과를 반환하고 다른 본문 재사용은 충돌 처리한다.
불확실한 실패 시 같은 저장 시도 ID를 유지한다. 삭제된 ID의 늦은 저장은 재생성하지 않는다.
임시저장은 localVersion과 Web Locks로 다른 탭의 최신 저장을 덮어쓰지 않는다.

## 코드 책임

| 위치 | 책임 |
| --- | --- |
| StudyView.tsx | Drawer·등록/관리 맥락·대화상자 조합 |
| components/StudyTable.tsx | 관리 필터·페이지·표 표시 |
| components/patterns/collection-pagination.tsx (루트) | 학습법·탐구활동 공통 페이지 이동 표시 |
| components/StudySelectList.tsx | 참조 선택용 검색·페이지 목록 |
| hooks/useStudyStorage.ts | 작성·로컬 초안·복원·확정/삭제 동작. 전체 목록 조회 없음 |
| hooks/useStudyList.ts | 페이지·단건·계정 context 조회와 캐시 |
| 루트 lib/study/fields.ts / storage-model.ts | Study 타입·필드 정의·저장 검증·StudyRow 변환 |
| 루트 lib/study/payload-size.ts / list-query.ts | 전체 본문 크기·검색·페이지 공통 계약 |
| 루트 lib/study/problem-templates.ts | 교과별 56개 공통 문제 상황 |
| 루트 lib/content/attachments.ts | ContentReference·ReportAttachment 공용 값 타입 |
| 화면 폴더 lib/local-drafts.ts | 브라우저 저장·첨부 복원 |
| 화면 폴더 lib/api-client.ts | 클라이언트 HTTP·Storage 업로드 |
| app/api/study/[[...path]]/route.ts | 인증·경로/메서드·상태 코드 |
| app/api/study/list-page.ts | 조회 검증·RPC 호출·작성자 표시명 |
| supabase/migrations / tests | DB 계약과 권한 회귀 |

순수 모델과 검증은 루트 `lib/study/`에 두며 서버·화면이 함께 참조한다. 이 폴더는 React·Next·브라우저 저장소·화면 폴더에 의존하지 않는다.
화면 조합·훅·브라우저 저장·HTTP/첨부 업로드는 기존 `app/(private)/dashboard/_views/study/`에 둔다.
학습법 타입은 `Study`·`StudyRow`, 저장 함수는 `confirmStudy`·`deleteStudy`, 상세 컴포넌트는 `StudyDetails`로 통일한다.
탐구활동과 공유하는 `ContentReference`·`ReportAttachment`는 `lib/content/attachments.ts`에 두며 학습법이 탐구활동 코드를 import하지 않는다.
탐구활동도 ContentReference/ReportAttachment 공용 타입 이름을 그대로 사용한다.
API/DB 응답 키 `activity`·`activities`는 이전 클라이언트와의 호환을 위해 유지한다. 내부 학습법 타입명이 아니며 새 내부 코드에는 Study 명칭을 사용한다.
DB 테이블/JSON 필드·localStorage/sessionStorage/IndexedDB 키와 저장 데이터 모양은 변경하지 않았다. 이 구조 정리에는 새 migration이 필요 없다.
공통 CRUD 프레임워크는 각 데이터의 권한·참조 정책이 달라 도입하지 않는다.

## 변경 시 검증

- 타입·변경 파일 린트·Webpack 빌드.
- scripts/verify-study-pagination.mjs: API 검증, --local로 실제 인증 RPC 조회.
- MEA_TEST_BLOCK=study scripts/verify-exploration-storage.mjs: 저장/API/크기/첨부/로컬 충돌.
- scripts/verify-study-list.mjs / verify-study-editor-recovery.mjs: 표시 대상·복원.
- supabase/tests/study_queries.sql: 페이지 경계·검색·제외·집계·실제 역할·함수 ACL. 전체 롤백.
- 기존 study_storage.sql / study_guide_reference.sql / study_solution_fields.sql 유지.
- 실제 브라우저 테스트는 사용자 요청이 있을 때만 수행한다.

DB migration: 20261013085231_study_query_contract.sql. 조회 함수 2개 추가만 포함하며 기존 행과 쓰기 RPC는 변경하지 않는다.
로컬 적용·검증과 운영 적용을 구분한다. 이번 운영 적용은 아직 하지 않았다.

공식 참고: [Supabase DB 함수와 실행 권한](https://supabase.com/docs/guides/database/functions).

최종 검증(2026-10-13): 타입 검사·변경 파일 린트·Webpack 빌드 통과.
관련 JS 53개, 로컬 인증 계정의 실제 RPC 조회 통과.
study_queries/study_storage/study_guide_reference/study_solution_fields SQL 4개 통과·가상 데이터 전체 롤백.
로컬 security advisor 경고 없음, 로컬 dry-run 적용 대기 없음.
운영 DB 적용·앱 배포·실제 브라우저 테스트는 수행하지 않았다.

코드 구조 정리 검증(2026-10-13): 타입 검사·변경 파일 린트·Webpack 빌드, 학습법 JS 53개와 탐구활동 저장 JS 13개 통과. 이번 변경은 타입/경로/내부 명칭 정리이며 DB 변경·운영 적용·브라우저 테스트는 수행하지 않았다.

## 질문 참조 계약

독립 `kind: study` 대신 서술형 `text`의 `studyReference` mark로 학습법 UUID를 저장한다. 기존 첨부형 질문·작성/가이드/제출 답변도 같은 형식으로 변환한다. 학습법 원본·파일·API·RLS는 유지하며 가이드 예외는 표시 가능한 본문 참조 범위로 제한한다. 이전 절차와 검증은 [질문 운영 문서](../questions/operations.md#독립-첨부형-제거와-본문-참조-전환-2026-10-14)를 따른다.

### 질문지 시작 안내 연계 (2026-10-15)

2주차의 학습법 등록 진입점은 질문이 아닌 questionnaires.start_notice 설정으로 이전했다. 안내 버튼은 기존 본인 학습법 등록 API·권한을 그대로 사용한다. 등록 완료/개수와 질문지 제출의 강제 연결은 없으며 study 테이블·저장 계약 변경은 없다. 자세한 이전/중단 조건은 질문 저장 구조 및 운영 문서를 따른다.


### 질문지 상태 명칭 연결 (2026-10-15)

질문지 검토 단계는 `in_review`, 컨설턴트 배포는 `published`다. 가이드 답변에서 언급한 자료의 열람 권한은 지정 가이드의 in_review 세션을 기준으로 계산하며 개인 published 응답을 가이드로 공개하지 않는다. 기존 자료 ID·본문 참조·파일/소유자 권한은 유지한다. 연결된 질문지의 상태 명칭과 함수 이전은 [질문 저장 계약](../questions/data-api.md#검토배포-상태-저장-계약-2026-10-15), 적용 순서는 [질문 운영 안내](../questions/operations.md#검토배포-명칭-전환-2026-10-15)를 따른다.

## 업무 충돌 오류 전달 (2026-10-16)

revision/save_id 등 업무 충돌은 DB에서 SQLSTATE `PGRST`로 발생시키고, PostgREST에 HTTP 409와 기존 JSON `code: "40001"`을 명시한다. 실제 PostgreSQL SQLSTATE `40001`은 직렬화 실패용이므로 업무 충돌에 사용하지 않는다. PostgREST 14.5에서는 이를 내부 재시도로 처리하여 같은 실패가 무한 반복될 수 있다. 기존 앱의 `error.code === "40001"` 분기는 그대로 유지한다. 충돌 검사·잠금·권한·저장 데이터 계약은 바뀌지 않는다.

공통 migration은 `20261016012233_prevent_business_conflict_retries.sql`이며 검토한 private 함수의 리터럴 RAISE만 변경한다. 예상하지 못한 함수/구문은 전체 롤백하며 함수 소유자·권한·실행 설정도 전후 비교한다. 적용 상태와 후속 배포는 [질문 운영 문서](../questions/operations.md#업무-충돌-무한-재시도-긴급-수정-2026-10-16)를 따른다.


## 공통 시간대 기준

**DB 저장은 UTC, 사용자 화면 표시는 한국 시간(`Asia/Seoul`)**으로 통일한다. 로컬과 프로덕션 모두 같은 규칙을 따른다. 시점은 `timestamptz`에 저장하고 API·브라우저 저장에는 시간대가 명시된 문자열을 사용한다. 표시를 위해 저장값에 9시간을 더하거나 원본 시각·충돌 토큰을 변경하지 않는다.

날짜·시각 표시는 공통 `lib/date-time.ts`를 우선 사용하고 별도 표시 형식에도 `timeZone: 'Asia/Seoul'`을 명시한다. `ko-KR`만 지정하거나 UTC 문자열의 날짜 부분만 잘라 표시하지 않는다. 날짜·시간 입력은 한국 시간으로 해석하여 UTC로 변환하며 날짜 전용 값은 제외한다. 한국 자정 전후와 해외 기기 시간대에서도 검증한다. 전체 작업 규칙은 [AGENTS.md 공통 시각 저장·표시 규칙](../../AGENTS.md#공통-시각-저장표시-규칙)을 따른다. 이 절은 필수 구현 기준이며 개별 화면의 적용·검증 상태는 해당 운영 문서와 구분한다.

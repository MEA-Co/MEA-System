# 탐구활동 데이터·API·권한 계약

현재 코드 기준: 2026-10-14. 변경 전 [문서 목록](README.md)을 먼저 확인한다.

API 이름은 탐구활동 저장 `/api/exploration`, 기존 AI 탐구 코치 `/api/exploration-coach`로 구분한다. 기존 코치는 독립 DB 테이블을 사용하지 않는다. 확정 데이터 테이블은 `public.exploration`, 저장 RPC는 `save_exploration` / `delete_exploration`, 조회 RPC는 `read_exploration_page` / `read_exploration_summary`다. `20260928101208_rename_exploration_activity_storage.sql`이 최초 저장 migration 뒤에 테이블·제약·인덱스·RPC를 이름 변경한다. 기존 행, RLS, 파일 경로, 브라우저 임시저장 키는 유지한다.

## 저장 위치와 DB 모델

| 대상 | 저장 위치 | 계약 |
| --- | --- | --- |
| 확정본 | public.exploration | 역할별 공유, 수정·삭제는 작성자만 |
| 새 활동 새로고침 복원 | sessionStorage + 별도 IndexedDB | 같은 탭·계정·환경의 신규 작성만, 명시적 저장 아님 |
| 명시적 임시저장 | localStorage | 계정·Supabase URL별 분리, 자동 저장 아님 |
| 임시 첨부 원문 | IndexedDB mea-exploration-files / files | 서버 업로드 전 브라우저 보관 |
| 확정 첨부 | 비공개 exploration-reports | 본인 또는 활성 확정본의 열람 권한으로 다운로드 |

관리 화면의 신규 작성은 `explorationEditor=new`와 탭별 sessionStorage로 새로고침 복원을 지원한다. sessionStorage 키는 `mea:exploration-editor:v1:<Supabase URL>:<user ID>`이며 draft/baseline과 첨부 사본 키를 저장한다. 이 복원 사본은 명시적 임시저장 목록과 분리되며 기존 활동 편집/읽기 전용/질문 첨부 선택에는 적용하지 않는다.

첨부 사본은 별도 IndexedDB `mea-exploration-editor-files`의 `files` store에 계정·환경·복원 세션별로 보관한다. 본문은 동기 기록하고 파일 작업은 순차 처리해 늦은 쓰기가 닫기 이후 사본을 되살리지 않도록 한다. 파일 객체가 달라질 때만 쓰며 키 입력마다 원문을 다시 쓰지 않는다. 복원 시 명시적 임시저장의 파일 원문도 fallback으로 사용할 수 있다. 파일 복원 실패는 본문을 유지하고 재첨부를 안내한다.

닫기·변경 내용 버리기·확정 성공 시 복원 본문과 첨부 사본을 제거한다. 명시적 임시저장과 그 파일은 별도 기존 규칙을 따른다. 강제 탭 종료로 sessionStorage가 없어지거나 파일 삭제에 실패하면 IndexedDB 사본이 남을 수 있으며 자동 정리 작업은 없다. 이 사본으로 다른 탭/기기에서 복원하는 기능은 제공하지 않는다. 손상된 복원 정보는 임의로 삭제/덮어쓰지 않고 오류로 알린다.

| DB 열 | 타입 | 의미 |
| --- | --- | --- |
| id | uuid PK | 브라우저 clientKey와 같은 ID |
| owner_id | uuid FK profiles | 최초 저장 auth.uid(), 소유권 변경 불가, 사용자 삭제 시 CASCADE |
| values | jsonb | 아래 본문 |
| reports | jsonb 배열 | 첨부 메타데이터/경로, 기본 [] |
| revision | integer > 0 | 최초 1, 수정·삭제 시 증가 |
| save_id | uuid | 동일 요청 재시도 식별자 |
| created_at / updated_at | timestamptz | 생성/수정 시각 |
| deleted_at | nullable timestamptz | 삭제 표식, 삭제 시 values={}와 reports=[] |

owner_updated_idx(owner_id, updated_at DESC, id) 및 활성 행 updated_idx(updated_at DESC,id) 인덱스를 사용한다. 브라우저 status/localVersion은 DB 열이 아니다. 사용자 삭제의 CASCADE는 Storage 객체를 지우지 않는다.

### values와 reports

필수: grade(1/2/3), semester(1/2), recordType(창체/세특), recordArea, schoolContext, topic, record, competencies, motivation, story, result.
선택: followup, references. 창체의 recordArea는 자율·자치활동/동아리활동/진로활동이다.
일반 문자열은 최대 50,000자, references는 최대 100개이며 각 원소는 clientKey UUID와 title/selection/usage 문자열이다.

전체 values는 PostgreSQL jsonb::text 형식의 UTF-8 **2,500,000바이트 이하**다. `payload-size.ts`가 구분 공백·한글·이스케이프를 포함해 계산한다. confirmExploration에서 Storage 클라이언트 생성/업로드 전에 검사하고, confirmRequestSchema에서도 검사한다. 초과 API 요청은 구체적인 크기 오류와 400을 반환하며 RPC를 호출하지 않는다. 크기 초과로 현재 입력·임시저장을 삭제하지 않는다.

reports는 최대 10개이며 clientKey/name/size/type/lastModified/path를 가진다. 파일당 20MiB 이하 PDF/HWP/HWPX/DOC/DOCX/PPT/PPTX, path는 소유자 UUID/탐구 UUID/파일 UUID.확장자다. 브라우저의 file은 서버 JSON에 넣지 않는다.

## 쓰기·파일 API

로그인·온보딩·실제 프로필 역할을 검사하며 관리자 표시 역할은 조회 범위만 좁힌다. 전달된 Origin이 현재 origin과 다른 비GET 요청은 거절한다. 응답은 private,no-store이며 인증 사용자 Supabase 클라이언트를 사용한다.

| 요청 | 입력 | 응답 |
| --- | --- | --- |
| PUT /api/exploration/:id | {id,expectedRevision,saveId,values,reports} | {activity}, 최초/수정 확정 |
| DELETE /api/exploration/:id | {expectedRevision} | {ok,cleanupPending}, 파일 후속 정리 |
| GET /api/exploration/:id/files/:reportId | ID 경로 | {url}, 60초 서명 다운로드 URL |

400 입력 오류, 401 로그인 필요, 403 권한/교차 출처, 409 revision/요청 충돌, 404 파일·경로 없음, 503 처리 실패. 삭제 RPC의 비충돌 오류는 기존 계약대로 403이다. API 응답 activity/activities와 브라우저 키는 내부 명칭 변경 후에도 유지한다.

## 권한과 충돌

| 주체 | 조회 | 수정·삭제 |
| --- | --- | --- |
| 비로그인·학생 | 불가 | 불가 |
| 컨설턴트 | 본인 목록, 열람 가능한 가이드에 연결된 타인 단건 예외 | 본인만 |
| 리드·관리자 | 전체 활성 확정본 | 본인만 |
| 관리자 역할 미리보기 | API 목록/첨부 범위 축소, 실제 DB 권한은 관리자 | 본인만 |

exploration_owner_read/staff_read/guide_reference_read RLS와 authenticated SELECT 권한을 사용한다. 직접 INSERT/UPDATE/DELETE 권한은 주지 않는다. public 쓰기 RPC는 invoker이며 private 구현은 auth.uid/실제 역할/소유권을 재검사하는 definer, 빈 search_path와 제한된 execute grant를 사용한다. read RPC는 invoker다. 파일 공유는 열람 가능한 활성 확정본의 reports에 실제 포함된 객체만 허용한다. 확정 전/연결 해제 파일은 타인에게 공유하지 않는다.

ID 기준 advisory lock과 행 잠금 아래 revision/save_id/삭제 여부를 확인한다. 같은 save_id와 같은 본문은 기존 결과를 반환하고 다른 본문 재사용은 충돌이다. 삭제된 ID의 늦은 저장은 부활하지 않는다. 로컬 수정본 삭제는 확정본을 지우지 않는다.

## 브라우저 첨부 정리

저장은 파일 트랜잭션 완료 후 localStorage 본문을 게시한다. 성공 후 현재 저장된 reports가 참조하지 않는 파일을 **계정·환경·활동 prefix 범위에서만** 정리한다. 초안 삭제/확정 후에는 같은 범위의 원문 전체를 정리하므로 이전 버전에서 남은 고아 파일도 대상이다. 실패한 저장은 기존 본문을 기준으로 파일을 보존하고 실패 중 새로 기록한 불필요 파일만 정리한다. 손상된 본문을 읽지 못하면 추측하여 삭제하지 않는다.

정리는 다른 탭 저장과 같은 Web Locks 잠금 안에서 실행한다. localVersion 충돌은 정리 전에 차단한다. 파일 정리 실패는 이미 성공한 저장/확정을 실패로 바꾸지 않는다. 저장 후 정리 실패는 같은 초안의 다음 저장·삭제에서 재시도하며, 삭제 후 저장소 장애로 남은 원문을 정리하는 별도 백그라운드 작업은 없다. **Web Locks 미지원 환경에서는 경쟁 중인 다른 탭의 파일을 지우지 않도록 자동 원문 정리를 보류한다.** 이런 환경의 localVersion 검사는 기존처럼 유지하지만 교차 탭 원자성을 보장하지 않는다. 페이지 진입만으로 모든 초안을 청소하지 않는다.

## 코드 책임

| 위치 | 책임 |
| --- | --- |
| lib/exploration/fields.ts | Exploration 타입, 필드/선택지 정의 |
| lib/exploration/storage-model.ts | 검증, ExplorationRow 변환, 필수 항목/지문 비교 |
| lib/exploration/payload-size.ts | DB 형식에 맞춘 전체 본문 크기 |
| lib/exploration/list-query.ts | 검색 필드·페이지 계약 |
| 화면 ExplorationView.tsx | Drawer·대화상자·저장 흐름 조합 |
| 화면 components | 입력/상세/표/선택 UI, 공통 shadcn 조합 |
| 화면 hooks | 편집 상태·저장·조회 캐시 |
| 화면 lib/editor-session.ts | 신규 작성의 탭별 복원 본문·첨부 사본 |
| 화면 lib/local-drafts.ts | localStorage/IndexedDB·잠금·파일 정리 |
| 화면 lib/api-client.ts | confirmExploration/deleteExploration·HTTP·Storage |
| 화면 lib/list-model.ts / example-exploration.ts | 표시명·입력 예시 |
| app/api/exploration | 인증/메서드/오류, 목록 RPC 연결 |
| lib/content/attachments.ts | ContentReference/ReportAttachment 공용 타입 |

순수 모델은 React·Next·화면 폴더를 참조하지 않는다. 내부 이름은 Exploration/ExplorationRow/ExplorationDetails로 통일하며 API JSON 키와 DB/브라우저 데이터·저장 키는 유지한다. 미사용 ExplorationCompetencyInput/ExplorationTypeHelp는 제거했다. 학습법과 무리하게 CRUD 전체를 합치지 않는다.

검증 명령·적용 상태는 [운영](operations.md), 화면 계약은 [UI](ui.md), 변경 이력은 [작업 기록](../ui-ux-refinement.md)을 따른다.

## 서버 검색·페이지 API (2026-10-13)

| 요청 | 용도·응답 |
| --- | --- |
| GET /api/exploration?scope=own 또는 others&page=1&q=...&owner=UUID | 확정 목록 10개, `{userId, activities, total, page, pageSize}` |
| POST /api/exploration?mode=table&scope=... | 같은 페이지 응답. JSON `{ids: UUID[], count: number}`로 본인 로컬 수정본 제외 ID와 검색에 맞는 초안 수만 전달 |
| GET /api/exploration?mode=summary | DB GROUP BY 집계 `{mine, others, people:[{id,label,count}]}`. 전체 본문을 읽지 않음 |
| GET /api/exploration?mode=context | 작성자 식별용 `{userId, activities:[]}`. 목록 조회 없음 |
| GET /api/exploration?reference=UUID | 기존 RLS가 허용하는 단건, `activities` 배열에 0~1개. `scope=own`이면 본인으로 제한 |

GET `mode=table`도 페이지 조회다. 기존 무제한 GET 경로는 제거했으며 기본 조회는 본인 첫 페이지다. `scope` 기본 own, `page` 1~100000, 검색어 trim 후 최대 200자, owner는 UUID 또는 빈 값만 허용한다. 잘못된 조건은 400, 타인 범위 권한 부족은 403, 조회 실패는 503이다. 로컬 메타데이터는 최대 10000개 ID/10000개 count이며 타인 조회에는 전달하지 않는다. POST도 기존 출처 검사를 적용한다.

검색은 학년·학기·기재 유형·영역·맥락·주제·내용·역량·기획·수행·결과·성장과 참고자료 title/selection/usage의 대소문자 무관 **문자열 부분 일치**다. `%`, `_`, 괄호 등을 와일드카드나 쿼리 문법으로 해석하지 않는다. JSON 키·참고자료 clientKey·파일 메타데이터는 검색하지 않는다. 검색어를 SQL 문자열로 조립하지 않고 RPC 인수로 전달한다.

DB는 활성 행의 ID/updated_at과 검색 조건으로 개수를 구한 뒤 `updated_at DESC, id ASC`로 필요한 페이지 ID를 고르고, 본문·작성자명은 해당 페이지에 대해서만 반환한다. 개수와 행은 한 SQL 스냅샷에서 계산한다. 작성자명은 기존 profiles RLS를 따른다. 한 페이지에는 서버 확정본 최대 10개만 포함한다.

전체 필터는 로컬 임시저장을 앞에 배치한다. 서버는 로컬 수정본과 같은 확정 ID를 제외하고 로컬 검색 결과 수를 반영해 페이지 수·offset·빈 자리를 계산한다. 초안이 12개이면 첫 페이지에는 초안 10개, 두 번째에는 초안 2개와 확정본 최대 8개가 표시된다. 검색에 맞지 않는 수정 초안도 동일 확정 ID를 숨겨 이중 표시를 막는다. 확정 필터는 제외 ID와 로컬 개수를 사용하지 않는다. 초안 본문·파일은 서버로 전송하지 않는다.

함수는 `SECURITY INVOKER`, 빈 search_path, PUBLIC/anon 실행 차단이다. 인증·관리 가능 역할·실제 리드/관리자 여부를 함수에서도 확인하고 기존 RLS를 유지한다. 가이드 연결로 열람 가능한 타인 활동도 단건 참조 예외로만 접근하며 일반 컨설턴트의 목록/집계에 섞이지 않는다. 관리자 역할 미리보기는 API가 조회 범위를 좁힌다. 기존 쓰기 RPC·Storage·테이블 데이터는 변경하지 않는다.

정확한 개수와 번호 페이지/초안 병합을 위해 OFFSET을 사용한다. 기존 소유자/수정일 인덱스를 유지하며 부분 일치 검색과 전체 집계 비용이 상수 시간이 되는 것은 아니다. 대규모 데이터에서는 실행 계획과 검색 빈도를 확인한 뒤 검색 인덱스·커서 방식 등을 별도 검토한다.

### 호출부와 캐시

- 관리 `ExplorationTable`: summary와 페이지를 분리해 조회. `exploration-page`/`exploration-summary` 키에 사용자·표시 권한·검색/페이지·로컬 ID/개수를 포함한다.
- `ExplorationSelectList`와 질문 본문 `ExplorationCommands`: 본인 확정본의 서버 검색·10개 페이지 선택. 본문 참조 ID의 상세는 별도 단건 조회한다. 독립 첨부형 입력 컴포넌트는 제거했다.
- `ExplorationCommands`의 신규 작성 진입은 context만 조회한다. 상세 참조는 reference 단건 경로를 사용한다.
- 기존 확정본 수정 시 파일 정리에 필요한 이전 reports는 해당 본인 ID만 단건 조회한다. 로컬에 이미 저장한 수정본에서 파일을 제거했어도 이전 확정 첨부의 정리 대상을 놓치지 않으며 전체 목록 조회는 하지 않는다.
- `useExplorationList`: `exploration-list-v1` + 전체 요청 URL로 목록·참조·context를 구분한다. 확정/삭제 후 저장 훅이 페이지·집계·참조 캐시를 함께 재검증한다.


## 질문 참조 계약

독립 `kind: exploration` 대신 서술형 `text`의 `explorationReference` mark로 탐구활동 UUID를 저장한다. 기존 첨부형 질문·작성/가이드/제출 답변도 같은 형식으로 변환한다. 탐구활동 원본·파일·API·RLS는 유지하며 가이드 예외는 표시 가능한 본문 참조 범위로 제한한다. 이전 절차와 검증은 [질문 운영 문서](../questions/operations.md#독립-첨부형-제거와-본문-참조-전환-2026-10-14)를 따른다.

- 질문지 시작 안내의 등록 버튼은 ExplorationView registrationOnly로 기존 저장 경로를 재사용한다. 계정 문맥만 identityOnly로 조회하며 API·권한·저장 모델 변경은 없다.


### 질문지 상태 명칭 연결 (2026-10-15)

질문지 검토 단계는 `in_review`, 컨설턴트 배포는 `published`다. 가이드 답변에서 언급한 자료의 열람 권한은 지정 가이드의 in_review 세션을 기준으로 계산하며 개인 published 응답을 가이드로 공개하지 않는다. 기존 자료 ID·본문 참조·파일/소유자 권한은 유지한다. 연결된 질문지의 상태 명칭과 함수 이전은 [질문 저장 계약](../questions/data-api.md#검토배포-상태-저장-계약-2026-10-15), 적용 순서는 [질문 운영 안내](../questions/operations.md#검토배포-명칭-전환-2026-10-15)를 따른다.

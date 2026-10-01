<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 검증 방식

- 사용자가 명시적으로 요청하지 않으면 실제 브라우저 테스트를 진행하지 않는다. 임시 검증 페이지나 예시 데이터로 수행하는 브라우저 테스트도 포함한다. 기본 검증은 타입 검사·린트 등으로 진행한다.

## 로컬 Supabase

- 게시본 최신 구성 동기화(2026-10-01, 응답 시작 당시 구성 고정 정책보다 우선): 로컬 `20261001075311_live_published_response_layout.sql`. 가이드 지정 계정과 나머지 컨설턴트 리드 모두 최신 게시본 제목/섹션/질문 추가·제외·순서를 본다. 가이드 세션은 조회/저장 시 본인 세션만 동기화하며 기존 응답 ID·본문·행·이전 답변을 보존한다. 제외한 질문 응답은 삭제하지 않고 재배치 시 원본 질문 ID로 재연결한다. 현재 질문 구성만 조회·저장하며 definitionToken은 제목/구성도 포함해 오래된 저장을 차단한다. 작성 중 입력은 보존하며 제외된 질문의 로컬 입력은 복사용 영역에 남긴다. 상세 화면은 5초/포커스 복귀 조회를 사용한다. 실제 저장 권한은 가이드 지정 계정으로 유지하고, 일반 consultant 역할의 배포본 정책은 이번 범위가 아니다. 질문지 삭제 뒤에는 마지막 동기화 구성을 사용한다. 로컬 SQL 회귀 5개·입력 병합 3개·타입/린트·보안 advisor 통과, 운영 미적용. 운영 절차는 `docs/questions-operations.md` 최신 절 참고.

- 가이드 답변 표시 수정(2026-10-01): 로컬 `20261001060231_guide_answer_rich_rows.sql`. read_guide_answers는 요약 body 대신 활성 응답 행의 서식 원문과 표시용 label을 반환한다. 내부 음수 행 ID를 표시하지 않고 row_labels/순서 번호를 사용한다. QuestionBlockPreview는 서술형을 RichTextContent로 렌더링하여 하이라이트를 보존하며 척도/선택 추가 서술도 표시한다. 빈 행·조건상 비활성 행은 제외한다. 원본 저장 데이터 변경 없음, 운영 미적용.

- 가이드 게시 응답(2026-10-01, 기존 전체 리드 저장 허용보다 우선): `20261001055107_guide_consultant_published_answers.sql` 로컬 적용. `private.guide_consultant_id()`의 UUID b338f03e-9d7f-4367-be1e-96eb1d5473be만 게시 응답을 실제 저장/수정한다(리드·관리자 역할도 필요). 다른 리드는 저장 없는 미리보기다. 대시보드 내 응답 영역은 제거했고 게시본이 진입점이다. `PublishedResponse`가 권한을 분기하고 작성자의 상단 전환 버튼은 제거했다. 가이드 작성자는 기존 미리보기 탭에서 실제 응답하고, 다른 작성자는 저장 없는 미리보기를 사용한다. 가이드 답변은 별도 답변 종류/테이블을 만들지 않고 지정 계정의 기존 question_responses 중 질문별 최신 저장을 읽는다. 질문지 미리보기에서 설명 아래 접힘 영역으로 표시하며 구조가 바뀌어 재작성 필요한 답변은 예시에서 제외한다. 조회는 작성자/관리자 또는 활성 게시본에 포함된 질문으로 제한한다. 기존 비가이드 응답은 삭제하지 않는다. 운영 미적용.

- 게시 응답 정책 변경(2026-10-01, 이전 고정/완료 잠금 설명보다 우선): `20261001052151_published_live_editable_responses.sql` 로컬 적용. 게시 응답은 원본 질문의 최신 정의를 읽고 완료 상태여도 수정 가능하다. 개인 응답 시작 당시 제목/섹션/배치 구성을 유지하며 질문지 삭제 후에도 대시보드 내 응답→session ID로 읽기/수정한다. 질문 구조 변경은 definitionToken으로 오래된 저장을 차단하고 previous_responses에 이전 정의/행/본문을 보존한다. UI는 5초 및 포커스 복귀 조회, 구조 변경 확인 후 재작성, 미저장 입력 보존을 제공한다. 원본 질문 삭제(archive) 시 연결된 게시 응답만 삭제하고 배포 응답 보호는 유지한다. 기존 배치/참조 질문 삭제 제한은 유지한다. 배포 정책은 이번에 바꾸지 않았다. SQL 회귀 및 타입/린트 검증, 브라우저 실사용 미검증. 운영 미적용.

- 응답 전환 4단계(2026-10-01): 로컬 `20261001050017_remove_legacy_response_tables.sql`로 빈 questionnaire_answers/questionnaire_responses를 제거했다. 적용 중 잠금·0건 검사를 수행하며 데이터가 있으면 중단한다. 구형 이전/검증 함수·미이전 보호·상태/NEW fallback을 제거하고 질문지 삭제는 새 응답을 보존한다. 공개 RPC 호환과 구형 배포 정의 열은 유지한다. 운영 미적용. 현재 회귀는 question_responses, question_response_conditions, question_response_types, distributed_response_path, questionnaire_legacy_response_compatibility, legacy_response_cleanup SQL이다. 구형 테이블을 직접 조작하는 과거 SQL 테스트와 이전 snippet은 해당 시점 migration 전용이며 현재 스키마에서 실행하지 않는다.

- 응답 전환 3단계(2026-10-01): 운영 `epwlcallocdjkmgdmtlv` 읽기 전용 확인 결과 questionnaire_responses=0, questionnaire_answers=0, source_question_id 없는 배치=0, 게시본=2. 운영 최신 이력은 20260929081236이며 새 응답 테이블은 아직 없다. 별도 운영 데이터 이전/수동 비교 절차는 생략하고 다음 단계에서 빈 테이블 검사 후 구형 의존성/테이블을 정리한다. 게시본 2개·원본 질문은 유지한다. 로컬 20261001045140_migrate_legacy_question_responses.sql은 0건 처리했고 가상 세션 3개/답변 8개 회귀를 검증했다. 실제 운영 변경·테이블 삭제는 아직 하지 않았다.

- 운영 DB migration이 필요한 변경을 완료하면 최종 안내에 실행 명령어와 순서를 반드시 함께 제공한다. 프로젝트 경로 이동 → 연결된 운영 대상·이력 확인 → dry-run 및 예상 migration 파일 확인 → 실제 적용 → 적용 대기 없음 재확인 → 앱 배포 → 기능 확인 순서로 안내한다. 예상과 다른 migration이 나오면 적용 전에 이력을 검토하도록 명시하고, 로컬 검증과 운영 적용 여부를 구분한다.

- 로컬 구성·migration 복구와 운영 이력 차이는 `docs/local-supabase.md`를 먼저 확인한다. 전공 검색 migration 3개는 운영 객체가 있지만 운영 이력이 없고, 복구한 가치관 구조도 운영에 이미 있다. 이력 동등성 검토 없이 `db push`/원격 reset/`migration repair`를 실행하지 않는다. 개발 DB 초기화는 명시적으로 `db reset --local`을 사용한다. 로컬 Supabase 실행만으로 앱의 `.env` 연결이 바뀌지 않으며, 개발 환경 변수·Google OAuth·기준 데이터는 별도로 설정한다.

## 회원 역할

- 질문 중심 응답 2단계(2026-10-01): 사용자가 1단계 기능 정상 동작을 확인했다. 로컬 `20261001044352_distributed_question_response_path.sql`에서 일반 컨설턴트 기존 배포본의 조회/저장/완료/자유응답/NEW/Realtime을 새 응답 테이블로 전환했다. 기존 open/save RPC도 새 경로로 연결된다. 구형 원본 없는 질문 버전은 `legacy_question_id`를 사용한다. 이전 응답이 남아 있으면 동일 ID로 이전되기 전 빈 세션 생성을 차단하며 상태/NEW는 이전 데이터를 읽어 유지한다. 데이터 일괄 이전(3단계)과 이전 테이블 삭제(4단계)는 아직 안 했다. 사용자 방침: 전체 로컬 완료 후 운영 적용. 검증 `distributed_response_path.sql`, `questionnaire_legacy_response_compatibility.sql` 및 새 응답 SQL 3개. 운영 절차는 `docs/questions-operations.md`의 2단계 절을 따른다.

- 질문 중심 응답 1단계(2026-10-01): `question_versions`·`response_sessions`·`question_responses`로 게시본 리드/관리자의 실제 응답을 저장한다. `QuestionResponseForm`과 `/api/questionnaires/:id/question-responses`를 사용한다. 질문 버전은 원본 revision별 불변이며 응답 시작 시 고정한다. 조건 비활성 입력은 보존하고 서버가 active_row_ids/body를 계산한다. 본인 응답만 조회/저장하며 일반 컨설턴트의 게시본 접근은 차단한다. 작성자도 `내 답변 작성`으로 전환할 수 있다. 기존 배포본의 `questionnaire_responses`/`questionnaire_answers`와 RPC는 아직 유지한다. 전체 이전/삭제가 끝난 것으로 간주하지 않는다. 로컬 migration `20261001043026_question_centric_responses.sql`, 검증 `supabase/tests/question_responses.sql`, `question_response_conditions.sql`, `question_response_types.sql`. 운영 적용은 `docs/questions-operations.md`의 단계별 절차를 따른다.

- 서술형 답변 열은 `탐구활동 참조 권장` 체크박스로 `questions.fields[].explorationRecommended`를 설정한다. 기본 해제, 다른 유형 전환 시 제거하며 질문/질문지 미리보기 입력에 포커스할 때 파란 테두리와 참조 안내 말풍선을 표시한다. API/DB는 서술형 boolean만 허용한다. 로컬 migration `20261001034040_question_text_exploration_recommendation.sql`, 검증 `supabase/tests/question_exploration_recommendation.sql`·`scripts/verify-question-exploration.mjs`. 기존 데이터 변경 없음, 운영 적용 순서는 `docs/questions-operations.md`를 따른다.


- 로컬 `20260929081236_questionnaire_placement_definitions.sql`: source_question_id가 있는 배치는 body/kind/options/scale_config/choice_style/choice_allow_text를 NULL로 유지하고 원본에서 읽는다. 해당 열은 이전 배포본 답변 검증이 사용하므로 삭제하지 않는다. 저장 RPC·DB 제약이 중복 정의를 차단하며 이전 행은 보존한다. 운영 미적용. 검증 `supabase/tests/questionnaire_legacy_response_compatibility.sql`, `questionnaire_published_sources.sql`.


- 원본 설명 통일(로컬만): `20260929080341_questionnaire_source_details_only.sql`에서 빈 questionnaire_question_details·전용 RPC/UI/API를 제거했다. 설명은 원본 question_details/save_question으로 관리하며 검토 요청은 별도 유지한다. 이전 import 함수는 명시적 폐기 오류로 중단하고 대응 이력은 보존한다. 운영은 미적용이며 데이터가 있으면 새 migration은 중단한다.


- 원본 참조 저장 통일(로컬만): `20260929075817_questionnaire_source_required.sql`. 모든 제작 저장에 sourceQuestionId가 필요하며 질문지 안 새 질문은 원본 저장 후 배치한다. 현재 운영의 이전 게시본을 같은 ID/상태로 전환하기 전에는 이 단계 앱/migration을 운영 배포하지 않는다. 테이블·열 제거 및 이전 설명 구조 정리는 후속 단계다.


- DB 정리 범위(2026-09-29): 사용자는 질문·질문지 통합 후 미사용 **테이블 구조** 점검을 요청했다. 기존 게시본·전환본 데이터는 유지하며 테이블 점검을 데이터 삭제·보관 요청으로 해석하지 않는다. 오삭제했던 기존 게시본은 삭제 전 백업과 모든 열을 비교해 복원 완료했다. 자세한 기록은 `docs/questionnaire-storage-design.md`를 따른다.


- 진행 상태(2026-09-29): 질문지 게시까지 구현했으며, 게시 후 검토 요청 흐름은 사용자가 아직 점검하지 않았다. 구현 완료와 사용자 점검 완료를 구분하고 검토 요청을 검증 완료로 간주하지 않는다.


- 게시된 질문지는 작성자에게 편집기, 다른 리드·관리자에게 실제 질문지 미리보기 형태와 질문별 검토 요청을 제공한다. 게시본의 돌아가기는 질문 관리 대시보드로 연결한다. 설명 추가·수정·삭제는 질문지 작성자만 가능하며 이전 타인 설명 작성 권한을 대체한다. 게시 목록 제작자명은 게시본 범위 전용 RPC로 조회한다. migration: `20260929071720_questionnaire_published_review_permissions.sql`.


- 질문지 상태 Select의 `게시`를 활성화했다. 타 리드의 게시본은 `read_published_question_sources` RPC로 해당 질문지의 원본 질문만 읽으며 독립 질문의 작성자 전용 RLS는 유지한다. 배포·보관은 UI 비활성 유지. migration `20260929063207_questionnaire_published_sources.sql`, 검증 `supabase/tests/questionnaire_published_sources.sql`, 운영 순서 `docs/questions-operations.md`.


- 탐구활동은 관리자 사이드바에도 표시한다. 컨설턴트는 본인 확정 활동만, 리드·관리자는 전체 확정 활동을 조회한다. 타인 활동은 읽기 전용이며 수정·삭제는 작성자만 가능하다. 관리자 컨설턴트 미리보기는 API에서 본인 목록·첨부만 반환한다. 타인 파일은 활성 확정본에서 참조된 객체만 공유하며 임시저장은 본인 브라우저에만 남는다. migration `20260929050548_exploration_staff_read.sql`, 회귀 `supabase/tests/exploration_activity_storage.sql`, `scripts/verify-exploration-storage{,-local}.mjs`.


- 질문 제작의 `minRows`(기본 1)·`rowLabels`(빈 이름은 순서 숫자)는 `questions.min_rows`·`row_labels`로 저장한다. 반복형 최소는 최대 이하이며 질문/질문지 미리보기에서 최소 행을 유지한다. 참조형 행 수는 원본 응답을 따른다. migration `20260928102529_question_row_settings.sql`, SQL 회귀 `supabase/tests/question_row_settings.sql`.


- 질문지 제작은 QuestionnaireView의 페이지 편집기로 진행하며 숨긴 목록 상태를 유지한다. 질문 추가하기는 단일 Drawer에서 QuestionLibraryView의 embedded 제작 UI를 열고 저장된 질문 불러오기는 같은 Drawer 내부 선택 목록을 사용한다. 불러온 질문과 배치 카드의 질문 수정은 원본 ID로 PUT 저장하며 라이브러리 캐시를 갱신한다. 이미 배치된 질문의 완료는 중복 배치하지 않는다. Drawer와 Dialog를 중첩하지 않는다. 새 질문은 /api/questions에 독립 저장한 뒤 sourceQuestionId로 배치하며 저장 완료된 변경 없는 질문만 배치할 수 있다. 질문 추가 화면 전환 동안 질문지 제목·섹션과 새 질문 입력을 유지하고 돌아올 때 추가 버튼으로 포커스를 복원한다. 최초 변경 전 저장은 비활성화하고 바로 닫으며, 변경 후에는 닫기 확인을 제공하고 확인 중 자동 저장을 멈춘다. 제목 공백은 클라이언트·저장 API에서 차단하고 토스트로 안내한다. QuestionnaireStatusSelect의 게시·배포·보관 항목은 제작 단계 동안 비활성화한다. DB migration 없음. 검증 scripts/verify-questionnaire-drawer.mjs 및 scripts/verify-questionnaire-storage.mjs.

- 관리자 리드 미리보기의 /api/questions GET은 getViewRole로 표시 역할을 읽고 본인 created_by로 목록·검색/개수·상세·관계 후보를 제한한다. 실제 RLS/쓰기 권한은 변경하지 않는다. 관리자 기본 화면은 전체 조회한다. 이 서버 필터 변경에는 migration이 없다.

- 독립 질문은 작성자인 리드와 관리자만 조회한다. questions와 question_details RLS가 목록·검색·상세·관계 후보 조회에 적용된다. 관리자의 질문 테이블은 list_questions_page가 반환한 creator_name을 제작자 열에 표시한다. private 저장 RPC를 통한 타 작성자 질문 참조·배치도 트리거로 차단한다. migration 20260928061511_question_creator_visibility.sql, 검증 supabase/tests/question_creator_visibility.sql.

- 질문 생성·수정은 QuestionLibraryView의 Drawer로 열며 목록의 검색·페이지·스크롤을 유지한다. question URL 매개변수와 미저장 닫기 확인을 지원한다. useQuestionEditorData는 개별 상세와 설명을 제외한 /api/questions?mode=relationships를 별도로 SWR 캐싱한다. PC는 넓은 오른쪽 패널, 모바일은 전체 높이다. DB migration 없음. 검증 scripts/verify-question-drawer.mjs, scripts/verify-question-pagination-api.mjs.

- 질문 테이블은 `/api/questions?page=&search=`와 `list_questions_page` RPC로 10개씩 서버 검색·페이지 조회한다. 이름·서식 제거한 본문을 부분 일치로 검색하고 입력은 300ms 디바운스한다. 조건 설명은 해당 페이지의 직접 참조 질문을 함께 받아 표시한다. 그래프·질문지 배치만 기존 전체 조회를 사용하며 서버에서 500개씩 나누어 읽는다. 로컬 migration `20260928052431_question_server_pagination.sql`, 검증 `supabase/tests/question_server_pagination.sql`, `scripts/verify-question-pagination-api.mjs`, 설명 `docs/questions-operations.md`.

- 내 질문지 목록은 `questions/components/questionnaire/QuestionnaireList.tsx`의 최근 수정순·10개 페이지 테이블이다. 상태 필터는 칩, 변경은 색상 Select이며 현재 수정 중↔게시만 활성화한다. 배포·보관 UI는 비활성이다. 기존 서버 상태 계약·보관·초안 복사 구현은 유지한다. 검증 `supabase/tests/questionnaire_status.sql`.

- 질문·질문지 통합 진입점은 `questions/QuestionsView.tsx`와 `view=questions` 하나다. 리드·관리자는 대시보드에서 질문/내 질문지/게시본으로 이동하고 컨설턴트는 기존 배포본을 본다. 이전 questionnaire 접근 키·렌더러·아이콘·URL 호환 분기는 제거했다. 미지원 view는 역할별 기본 화면으로 처리한다. 현재 구조·권한은 `docs/questions.md`, 데이터 계약은 `docs/questionnaire-storage-design.md`, 운영 적용 순서는 `docs/questions-operations.md`를 먼저 읽는다.

- 기존 서술형 질문지의 원본을 보존하고 독립 질문·배치형 새 초안을 생성하는 운영자 도구는 `private.import_legacy_text_questionnaire(uuid,integer)`다. `private.legacy_questionnaire_imports`에 대응 ID를 보존하며 앱 역할 실행은 차단한다. migration 설치만으로 실제 데이터를 이전하지 않는다. 응답 없는 활성 게시본만 지원하고 재실행 시 기존 결과를 반환한다. 절차 `docs/legacy-questionnaire-import.md`, 검사·예행연습·실행·비교는 `supabase/snippets/legacy-questionnaire-import-*.sql`, 로컬 회귀 `supabase/tests/import_legacy_text_questionnaire.sql`, migration `20260928042153_import_legacy_text_questionnaire.sql`.

- 질문지 제작은 `QuestionnaireComposer`에서 질문 관리의 저장된 질문을 검색·배치한다. `questionnaire_questions.source_question_id`로 원본 ID를 참조하고 배치 ID는 독립적으로 유지한다. 제작·게시 중에는 원본의 최신 질문·열·조건·설명을 읽으며 섹션/질문 이동, 참조 선행 순서 검증, 공유 응답 미리보기를 제공한다. 새 배치를 포함한 배포는 질문 버전 고정·열/행 응답 저장 구현 전까지 DB에서 차단한다. 기존 배포본은 유지한다. 기존 편집 파일은 삭제하지 않았고 삭제 후보 3개 및 데이터 계약은 `docs/questions.md`에 기록했다. 로컬 migration `20260928034945_questionnaire_question_placements.sql`, 검증 `scripts/verify-questionnaire-placements.mjs`, `supabase/tests/questionnaire_question_placements.sql`. 운영에는 미적용이다.

- 질문 조건 UI는 공통 Select로 질문 → 특정 열/모든 열 → 조건 순서다. `선택했을 때`는 직접 입력 없는 선택형 열에서만 메뉴에 표시하고 선택지를 같은 줄에 고른다. 특정 열의 answered는 그 열, fieldId 없는 모든 열 answered는 같은 행의 모든 열이 입력됐는지 판정한다. 참조도 일치 행만 따른다. 로컬 migration `20260923085519_question_answered_column_references.sql`.

- 질문 관리의 `특정 항목을 선택했을 때`는 직접 입력 없는 단일/다수선택형 열과 선택지 하나를 고른다. 단일은 equals, 다수는 includes로 저장하며 후보 열이 하나면 자동 선택한다. 미리보기는 참조를 끄면 일치 행 하나 이상으로 질문을 열고, 참조를 켜면 일치하는 행만 원본 ID 기준으로 반복한다. 로컬 migration `20260923084501_question_choice_reference_conditions.sql`, 검증 `supabase/tests/question_choice_conditions.sql`, `scripts/verify-question-choice-conditions.mjs`.

- 질문 관리 조건 카드의 `응답했을 때`는 질문 단위 조건(fieldId 생략)으로 저장한다. `앞선 질문의 응답 참조`를 켜면 해당 질문의 작성된 행 수에 맞추며 sourceFieldId=null을 사용한다. 기존 열 단위 참조는 호환 유지한다. 별도 행 구성·선후관계 카드는 제거했다. 미리보기는 앞선 질문 입력과 행 ID별 후속 응답 보존을 제공하고 실제 배포/응답 영속화와는 분리된다. 검증은 `supabase/tests/question_response_references.sql`, `scripts/verify-question-reference-rows.mjs`, 로컬 migration은 `20260923083334_question_response_references.sql`이다.

- 독립 질문 관리(`_views/questions/`, `/api/questions`)는 `public.questions`와 별도 `question_details`를 사용한다. 설명은 질문 카드 아래에서 제목·서식 본문·컨설턴트 공개 여부를 편집하며 질문–답변 원문에는 포함하지 않는다. 설명 편집 요소는 questions 폴더 소유이며 questionnaire를 참조하지 않는다. `save_question`이 질문과 설명을 원자적으로 저장하고 부모 revision·saveId로 충돌/재시도를 보호한다. `details` 생략은 보존, 빈 배열은 삭제다. 미리보기에는 공개 설명만 표시한다. 설명은 리드·관리자 읽기와 작성자·관리자 RPC 쓰기를 허용하고 직접 쓰기를 차단한다. 로컬 적용 migration은 `20260923073954_question_details.sql`, 회귀는 `supabase/tests/question_details.sql`이다.

- 질문 카드의 순서는 유형 선택·삭제 버튼 → 질문 입력 → 답변 UI/선택지 설정이다. 척도는 가로선 위의 점을 선택하며 편집 중에는 비활성 미리보기를 표시한다. 선택형 options의 `isOther`는 단일선택형에서 하나, 다수선택형에서 여러 개(전체 선택지 최대 20개)를 허용한다. 제작·미리보기·응답 화면에서 항상 일반 선택지 다음에 표시하며 둘 이상이면 `직접 입력 1`, `직접 입력 2`처럼 구분한다. 제작 화면에서는 `선택지 추가` 버튼을 일반 선택지 아래, `직접 입력` 항목 또는 추가 버튼 위에 둔다. 해당 답변은 각 선택지 ID별 `{id,text}`(다수 선택은 일반 ID와 객체의 배열)로 전달한다. 직접 입력 내용은 항목당 최대 5,000자이며 임시 저장은 공백을 허용하지만 완료 시 선택된 항목마다 필수다. 선택형의 `choice_allow_text`가 켜지면 `{choices:[선택값],text:"추가 서술"}`로 답변을 전달하며 추가 서술은 선택 입력이다. 기존 선택형 답변 형식도 읽고 `body`에는 `직접 입력: 내용`(여러 개면 번호 부여)과 별도의 `추가 답변: 내용`을 기록한다. 검증: `supabase/tests/questionnaire_other_choices.sql`, `scripts/verify-questionnaire-question-types.mjs`.

- 질문은 서술형(`text`, 기본), 척도형(`scale`), 단일선택형(`single`), 다수선택형(`multiple`)을 지원한다. `QuestionTypeEditor`에서 유형과 선택지 2~20개를 설정한다. 선택지는 질문 행의 `options` JSONB에 `{id,label}`로 저장하며 `kind`와 함께 배포 후 고정된다. 선택형의 `choice_style`은 `list`(기본) 또는 `chip`이며 두 방식 모두 `isOther` 직접 입력 항목을 지원한다. 초안에는 빈 선택지 이름을 허용하지만 게시·배포 시 두 개 이상의 서로 다른 이름을 요구한다. `QuestionChoiceInput`은 미리보기·배포 상세·컨설턴트 입력을 공유한다. 척도는 `scale_config`에 최고 점수 2~9(기본 5), 양끝·홀수 가운데 라벨, 선택적 서술 답변 여부를 저장한다. 기존 척도는 5점 기본값을 사용한다. 척도 답변 `selection`은 숫자 또는 `{score,text}`이며 `body`는 점수·라벨·추가 답변을 보존한다. 검증: `supabase/tests/questionnaire_scale_settings.sql`, `scripts/verify-questionnaire-question-types.mjs`. 기존 서술형과 자유 응답은 그대로 유지한다.
- 선택형 응답은 `questionnaire_answers.selection`에 선택 값(척도 숫자/단일 선택지 ID/다수 ID 배열 또는 선택형 추가 서술 객체)을, `body`에는 읽을 수 있는 답변 텍스트를 함께 저장한다. AI용 질문–답변 추출은 선택지 조회 없이 `body`를 사용할 수 있고, 서술형 RichText는 `richTextPlainText`로 변환한다. API는 selection으로 편집 상태를 복원하며 DB가 허용된 선택·중복·척도 범위를 검증한다. 같은 답변 ID·10초 자동 저장·완료 잠금은 유지한다. `20260921083603_questionnaire_question_types.sql`은 로컬 적용·검증 완료, 운영에는 미적용이다. 테스트는 `scripts/verify-questionnaire-question-types.mjs`, `supabase/tests/questionnaire_question_types.sql`이다.

- 컨설턴트 배포본 맨 아래의 `QuestionnaireFreeResponse`는 선택 입력이다. `questionnaire_responses.free_response`에 일반 질문별 답변과 구분해 저장하며 기존 답변과 같은 10초 자동 저장·수동 저장·revision 충돌·완료 잠금을 적용한다. 입력 서식은 공통 RichText를 사용한다. 저장 요청의 `freeResponse`를 생략하는 이전 클라이언트는 기존 자유 응답을 보존하고, 빈 문자열을 보내면 지운다. 테스트는 `supabase/tests/questionnaire_free_response.sql`과 `scripts/verify-questionnaire-answers.mjs`다.

- 배포 후 검토 요청은 UI와 DB RPC 모두 차단하고 기존 요청 조회·확인은 유지한다. 컨설턴트 목록은 `ConsultantQuestionnaireList`의 답변 전/답변 완료 탭으로 나눈다. `QuestionnaireAnswers` + `QuestionAnswerEditor`는 `GET/PUT /api/questionnaires/:versionId/answers`와 `GET /responses`를 사용한다. 변경 시 10초 자동 저장·수동 저장, 모든 답변을 원자적으로 저장·잠그는 완료 확인 창을 제공한다. `answer-session.ts`는 중복 요청·불확실한 재시도·revision 충돌을 관리하고 미저장 입력은 원격 갱신으로 덮어쓰지 않는다. `questionnaire_responses`는 사용자/버전당 하나이며 `questionnaire_answers.id`는 수정 후에도 유지된다. 완료(submitted) 이후 DB RPC와 트리거가 수정을 차단한다. 배포본 상세를 열면 `open_questionnaire_response`로 assigned 응답을 만들고, 응답이 없는 배포본을 NEW로 표시한다. 컨설턴트 사이드바/답변 전 탭/목록의 NEW는 게시 확인 기록과 별개다. Realtime 사용자 채널로 본인의 답변·확인 변경만 알린다. 답변 쓰기는 본인만 가능하며 관리자 체험도 관리자 본인 응답으로 저장한다. 테스트: `supabase/tests/questionnaire_answers.sql`, `scripts/verify-questionnaire-answers.mjs`.

- 질문지의 질문·설명·검토 요청 본문은 `QuestionRichTextEditor`를 공유한다. 줄 시작 `- `는 글머리 목록, `+ `는 플러스 기호를 유지하는 들여쓴 목록으로, `1. ` 등 숫자·마침표·공백은 번호 목록으로 전환하고 Enter로 번호를 이어간다. `orderedList`와 안전한 시작 번호를 저장·미리보기·재조회에서도 유지한다. 선택 영역 BubbleMenu는 노란 하이라이트로 처리한다. 제목은 일반 텍스트다. 서식은 `lib/rich-text.ts`의 버전 접두사+제한된 JSON으로 기존 본문 text 열에 저장하며 기존 일반 텍스트와 호환한다. 읽기·미리보기·이전 검토 요청은 `RichTextContent`를 사용한다. 본문을 검색/AI 등에 전달할 때는 `richTextPlainText`로 추출한다. 관련 테스트는 `scripts/verify-questionnaire-rich-text.mjs`다.

- 학생 관리(`StudentsView`)와 컨설턴트 관리(`ConsultantsView`)는 각 화면의 `components/StudentManagementTable.tsx`, `components/ConsultantManagementTable.tsx`를 독립적으로 사용한다. 도메인 목록 컴포넌트를 공유하지 않으며 기본 UI 컴포넌트만 재사용한다.

- 대시보드 화면은 `_views/{profile,students,consultants,consulting,questions,exploration}/`별로 모으고 각 화면 폴더 바로 아래에 `ProfileView.tsx`, `StudentsView.tsx`, `ConsultantsView.tsx`, `ConsultingView.tsx`, `QuestionsView.tsx`, `ExplorationView.tsx`를 진입 컴포넌트로 둔다. 보조 컴포넌트는 `components/`, 전용 코드는 `lib/`, `hooks/`, `actions/`에 둔다. 역할 공통 `Dashboard`의 레이아웃·사이드바·역할 전환은 `_components/`, 공통 페이지 접근 설정은 `_lib/`에 둔다. 탐구활동 입력 항목 정의는 `_views/exploration/lib/fields.ts`에 둔다.

- 대시보드 역할별 접근 페이지·사이드바 노출 여부(`DASHBOARD_ROLES`)와 메뉴명·그룹(`DASHBOARD_PAGES`)은 `app/(private)/dashboard/_lib/dashboard-access.ts`에서 관리한다. `page.tsx`는 서버 전용 `_lib/render-dashboard.tsx`의 `renderDashboard`만 호출한다. 이 함수가 인증·표시 역할·조회·공통 Dashboard 조립을 담당하고 `_lib/dashboard-views.tsx`의 `renderDashboardView`가 역할 접근 검사 후 뷰 컴포넌트를 반환한다. `resolveDashboardView`를 페이지 진입/본문 렌더링에, `getDashboardNavigation`을 사이드바에 사용한다. view가 없거나 허용되지 않으면 `DASHBOARD_DEFAULT_VIEWS`의 역할별 기본 화면으로 처리한다(학생: 컨설팅, 컨설턴트: 질문지 관리, 리드·관리자: 컨설턴트 관리). 표시 역할에 따른 UI 정책이며 서버 액션/DB는 실제 계정 권한을 별도로 검증한다.

- 관리자 공통 함수(`getViewRole`, `setAdminView`, `updateConsultantRole`)와 관련 타입은 서버 전용 `lib/admin.ts`에 모은다. 대시보드 공통 `_actions/`와 화면별 `_views/<화면>/actions/`는 클라이언트에서 호출할 수 있는 얇은 서버 액션 연결층이다.
- `consultant_lead`는 컨설턴트 기능과 컨설턴트 관리 목록 조회 권한을 가진다. 리드는 학생·관리자 프로필을 조회하거나 회원 유형을 변경할 수 없다.
- 모든 역할은 `DashboardShell`의 사이드바·사용자 정보·로그아웃·모바일 메뉴와 `DashboardNavigation`을 공유한다. view가 없는 대시보드는 학생에게 컨설팅 목록, 컨설턴트에게 질문지 관리, 리드·관리자에게 컨설턴트 관리를 표시한다. 모든 역할은 공통 `Dashboard`를 사용하며 학생·컨설턴트는 사이드바에 내 정보를 표시한다. 컨설턴트와 컨설턴트 리드는 데이터 관리 아래 탐구활동 관리(`?view=exploration`)도 표시하며 탐구활동 목록·검색·추가·상세/수정·삭제 화면을 제공한다. `_views/exploration/ExplorationView.tsx`의 Drawer에서 탐구활동을 제작한다. 임시저장은 입력 하나 이상이면 가능하며 계정·프로젝트별 localStorage에 본문/메타데이터, IndexedDB에 첨부 원문을 보관한다. 확정은 필수 항목 전체를 검증하여 `/api/exploration`와 `save_exploration` RPC로 본인 DB 행에 저장한다. 확정 후 수정도 허용하고 수정 임시저장은 확정본을 유지한다. UUID·revision·saveId로 충돌/재시도를 보호한다. 파일은 확정 시 비공개 `exploration-reports` 버킷에 업로드한다. DB 테이블은 `public.exploration`이며 기존 AI 코치 API는 `/api/exploration-coach`다. migration은 `20260928100109_exploration_activity_storage.sql` 다음 `20260928101208_rename_exploration_activity_storage.sql`을 적용한다. 정책·운영 설정은 `docs/exploration-activity-storage.md`, 검증은 `scripts/verify-exploration-storage.mjs`, `scripts/verify-exploration-storage-local.mjs`, `supabase/tests/exploration_activity_storage.sql`이다. 삭제와 미저장 편집 취소는 확인 창을 제공한다. 컨설턴트 기본 화면은 질문지 관리이며 컨설팅 목록의 대시보드 접근은 제거했다. 내 정보는 `?view=profile`에서 이름·회원 유형·학생 학년/학기를 보여주고 컨설팅 목록과 분리한다. 사이드바 MEA 로고는 기본 대시보드로 연결한다. 리드도 같은 `Dashboard`를 사용하며 사이드바에는 컨설턴트 관리·컨설팅 관리가 표시된다. 회원 화면 미리보기는 제거했다. 관리자는 대시보드·컨설팅 우측 상단 `AdminRoleTabs`에서 학생·컨설턴트·컨설턴트 리드·관리자 화면으로 전환한다. 서버에서 관리자 여부를 확인한 뒤 `mea-admin-view` 세션 쿠키에 표시 역할을 저장하며, `lib/admin.ts`는 실제 관리자가 아닌 계정의 쿠키를 무시한다. 실제 `getUserAccess().role`과 DB 권한은 바꾸지 않는다. 학생 화면으로 체험하는 관리자는 재료함 완료 결과를 학생 데이터로 저장하지 않는다.
- 질문지 제작은 `questions/components/questionnaire/QuestionnaireComposer.tsx`의 페이지 편집기와 질문 추가 Drawer를 사용한다. 다른 제작자의 게시본은 실제 질문지 형태로 읽고 검토 요청만 추가한다. 설명 권한과 현재 UI는 `docs/questions.md`를 따른다. 기존 배포본·답변 호환 코드는 유지하며 배치형 배포와 열/행 응답 저장은 미구현이다.
- 질문지 저장·HTTP·SWR·Realtime·응답 호환 계약은 `docs/questionnaire-storage-design.md`와 `questions/lib/questionnaire/`, `questions/hooks/questionnaire/`를 참고한다. 10초 자동 저장·동일 요청 재시도·revision 충돌 보호·완료 잠금·실제 계정 권한 검증을 유지한다. API `/api/questionnaires` 및 DB 이력은 통합 전 잔재가 아니며 삭제하지 않는다.
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

- 탐구활동 목록은 내 활동/다른 사람의 활동을 분리한다. 컨설턴트는 내 활동만 표시하며 리드·관리자는 다른 사람의 활동에서 전체 보기/작성자 선택 사람별 보기를 사용한다. API는 기존 profiles RLS를 따르는 작성자 이름만 함께 조회하고, 이름을 볼 수 없으면 비공개 표시한다. 추가 DB migration 없음.


- 리치 텍스트 탐구활동 명령어(2026-10-01): 모든 QuestionRichTextEditor에서 권장 설정과 무관하게 `@` 메뉴 → 입력 위 본인 탐구활동 목록/검색/새 활동 작성 Drawer를 제공한다. 확정 활동은 `explorationReference` mark(UUID)+활동명 text로 기존 답변에 저장한다. 읽기 화면은 기존 권한으로 상세 조회하며 DB migration 없음. 질문지 RichText/editor/renderer는 질문 공통 구현을 재수출한다. 회귀 `scripts/verify-questionnaire-rich-text.mjs`, `verify-questionnaire-storage.mjs` 22개와 예시 UI 검증 완료. 실제 계정 저장/재조회는 미검증. 새 배치형 배포는 미구현 유지.

- 탐구활동 첨부 UI(2026-10-01): 목록은 입력 위 Portal 팝업으로 배치해 레이아웃을 밀지 않는다. 주제/학년/학기/기재 영역만 있는 카드 전체를 클릭해 첨부하고 hover/focus 시 첨부하기를 표시한다. 새 활동 추가는 목록 마지막 항목이다. 명령어는 아이콘과 설명을 표시하고 목록·권장 말풍선은 X로 닫는다. 이번 UI 수정은 브라우저 테스트 없이 검증한다.

- 탐구활동 목록 캐시 수정(2026-10-01): QuestionExplorationInput과 @ 메뉴가 같은 URL 키에 각각 배열/객체를 저장하던 SWR 충돌을 제거했다. `useExplorationList`가 `{userId, activities}` 계약과 `exploration-list-v1`+URL 키를 공유하며 잘못된 응답 형식을 거부한다. 배열로 변환한 결과를 같은 키에 저장하지 않는다. 회귀 `scripts/verify-exploration-list-cache.mjs`는 빈 목록/활동 있는 목록/재검증/범위 분리/잘못된 응답을 검증한다. DB migration 없음, 앱 재배포 필요.

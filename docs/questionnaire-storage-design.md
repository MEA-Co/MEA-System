# 질문지 저장 설계안

## 질문 유형 (2026-09-21)

`questionnaire_questions.kind`는 `text`(기본), `scale`, `single`, `multiple`이다. 선택지는 같은 행의 `options` JSONB 배열 `{id,label}`로 저장한다. 선택형 표시 방식은 `choice_style`의 `list`(기본)·`chip`으로 저장하며, 두 방식 모두 `isOther` 선택지에서 응답자가 직접 내용을 입력할 수 있다. 유형이 없던 기존 문서는 서술형으로 읽힌다. 초안 저장은 빈 선택지를 허용하지만 게시/배포 시 2~20개의 이름이 서로 다른 선택지를 검증한다. 척도 설정은 `scale_config` JSONB에 최고 점수(2~9), 양끝·가운데 문구, 선택적 서술 답변 사용 여부로 저장하며 기존 질문은 5점 기본값으로 읽힌다. 홀수 척도의 가운데 문구와 양끝 문구는 게시할 때 비어 있을 수 없다. 척도 답변은 `selection`에 점수 숫자 또는 `{score,text}` 객체로 저장하고 `body`에는 점수·해당 라벨·추가 답변을 사람이 읽을 수 있게 기록한다. 배포 후 기존 콘텐츠 잠금이 유형·선택지·척도 설정에도 적용된다.

질문–답변의 고유 ID는 그대로 유지한다. `questionnaire_answers.selection`은 화면 복원과 정확한 선택 검증을 위한 보조 정보다. 척도는 숫자, 단일은 선택지 ID 문자열, 다수는 ID 배열을 저장한다. 실제 `body`에는 DB 저장 시 선택 문구를 함께 기록한다. 예: `3점 · 보통이다`, `팀 프로젝트`, `팀 프로젝트, 발표`. 따라서 AI에 제공할 때 선택지 ID를 다시 조회하지 않아도 된다. 서술형의 body는 기존 RichText 형식을 유지하므로 `richTextPlainText`로 추출한다. 자유 응답도 기존 방식으로 유지한다.

REST 답변 쓰기의 answers 값은 기존처럼 문자열이다. 척도는 `"3"`, 단일은 ID 문자열, 다수는 JSON 문자열로 직렬화한 ID 배열, 미응답은 빈 문자열이다. 서버는 조회 시 selection을 해당 입력 형태로 복원하며 RPC가 텍스트 body와 selection을 한 번에 저장한다. 잘못된 선택/중복/범위 밖 점수는 DB에서도 거절한다. 모든 유형에 기존 자동 저장·동일 요청 재시도·revision 충돌·완료 잠금이 적용된다.

`20260921083603_questionnaire_question_types.sql`은 로컬 DB에만 적용했다. 운영 DB 적용은 별도로 필요하며 기존 migration 이력 차이를 해소하지 않은 채 `db push`하지 않는다. 로컬 SQL 테스트 `questionnaire_question_types.sql`, 기존 `questionnaire_storage.sql`·`questionnaire_free_response.sql`, Node 질문지 테스트와 빌드를 통과했다.

자유 응답: 컨설턴트 질문지 마지막에 선택 입력 칸을 제공한다. 일반 질문–답변은 기존 `questionnaire_answers` 행을 유지하며 질문에 속하지 않는 추가 메모는 `questionnaire_responses.free_response`에 저장한다. RichText 형식과 20,000자 저장 제한을 공유한다. 자동/수동 저장, 최종 완료에 함께 포함되며 완료 후 수정 불가다. API `freeResponse` 생략은 보존, 빈 문자열은 삭제를 의미한다. `20260918083342_questionnaire_free_response.sql`은 6인자 RPC를 추가하고 기존 5인자 호출을 호환한다. `supabase/tests/questionnaire_free_response.sql`로 저장·재조회·선택 입력·잠금·타인 접근·구버전 보존을 검증한다.

컨설턴트용 배포본의 답변 저장·완료와 새 배포 알림을 연결했다. 목록은 답변 전(작성 중 포함)/답변 완료로 나뉜다. 변경된 답변을 10초마다 자동 저장하며 수동 저장도 가능하다. 답변 완료는 모든 질문의 답변을 검사하고 최종 저장과 잠금을 한 트랜잭션에서 처리한다. 완료 후 재수정은 DB RPC와 트리거에서 차단한다. 배포본의 새 검토 요청은 UI와 DB에서 막고 기존 요청 조회·확인은 유지한다.

`20260918080745_questionnaire_consultant_answers.sql` 적용. 사용자/버전별 응답은 하나이며 revision과 요청 UUID/내용으로 충돌·중복 재시도를 검사한다. 답변 행의 ID는 처음 저장할 때 생성하고 이후 갱신해 질문–답변 쌍의 식별자를 유지한다. `GET /api/questionnaires/responses`는 본인 상태 목록, `GET/PUT /api/questionnaires/:versionId/answers`는 본인 답변 조회·저장·완료다. PUT 본문은 `{answers: {[questionId]: body}, revision, saveId, complete}`다. 직접 테이블 쓰기는 금지하고 권한 검사한 RPC만 사용한다. 리드/관리자도 자신의 응답만 접근한다.

컨설턴트가 배포본을 열면 `PUT /:versionId/read` → `open_questionnaire_response`가 assigned 응답을 생성한다. 아직 응답 행이 없는 배포본은 `unread_distributed_questionnaires`로 NEW 표시한다. 기존 게시 확인 기록과 독립적이다. 응답의 assigned_by는 질문지 제작자이며, 별도 배정 작업 없이 배포본을 모두에게 제공한다. Realtime은 본인 채널로 내용 없는 갱신 알림만 보내고 숨김/오프라인 복귀·60초 조회로 보완한다. 관리자 컨설턴트 표시 모드에서도 관리자 본인 응답으로 저장한다.

검증: `supabase/tests/questionnaire_answers.sql`(롤백), `scripts/verify-questionnaire-answers.mjs`, REST/Realtime 테스트. 저장 중 입력 보존·불확실한 완료 재시도·충돌 차단, DB 수정 잠금·ID 유지·타인 접근 차단·새 배포 확인을 검증한다.

## 본문 서식

질문·설명·검토 요청의 본문은 `QuestionRichTextEditor`(Tiptap)를 사용한다. 줄 시작에 `- `를 입력하면 글머리 목록으로, `+ `를 입력하면 플러스 기호를 유지하는 들여쓴 목록으로 전환하고, 텍스트를 선택하면 BubbleMenu에서 노란 하이라이트를 적용하거나 해제한다. 제목은 일반 텍스트다. 미리보기·게시본·이전 검토 요청은 같은 `RichTextContent` 렌더러를 사용한다.

기존 일반 텍스트는 그대로 유지한다. 목록이나 하이라이트가 있으면 `::mea-rich-text:v1::` 접두사와 제한된 문서 JSON을 기존 본문 text 열에 저장한다. 질문·설명 ID, 테이블 구조, 공개 권한과 자동 저장 방식은 유지한다. `lib/rich-text.ts`가 문단·목록·줄바꿈·하이라이트만 허용하고 임의 속성을 제거한다. 렌더링은 HTML 삽입 없이 React 요소로 처리한다. 기존 본문 길이 제한은 서식 데이터를 포함한 저장 문자열에 적용한다. 서식만 있는 빈 본문은 빈 텍스트로 정규화한다. 향후 본문 검색이나 AI 입력에는 `richTextPlainText`로 일반 텍스트를 추출한다.

검증: `node --test scripts/verify-questionnaire-rich-text.mjs`에서 기존 텍스트 호환, 편집기 목록·하이라이트의 저장/재열기, 서식 해제, 빈 값, 허용하지 않은 구조와 속성을 검사한다.

상태: 초안 저장·게시·검토 요청·배포 및 연결 DB 적용 완료. 컨설턴트 답변 작성/제출까지 연결했으며 별도 배정 UI는 후속 단계다.

## 게시·검토·배포 흐름

- `draft` → `published` → `distributed`. 질문지·버전·질문 ID는 상태 전환 시 유지된다.
- 작업 중인 질문지는 작성자의 목록에 표시한다. 게시/배포/수정은 실제 관리자 또는 리드이면서 최초 작성자(`questionnaires.created_by`)여야 한다. 삭제는 작성자인 리드/관리자 또는 다른 관리자에게 허용한다.
- 게시 중에는 작성자가 기존 편집기로 수정·10초 자동 저장할 수 있다. 다른 리드/관리자는 질문지 형태의 읽기 화면에서 공개·비공개 설명을 모두 본다. 일반 컨설턴트는 게시본과 메타데이터를 조회할 수 없다.
- 다른 리드/관리자만 각 질문에 내용(1~5,000자)으로 검토 요청을 남긴다. 요청자는 자신의 요청, 질문지 작성자는 받은 요청을 조회한다. 작성자가 확인 완료하면 해당 질문의 회색 `이전 검토 요청` 접기/펼치기로 이동한다. `resolved_at`을 남겨 네트워크 재시도로 확인한 요청이 되살아나지 않도록 한다. 일반 컨설턴트는 배포 후에도 검토 요청을 남길 수 없다.
- 작성자는 게시 목록의 배포 버튼으로 저장된 내용을 배포한다. 제목·최소 1개 질문·질문 본문을 검사하고, 같은 버전 잠금과 revision 검증으로 저장/삭제/배포 충돌을 막는다. 게시·배포 재시도는 같은 revision이면 안전하다.
- 배포 후에는 DB 트리거가 제목·섹션·질문·설명 수정을 막는다. 컨설턴트 사이드바에도 질문지 관리가 표시되고, 배포된 질문지와 공개 설명만 조회한다. 리드/관리자는 비공개 설명까지 조회한다. 관리자 컨설턴트 표시 모드에서도 서버에서 비공개 설명을 제거한다.
- 목록은 작업 중인 질문지/게시된 질문지/배포된 질문지로 구분하고 일반 컨설턴트에게는 배포된 목록만 제공한다. 미처리 검토 요청은 배포를 막지 않는다.
- 배포 이력이 있는 질문지만 보관 처리하여 내용·검토 요청·기존 답변을 보존한다. 작업 중/게시 상태는 배포 이력이 없으면 실제 삭제한다. 질문지·전체 버전·섹션·질문·설명·검토 요청(확인 완료 포함)·확인 기록·응답·답변을 한 트랜잭션에서 삭제한다. 재생성 방지용 버전 UUID와 삭제시각만 private에 남고 본문은 보존하지 않는다.
- 기존 게시본은 새 의미의 게시 상태로 유지한다. 이미 응답이 연결된 기존 게시본만 배포 상태로 전환해 답변의 질문 원문이 계속 고정되게 한다.
- 구현: `20260918040809_questionnaire_distribution_and_reviews.sql`, `20260918041349_restrict_questionnaire_metadata_visibility.sql`. SQL 검증은 `supabase/tests/questionnaire_workflow.sql`, `questionnaire_publication.sql`, `questionnaire_storage.sql`, `questionnaire_deletion.sql`이며 모두 롤백한다.

## 현재 구현

- 목록의 삭제 버튼은 확인 후 `delete_questionnaire` RPC를 호출한다. 배포 이력이 없으면 작업 중/게시 상태의 질문지와 모든 종속 데이터를 물리 삭제한다. 배포 이력이 하나라도 있으면 현재 초안도 포함하여 `questionnaires.archived_at`으로 보관 처리하고 질문·답변을 보존한다. 관리자 또는 작성자인 리드 권한과 revision을 검증하며 저장과 같은 잠금으로 직렬화한다. 완전 삭제 후에는 내용 없이 삭제된 버전 UUID·삭제 시각만 private 테이블에 남겨 늦게 도착한 최초 저장 재시도의 문서 재생성을 거절한다. 과거 보관된 자료를 일괄 삭제하는 데이터 정리는 수행하지 않는다. `supabase/tests/questionnaire_deletion.sql`로 권한·충돌·완전 삭제·발행 이력 보존·재생성 차단을 검증한다.

- `20260917080504_add_questionnaire_draft_storage.sql`, `20260917080738_index_questionnaire_composite_references.sql`에 7개 테이블·읽기 정책·원자적 초안 저장/조회 RPC와 인덱스를 기록했다.
- `app/(private)/dashboard/_views/questionnaire/lib/server.ts`에서 실제 관리자/리드 권한을 확인하고, `schema.ts`에서 UUID·본문 길이·중복 ID·문서 크기를 검증한다. 클라이언트는 `/api/questionnaires` REST API를 호출한다. 질문지 서버 액션 파일들은 제거했고 DB RPC·권한·revision 검증은 기존 서버 함수로 재사용한다.
- `QuestionnaireView`의 질문지 관리 목록에서 저장한 초안을 선택하거나 새 질문지 제작을 시작한다. 편집 화면의 질문지 목록으로 버튼으로 돌아갈 수 있다. `draft` URL 매개변수는 버전 ID다. 기본 진입은 제목·최근 저장 시각이 있는 질문지 목록을 표시하며, `draft=new`는 DB 쓰기 없이 빈 문서를 준비한다. 작업 중 목록과 편집은 작성자에게 제공한다. 게시 후 다른 리드/관리자에게 공유한다. 기존 초안 테이블 SELECT 권한은 리드/관리자에게 유지하되 저장·삭제 RPC는 작성자를 검증한다.
- 수정 사항이 있을 때 10초 간격으로 자동 저장하고 수동 저장도 제공한다. 저장 중 추가 입력은 다음 저장 대상으로 남는다. 중복 저장을 막고 응답을 받지 못한 요청은 동일 saveId·revision·문서로 재시도한다. 새 문서가 처음 저장되면 `history.replaceState(null, ...)`로 URL만 갱신한다. Next 내부 history state를 전달하거나 `router.refresh()`를 호출하지 않아 편집기와 저장 중 입력을 유지한다. SWR은 Realtime 변경 알림을 받으면 목록·본문·검토 요청을 재조회하고 60초 예비 조회를 유지한다.
- 버전의 `revision`, `last_save_id`, `last_save_hash`로 충돌과 불확실한 네트워크 결과의 재시도를 처리한다. 충돌/권한 오류는 자동 재시도를 멈추며, 화면의 작성 내용은 유지한다. 데이터 삭제·덮어쓰기 없이 새로고침 전 복사를 안내한다.
- 저장 중/완료/실패는 공통 shadcn Toast를 사용한다. 저장하지 않은 변경이 있는 페이지를 새로고침하거나 링크로 이탈할 때 확인한다. 역할 전환·브라우저 뒤로가기 등 모든 SPA 이탈을 가로채는 기능은 아니므로 이동 전 저장 버튼으로 완료 상태를 확인할 수 있다.
- 응답/답변 테이블은 본인 답변 저장·완료 RPC로 연결했다. 직접 테이블 쓰기는 금지하며 별도 배정 UI는 없다.
- 공개 테이블은 읽기만 허용한다. 문서 쓰기는 private의 제한된 SECURITY DEFINER 함수에서 실제 역할·작성자·문서 소속·revision을 검증하며, 공개 RPC는 SECURITY INVOKER 연결층이다. 배포된 콘텐츠는 DB 트리거로 수정/삭제를 차단한다.

검증: `node --test scripts/verify-questionnaire-storage.mjs`, `supabase/tests/questionnaire_storage.sql` (테스트 계정/자료를 만들고 전체 롤백). 연결 DB에서 저장·재조회·ID 보존·삭제 반영·중복 재시도·충돌·실패 원자성·역할별 조회와 비공개 설명 차단·배포본 보호를 확인했다. 보안/성능 advisor의 질문지 관련 누락 인덱스는 보완했으며 신규 미사용 인덱스 안내는 데이터 사용 전 정상 상태다.

## 핵심 결정

질문지 전체를 JSON 한 덩어리로 저장하지 않고 질문과 설명 항목을 별도 행으로 저장한다. 질문–답변 쌍의 외부 참조 ID는 `questionnaire_answers.id`로 사용한다. UUID를 사용하며 화면의 질문 번호나 배열 인덱스는 식별자로 사용하지 않는다.

배포한 질문지 버전의 제목·섹션·질문·설명·공개 설정은 고정한다. 향후 수정 기능은 새 버전의 초안을 만드는 방식으로 확장한다. 현재 배포본에서 새 버전을 만드는 UI는 제공하지 않는다. 기존 응답은 기존 버전의 질문을 계속 참조한다.

## 테이블

공통: PK는 `uuid`, 날짜는 `timestamptz`, 본문은 `text`. 생성·수정 시간은 DB에서 관리한다. 사용자 FK는 현재 `profiles.id`를 참조한다.

| 테이블 | 주요 필드 | 역할 |
| --- | --- | --- |
| `questionnaires` | `id`, `created_by`, `archived_at`, `created_at` | 버전이 바뀌어도 유지되는 질문지 ID |
| `questionnaire_versions` | `id`, `questionnaire_id`, `version_number`, `title`, `status`, `revision`, `published_at`, `distributed_at`, `created_at`, `updated_at` | 초안/게시/배포 버전. `status`: draft / published / distributed |
| `questionnaire_sections` | `id`, `version_id`, `title`, `position` | 버전 내 섹션과 순서 |
| `questionnaire_questions` | `id`, `version_id`, `section_id`, `logical_key`, `body`, `position` | 특정 버전의 질문 원문 |
| `questionnaire_question_details` | `id`, `question_id`, `title`, `body`, `visible_to_consultants`, `position` | 질문 의도 등 설명 항목. 공개 기본값 false |
| `questionnaire_responses` | `id`, `version_id`, `respondent_id`, `assigned_by`, `status`, `assigned_at`, `submitted_at` | 한 사람에게 배정한 응답 회차. status: assigned / in_progress / submitted |
| `questionnaire_answers` | `id`, `response_id`, `version_id`, `question_id`, `body`, `created_at`, `updated_at` | 개별 질문에 대한 답변. 이 ID가 질문–답변 쌍 ID |
| `questionnaire_review_requests` | `id`, `version_id`, `question_id`, `title`, `requested_by`, `requester_name`, `description`, `created_at`, `resolved_at` | 검토 요청과 확인 이력 |

`responses`가 배정과 제출 묶음을 함께 담당한다. 현재는 사용자/버전별 하나의 response만 허용하며 완료 후 재응답은 제공하지 않는다. 리드·관리자도 respondent가 될 수 있다. 응답 회차 내 각 질문에는 답변 행 하나만 허용한다.

`questions.id`는 특정 버전의 질문 ID다. `logical_key`는 새 버전으로 복제할 때 유지하여 버전 사이의 같은 질문을 추적한다. 완전히 다른 질문으로 교체하면 새 logical_key를 부여한다. 새 버전의 question id는 항상 새로 발급한다.

## 질문–답변 ID의 사용

예: 질문 Q1에 컨설턴트 A가 답하면 answer A1, 컨설턴트 B가 답하면 answer A2가 생긴다. 두 답변은 Q1을 공유하지만 쌍 ID는 다르다. A가 답변을 수정하면 A1은 유지하고 본문과 updated_at만 갱신한다.

다른 기능은 `answer_id`만 저장하고, answers → questions로 당시 질문을, answers → responses로 작성자와 응답 회차를 조회한다. 응답 제출 후에는 수정을 막는 것을 기본안으로 한다. 과거 답변 내용까지 시점별로 재현해야 한다면 이후 `answer_revisions`를 추가하고 해당 revision ID를 참조한다. 안정적인 answer ID만으로 수정 전 답변까지 보존되는 것은 아니다.

현재는 첫 답변 저장 시 해당 버전의 모든 질문에 답변 행을 원자적으로 만든다. 이후 자동 저장에서는 같은 행과 ID를 갱신한다. 본문은 빈 문자열을 허용하고 필수 응답 검증은 제출 시 수행한다.

## 무결성·수정 규칙

- `unique(questionnaire_id, version_number)` 및 질문지당 draft 하나만 허용하는 부분 유니크 인덱스.
- `unique(version_id, logical_key)`와 `unique(response_id, question_id)`.
- 질문의 `(section_id, version_id)`는 섹션의 `(id, version_id)`를 복합 FK로 참조한다.
- 답변의 `(response_id, version_id)` 및 `(question_id, version_id)`도 복합 FK로 참조한다. 다른 버전의 질문을 응답에 섞을 수 없다.
- position은 0 이상 정수. 부모별 순서 중복은 지연 가능한 유니크 제약으로 막고 순서 변경은 한 트랜잭션으로 처리한다.
- 제목·본문은 초안에서 빈 값 허용, 게시 시 제목·질문 본문을 검증한다. 섹션명과 설명 항목은 선택 입력이다. 빈 질문지 배포는 거절한다.
- 배포 버전과 그 하위 행의 변경/삭제는 DB에서도 차단한다. 초안과 게시 상태만 작성자가 편집·하위 항목 삭제할 수 있다. 배포 이력이 없는 질문지는 전체 삭제하고, 배포 이력이 있으면 삭제 제한 FK로 연결을 보존하며 archive 처리한다.
- 질문지 전체 저장은 트랜잭션으로 처리한다. `expected_revision`이 DB revision과 같을 때만 저장하고 증가시켜 동시 편집 덮어쓰기를 방지한다.
- 배정은 배포 버전에만 허용한다. 배정 대상은 실제 consultant / consultant_lead / admin 역할인지 서버와 DB에서 검증한다.
- 답변 수정 시 질문·버전·응답·작성자 연결은 변경할 수 없다. 소유자와 응답 상태를 검증한 저장 경로로 body만 변경한다. submitted 전환은 전체 제출 검증과 함께 원자적으로 처리한다.
- FK 조회, 정렬, RLS에 쓰는 `questionnaire_id`, `version_id`, `section_id`, `question_id`, `response_id`, `respondent_id`, `created_by`, `assigned_by`에 기존 복합 인덱스의 선두 열을 고려해 필요한 인덱스를 둔다.
- 사용자 탈퇴 시 응답이 연쇄 삭제되지 않도록 사용자 FK는 우선 RESTRICT로 설계하고, 삭제/익명화는 별도 보존 정책으로 처리한다.

## 현재 질문지 권한과 향후 응답 권한

질문지 작성은 리드와 관리자, 게시·배포는 최초 작성자, 응답은 배정받은 컨설턴트·리드·관리자가 수행하는 것으로 가정한다. 리드의 타인 답변 열람은 요구사항이 없으므로 기본적으로 허용하지 않는다. 다른 사람의 응답을 검토하는 권한은 구현 전에 확정해야 한다.

| 대상 | 컨설턴트 | 리드·관리자 |
| --- | --- | --- |
| 질문지 초안 | 접근 불가 | 작성·조회·편집 |
| 게시 질문 | 접근 불가 | 전체 설명 조회, 작성자만 편집 |
| 배포 질문 | 조회 | 전체 설명 조회, 모두 편집 불가 |
| 검토 요청 | 접근 불가 | 타인 질문지 요청 등록, 작성자만 확인 완료 |
| 질문 설명 | 배포 질문의 공개 항목만 조회 | 접근 가능한 질문의 전체 항목 조회 |
| 응답·답변 | 본인에게 배정된 응답만 조회·작성 | 기본적으로 본인 응답만 조회·작성 |

모든 노출 테이블에 GRANT와 RLS를 함께 설계한다. 공개 여부는 프런트엔드에서 숨기기만 하지 않고 설명 행의 SELECT 정책에 적용한다. 질문 본문 JSON에 비공개 설명을 중복 저장하지 않는다. [Supabase RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security)

실제 profiles 역할로 권한을 판단한다. 관리자 표시 역할 쿠키는 권한 근거가 아니다. 편집기의 미리보기는 작성자가 공개 설정을 확인하는 기능이며, 실제 수신자 조회 API와 구분한다.

공개 설정도 버전에 고정되므로 새 버전에서 비공개로 바꿔도 과거 배포본에는 소급되지 않는다. 즉시 공개 철회가 필요하면 버전별 접근 철회 정책을 별도로 추가해야 한다.

## 단계별 구현

1. 질문지·버전·섹션·질문·설명 저장 및 초안 다시 열기, 충돌 감지, RLS 검증.
2. 게시·검토·배포본 고정 완료. 답변 ID 생성·저장·완료 연결 완료. 후속: 새 버전 복제, 사용자별 별도 배정.
3. 컨설턴트 응답 화면, 질문별 저장·최종 제출, answer_id 기반 재사용.

초기 문서·섹션·질문 UUID는 서버에서 생성하고 추가 항목은 브라우저에서 생성한다. 저장할 때마다 전체 행을 삭제·재생성하지 않고 기존 ID를 유지한다. 공개 설정은 저장 필드 `visible_to_consultants`에 대응한다.

구현 시 검증: 비공개 설명의 직접 API 조회 차단, 학생 접근 거절, 컨설턴트의 게시본 접근 거절, 타인 답변 수정 거절, 교차 버전 답변 거절, 중복 저장의 ID 유지, 동시 편집 충돌, 배포 후 변경 거절, 이전 버전 응답 보존.

## 새 게시 표시

`questionnaire_publication_reads(user_id, version_id, read_at)`로 사용자별 확인 여부를 저장한다. 리드/관리자에게 다른 작성자의 미확인 게시본을 사이드바·게시 탭의 NEW 개수와 목록 항목의 NEW/연한 파란 배경으로 표시한다. 작성자 본인·초안·배포본·보관본은 제외한다. 기존 게시본도 확인 기록이 없으면 새 게시로 표시한다. 질문지 상세 화면이 실제로 열린 뒤 확인하며, 목록 조회·프리패치는 확인하지 않는다. 확인 성공 시 공유 클라이언트 상태만 갱신해 편집 중인 화면을 다시 로드하지 않는다. 저장된 확인 기록은 기기 간 공유되고, 수정/자동 저장으로 새 게시가 되지는 않는다. SWR로 새 게시 목록도 2초마다 갱신하며 포커스 복귀·네트워크 재연결 때 재검증한다. WebSocket 푸시는 아니므로 다른 사용자의 변경 반영에는 보통 최대 2초와 통신 시간이 걸린다. RLS는 자신의 기록 조회·확인만 허용한다. 테스트: `supabase/tests/questionnaire_publication_reads.sql`.

삭제 정책 변경: `20260918055538_delete_questionnaires_before_distribution.sql`. `supabase/tests/questionnaire_published_deletion.sql`은 관리자에 의한 게시본 삭제, 타 리드 차단, stale revision 거절, 모든 연결 행의 실제 삭제, 삭제 재시도 및 늦은 자동 저장 재생성 차단을 검증한다. 기존 보관된 질문지를 일괄 삭제하는 정리는 수행하지 않는다.

## REST API와 SWR

`app/api/questionnaires/[[...path]]/route.ts`가 HTTP 연결층이다. 사용자 인증·온보딩·실제 역할·표시 역할을 확인하고 JSON 상태 코드(401/403/404/409/503)와 `private, no-store`를 반환한다. JSON 요청 크기·버전 ID 일치와 교차 출처 요청을 검사한다. DB 권한은 기존 RPC/RLS에서 다시 검증한다.

| 메서드 | 경로 (`/api/questionnaires` 기준) | 동작 |
| --- | --- | --- |
| GET | `/` | 질문지 목록 |
| GET | `/new` | 저장하지 않은 새 편집 문서 준비 |
| POST | `/` | 첫 저장 (revision 0·동일 saveId 재시도 가능) |
| GET / PUT / DELETE | `/:versionId` | 문서/검토 조회, 저장, 삭제 |
| POST | `/:versionId/publication` | 게시 |
| POST | `/:versionId/distribution` | 배포 |
| POST | `/:versionId/reviews` | 검토 요청 등록 |
| PATCH | `/:versionId/reviews/:reviewId` | `{ resolved: true }` 확인 완료 |
| GET | `/unread` | 미확인 게시 ID |
| PUT | `/:versionId/read` | 게시 확인 |

- `lib/api-client.ts`의 `useQuestionnaireResource`는 useSWR로 60초 예비 갱신, 포커스/재연결 재검증, 읽기 오류 표시/재시도를 제공한다. 새 문서 준비는 편집 세션마다 별도 키를 쓰고 자동 재검증하지 않는다.
- `PublicationNotifications`의 SWRConfig는 계정·표시 역할별 별도 Map 캐시를 제공한다. 계정이나 역할 변경 시 이전 권한의 데이터를 재사용하지 않는다.
- 변경 성공 시 해당 캐시의 질문지 API 키를 mutate해 목록·열린 문서·검토 요청·NEW를 즉시 재조회한다. 저장 요청은 세션이 응답 revision을 수용한 뒤 갱신한다. `router.refresh()`로 편집기를 재생성하지 않는다.
- `QuestionnaireSaveSession.reconcileRemote`는 미저장 입력/불확실한 재시도/저장 중 요청을 보호한다. 깨끗한 편집기만 새 revision을 자동 반영하며, 작성 중 충돌은 내용을 남기고 저장을 차단한다. 다른 사용자의 삭제/배포/권한 변경도 내용을 보존한 채 안내한다.
- 자동 저장 10초는 그대로다. Realtime 알림에 따른 갱신과 60초 예비 조회는 저장을 실행하지 않는다. 일반 컨설턴트는 배포된 내용과 공개 설명만 조회하며 검토 요청/수정은 서버에서 거절한다.
- 검증: `node --test scripts/verify-questionnaire-api.mjs scripts/verify-questionnaire-storage.mjs scripts/verify-dashboard-access.mjs`. REST 메서드 연결, 인증/출처/ID 검증, JSON 오류, 자동 저장 입력 보존, 원격 revision 적용/충돌을 검증한다. 실제 브라우저 테스트는 별도 요청 시 진행한다.


### 변경 알림

- `hooks/useQuestionnaireRealtime.ts`는 Supabase Realtime의 private Broadcast를 구독한다. Vercel에 장시간 연결을 유지하는 서버를 추가하지 않는다. REST API는 실제 조회와 변경을 계속 담당한다.
- `questionnaires:staff`는 실제 관리자·리드만, `questionnaires:distributed`는 컨설턴트·리드·관리자만 수신할 수 있다. 확인 기록은 `questionnaires:user:<userId>`에서 본인만 수신한다. 관리자의 표시 역할은 구독 범위를 좁힐 뿐 DB 권한을 부여하지 않는다.
- 저장 RPC가 최종 revision을 올릴 때, 게시·배포로 상태가 바뀔 때, 질문지를 삭제·보관할 때, 검토 요청을 등록·확인·삭제할 때 DB 트리거가 알림을 만든다. 확인 기록은 해당 사용자에게만 알린다. RPC 트랜잭션이 롤백되면 알림도 롤백된다. 시스템 작업처럼 JWT 사용자 없이 직접 SQL을 실행한 경우는 60초 예비 조회로 반영한다.
- `realtime.send`에 넘기는 payload는 빈 객체이며 Supabase가 알림 ID만 덧붙인다. 문서 ID·제목·본문·비공개 설명·검토 내용은 전송하지 않는다. 데이터를 다시 받을 때 REST API에서 현재 권한을 검증한다. 클라이언트에는 알림 전송 권한을 부여하지 않는다.
- 화면당 하나의 구독 훅을 사용한다. 리드·관리자는 대시보드의 NEW 알림을 위해 항상 구독하고, 일반 컨설턴트는 질문지 화면에서만 배포 채널을 구독한다. 학생은 연결하지 않는다. 여러 채널은 Supabase 클라이언트의 WebSocket 연결을 공유한다.
- 알림이 몰리면 250ms 단위로 합쳐 갱신한다. 숨겨진 탭·오프라인 상태에서는 조회를 미루고, 복귀·온라인 전환·구독 재연결 후 보완 조회한다. 로그아웃·다른 계정 로그인·화면 이탈 시 구독과 타이머를 해제한다. SDK가 세션 토큰 갱신과 연결 재시도를 처리한다.
- 알림이 없을 때도 60초 간격 예비 조회를 유지한다. 변경이 없는 활성 화면의 주기적 API 요청은 기존 2초 대비 약 1/30이다. 자동 저장, 최초 로딩, 화면 복귀, 실제 변경에 따른 조회는 별도다. Realtime 연결·메시지는 Supabase 사용량에 포함된다.
- DB 설정: `supabase/migrations/20260918061737_questionnaire_realtime_notifications.sql`. SQL 검증은 `supabase/tests/questionnaire_realtime.sql`로 저장·게시·배포·삭제·검토·확인 기록 알림, 역할별 수신 권한, 내용 비노출, 클라이언트 발신 차단을 확인한다. 테스트 데이터는 롤백한다.
- 클라이언트 검증: `node --test scripts/verify-questionnaire-realtime.mjs`로 알림 병합, 재연결, 숨김/오프라인 복귀, 계정 변경/해제 및 60초 예비 조회를 확인한다. 실제 브라우저 간 수신 테스트는 별도 요청 시 진행한다.


### 질문별 검토 요청

- 각 질문 아래에서 **검토 요청 추가 → 내용 입력 → 검토 요청**으로 등록한다. 검토 요청의 제목 입력은 제거했다. 기존 질문 설명과 공통 `QuestionAnnotationEditor` 카드를 사용하며 입력 영역의 회색 배경을 유지한다. 작성자는 편집 화면의 해당 질문 아래에서 확인 완료한다. 배포 후에는 읽기 화면에서 확인하며 일반 컨설턴트와 미리보기에는 검토 요청을 표시하지 않는다.
- `POST /api/questionnaires/:versionId/reviews` 본문은 `{ id, questionId, description }`이다. 같은 요청 ID와 같은 내용을 재전송하면 중복 생성하지 않으며, 같은 ID의 다른 질문·내용은 충돌로 처리한다. DB는 질문이 해당 버전에 속하는지와 실제 사용자 권한·작성자·게시 상태를 검증한다.
- `question_id`는 질문 FK(`ON DELETE CASCADE`)다. 질문을 삭제하면 해당 설명과 검토 요청(확인 완료 포함)을 DB에서 함께 물리 삭제한다. 섹션 삭제도 하위 질문에 동일하게 적용한다. 질문 본문 스냅샷은 저장하지 않는다. 다른 질문의 요청에는 영향을 주지 않는다.
- 기존 질문지 단위 요청은 특정 질문에 속한 데이터가 아니므로 임의 연결하지 않고 `question_id = null`, 제목 `검토 요청`으로 보존하여 화면 위에 표시한다. 신규 검토 요청에는 질문·내용만 필수다. 기존 제목은 내용 앞에 함께 표시하고 신규 요청의 제목 열은 빈 문자열로 저장한다.
- DB 변경은 `20260918063010_question_level_review_requests.sql`과 `20260918063401_cascade_question_review_deletion.sql`이다. 삭제된 질문에서 남은 요청도 정리하고 원문 스냅샷 열을 제거했다.  검증은 `supabase/tests/questionnaire_question_reviews.sql`과 기존 워크플로·삭제·Realtime 테스트에 둔다.
- 초기 목록·문서 로딩은 공통 `QuestionnaireLoading`으로 콘텐츠 중앙에 회색 문구와 pulse 애니메이션을 표시한다. 동작 줄이기 환경에서는 애니메이션을 끈다. 배경 재조회는 기존 내용을 유지한다.

- 작성자에게 미확인 검토 요청 수를 목록·상태 탭의 초록 배지로 표시하고 해당 질문지 행과 문서 안내를 초록 배경으로 강조한다. 검토 요청 카드도 초록색이다. 단순 열람으로 지우지 않고 확인 완료 또는 질문 삭제 후 실시간으로 해제한다. 목록 조회에 미확인 요청 개수를 함께 집계하며 타인의 요청 수는 반환하지 않는다.


### 게시된 질문의 일반 설명 추가

- 작성자 이외의 리드·관리자도 게시된 질문 아래 `설명 항목 추가`에서 제목(1~500자)·내용(1~20,000자)·컨설턴트 공개 여부를 입력할 수 있다. 공개 여부의 기본값은 비공개다. 작성자는 기존 편집기의 설명 추가 기능을 사용한다. 배포 후에는 누구도 설명을 추가할 수 없다.
- `POST /api/questionnaires/:versionId/explanations` 본문은 `{ id, questionId, title, description, visibleToConsultants }`이며 `add_questionnaire_explanation` RPC가 저장한다. 실제 역할과 게시 상태, 질문 소속을 검증하고 동일 ID·내용 재시도는 중복 저장하지 않는다.
- 일반 설명은 별도 검토 데이터가 아니라 `questionnaire_question_details`에 저장된다. 초록색 검토 알림·개수·확인 완료 처리에 포함되지 않는다. 기존 설명과 같은 위치에서 보이고, 질문지 제작자와 해당 설명 작성자가 편집·삭제하며 배포 후 공개 설정에 따라 컨설턴트에게 표시된다. 질문 삭제 시 함께 삭제된다.
- 추가 시 버전 revision을 올려 실시간 갱신하며 이전 저장 재시도 표식을 초기화한다. 기존 편집기가 오래된 내용으로 덮어쓰려 하면 revision 충돌로 차단하여 새 설명을 지키고 작성 중 입력도 보존한다.
- DB 변경: `20260918070610_published_question_explanations.sql`. `supabase/tests/questionnaire_explanations.sql`에서 추가 권한, 게시/배포 상태 제한, 중복 재시도, 충돌 보호, 공개 범위, 검토 요청과 분리를 검증한다.


### 설명 작성자의 수정·삭제 권한

- `questionnaire_question_details.created_by`는 추가 당시 `auth.uid()`로 자동 기록한다. 기존 설명을 질문지 제작자가 전체 저장으로 수정해도 원 작성자는 바뀌지 않는다. 클라이언트가 작성자 ID를 지정할 수 없다.
- 게시 상태에서 실제 리드·관리자 중 질문지 제작자 또는 해당 설명 작성자만 수정·삭제할 수 있다. 그 외 관리자는 설명을 추가할 수 있지만 타인의 설명을 수정·삭제할 수 없다. 배포 후에는 모두 변경할 수 없다.
- 제작자는 기존 편집기를 이용한다. 설명 작성자는 읽기 화면에서 자신의 설명에 표시되는 `설명 수정`·`설명 삭제`를 사용하며 삭제는 확인 창을 거친다. 실제 권한은 RPC가 별도로 검증한다.
- `PATCH /api/questionnaires/:versionId/explanations/:id`는 `{ revision, title, description, visibleToConsultants }`, `DELETE`는 `{ revision }`을 받는다. 수정 시작·삭제 확인 창을 연 시점의 revision을 사용해 동시 변경 시 덮어쓰지 않는다. 성공 시 버전 revision을 올리고 Realtime으로 갱신한다.
- `20260918071456_questionnaire_explanation_ownership.sql`로 적용했다. 기록이 없던 기존 설명의 작성자는 임의 추정하지 않는다(사용자가 기존 설명을 모두 제거했다고 확인함). SQL 검증은 `supabase/tests/questionnaire_explanation_ownership.sql`이다.

- 미리보기는 `QuestionnairePreview`를 공통 사용한다. 제작자의 편집/미리보기 탭뿐 아니라 게시·배포된 질문지를 보는 다른 리드·관리자의 질문지 상세/미리보기 탭에서도 공개 설명만 표시한다. 상세·편집 패널은 탭 전환 시 유지해 작성 중인 설명·검토 요청 입력을 보존한다.

- 상세 조회는 `resolved_at`을 포함하여 미확인·확인 완료 요청을 함께 반환한다. 미확인 요청만 초록 카드와 안내·개수에 포함한다. 완료 요청은 기본 접힌 회색 ‘이전 검토 요청’에 표시하며 다시 열어 내용을 확인할 수 있다. 목록의 미확인 요청 집계 필터는 그대로 유지한다. 확인 완료 버튼은 연초록 배경과 짙은 초록 글씨를 사용한다.

### 직접 입력 선택지

선택형 options에는 `isOther?: boolean`을 저장한다. 단일선택형은 하나만, 다수선택형은 전체 20개 선택지 한도 내에서 여러 개를 허용한다. 칩형에서는 점선 칩, 목록형에서는 점선 선택 행으로 `+ 직접 입력`을 보여주고 여러 개면 `직접 입력 1`, `직접 입력 2`처럼 번호로 구분한다. 새 일반 선택지는 직접 입력 항목 앞에 추가하고, 기존 저장 순서가 달라도 제작·미리보기·응답 화면에서는 직접 입력 항목들을 마지막에 표시한다. 제작 화면의 `선택지 추가` 버튼은 직접 입력 항목 또는 추가 버튼 위에 둔다. 일반 선택은 기존 UUID 문자열, 직접 입력 선택은 항목별 `{id,text}`를 JSON 문자열로 전달하고 다수 선택은 두 형태를 섞은 배열로 전달한다. 내용은 항목당 5,000자 이하이며 작성 중에는 빈 내용을 저장할 수 있지만 완료 시 선택한 직접 입력 항목마다 입력해야 한다. 추가 서술을 사용하지 않는 질문은 기존 answers.selection 저장 형식(단일은 문자열, 다수는 JSON 배열)을 유지한다. 새 답변의 body에는 `직접 입력: 입력 내용`(여러 개면 번호 부여)을 포함하므로 AI 전달 시 별도 선택지 조회 없이 사용 가능하다. 질문별 답변 ID, revision, 자동 저장·완료 잠금은 유지한다.

### 선택형 추가 서술 답변

`choice_allow_text`를 켜면 단일·다수선택형 모두 선택지 아래 한 줄 서술 입력을 제공하며 입력 길이에 따라 높이가 늘어난다. 추가 서술은 선택 사항이고, 선택지 답변은 계속 필수다. `직접 입력` 선택지의 필수 내용과는 별개로 저장한다. 활성화된 질문은 `{choices:[선택값],text:"추가 서술"}` 문자열을 전달하고, 기존 선택형 응답 형식도 계속 읽는다. `selection`에는 객체를, `body`에는 선택지 문구와 값이 있는 경우 `추가 답변: 내용`을 함께 기록한다. 최대 5,000자이며 미리보기에서는 회색 배경, 제작 화면에서는 흰 배경·점선 테두리로 표시한다.

# 질문지 저장 설계안

상태: 초안 저장·게시·검토 요청·배포 및 연결 DB 적용 완료. 배정·컨설턴트 답변 작성/제출 UI는 후속 단계다.

## 게시·검토·배포 흐름

- `draft` → `published` → `distributed`. 질문지·버전·질문 ID는 상태 전환 시 유지된다.
- 작업 중인 질문지는 작성자의 목록에 표시한다. 게시/배포/수정은 실제 관리자 또는 리드이면서 최초 작성자(`questionnaires.created_by`)여야 한다. 삭제는 작성자인 리드/관리자 또는 다른 관리자에게 허용한다.
- 게시 중에는 작성자가 기존 편집기로 수정·10초 자동 저장할 수 있다. 다른 리드/관리자는 질문지 형태의 읽기 화면에서 공개·비공개 설명을 모두 본다. 일반 컨설턴트는 게시본과 메타데이터를 조회할 수 없다.
- 다른 리드/관리자만 설명(1~5,000자)과 함께 검토 요청을 남긴다. 요청자는 자신의 요청, 질문지 작성자는 받은 요청을 조회한다. 작성자가 확인 완료하면 목록에서 사라진다. `resolved_at`을 남겨 네트워크 재시도로 확인한 요청이 되살아나지 않도록 한다. 일반 컨설턴트는 배포 후에도 검토 요청을 남길 수 없다.
- 작성자는 게시 목록의 배포 버튼으로 저장된 내용을 배포한다. 제목·최소 1개 질문·질문 본문을 검사하고, 같은 버전 잠금과 revision 검증으로 저장/삭제/배포 충돌을 막는다. 게시·배포 재시도는 같은 revision이면 안전하다.
- 배포 후에는 DB 트리거가 제목·섹션·질문·설명 수정을 막는다. 컨설턴트 사이드바에도 질문지 관리가 표시되고, 배포된 질문지와 공개 설명만 조회한다. 리드/관리자는 비공개 설명까지 조회한다. 관리자 컨설턴트 표시 모드에서도 서버에서 비공개 설명을 제거한다.
- 목록은 작업 중인 질문지/게시된 질문지/배포된 질문지로 구분하고 일반 컨설턴트에게는 배포된 목록만 제공한다. 미처리 검토 요청은 배포를 막지 않는다.
- 배포 이력이 있는 질문지만 보관 처리하여 내용·검토 요청·기존 답변을 보존한다. 작업 중/게시 상태는 배포 이력이 없으면 실제 삭제한다. 질문지·전체 버전·섹션·질문·설명·검토 요청(확인 완료 포함)·확인 기록·응답·답변을 한 트랜잭션에서 삭제한다. 재생성 방지용 버전 UUID와 삭제시각만 private에 남고 본문은 보존하지 않는다.
- 기존 게시본은 새 의미의 게시 상태로 유지한다. 이미 응답이 연결된 기존 게시본만 배포 상태로 전환해 답변의 질문 원문이 계속 고정되게 한다.
- 구현: `20260918040809_questionnaire_distribution_and_reviews.sql`, `20260918041349_restrict_questionnaire_metadata_visibility.sql`. SQL 검증은 `supabase/tests/questionnaire_workflow.sql`, `questionnaire_publication.sql`, `questionnaire_storage.sql`, `questionnaire_deletion.sql`이며 모두 롤백한다.

## 현재 구현

- 목록의 삭제 버튼은 확인 후 `delete_questionnaire` RPC를 호출한다. 배포 이력이 없으면 작업 중/게시 상태의 질문지와 모든 종속 데이터를 물리 삭제한다. 배포 이력이 하나라도 있으면 현재 초안도 포함하여 `questionnaires.archived_at`으로 보관 처리하고 질문·답변을 보존한다. 관리자 또는 작성자인 리드 권한과 revision을 검증하며 저장과 같은 잠금으로 직렬화한다. 완전 삭제 후에는 내용 없이 삭제된 버전 UUID·삭제 시각만 private 테이블에 남겨 늦게 도착한 최초 저장 재시도의 문서 재생성을 거절한다. 과거 보관된 자료를 일괄 삭제하는 데이터 정리는 수행하지 않는다. `supabase/tests/questionnaire_deletion.sql`로 권한·충돌·완전 삭제·발행 이력 보존·재생성 차단을 검증한다.

- `20260917080504_add_questionnaire_draft_storage.sql`, `20260917080738_index_questionnaire_composite_references.sql`에 7개 테이블·읽기 정책·원자적 초안 저장/조회 RPC와 인덱스를 기록했다.
- `app/(private)/dashboard/_views/questionnaire/lib/server.ts`에서 실제 관리자/리드 권한을 확인하고, `schema.ts`에서 UUID·본문 길이·중복 ID·문서 크기를 검증한다. 클라이언트는 대시보드의 얇은 서버 액션을 호출한다.
- `QuestionnaireView`의 질문지 관리 목록에서 저장한 초안을 선택하거나 새 질문지 제작을 시작한다. 편집 화면의 질문지 목록으로 버튼으로 돌아갈 수 있다. `draft` URL 매개변수는 버전 ID다. 기본 진입은 제목·최근 저장 시각이 있는 질문지 목록을 표시하며, `draft=new`는 DB 쓰기 없이 빈 문서를 준비한다. 작업 중 목록과 편집은 작성자에게 제공한다. 게시 후 다른 리드/관리자에게 공유한다. 기존 초안 테이블 SELECT 권한은 리드/관리자에게 유지하되 저장·삭제 RPC는 작성자를 검증한다.
- 수정 사항이 있을 때 10초 간격으로 자동 저장하고 수동 저장도 제공한다. 저장 중 추가 입력은 다음 저장 대상으로 남는다. 중복 저장을 막고 응답을 받지 못한 요청은 동일 saveId·revision·문서로 재시도한다. 새 문서가 처음 저장되면 `history.replaceState(null, ...)`로 URL만 갱신한다. Next 내부 history state를 전달하거나 `router.refresh()`를 호출하지 않아 편집기와 저장 중 입력을 유지한다. 목록은 돌아갈 때 다시 조회한다.
- 버전의 `revision`, `last_save_id`, `last_save_hash`로 충돌과 불확실한 네트워크 결과의 재시도를 처리한다. 충돌/권한 오류는 자동 재시도를 멈추며, 화면의 작성 내용은 유지한다. 데이터 삭제·덮어쓰기 없이 새로고침 전 복사를 안내한다.
- 저장 중/완료/실패는 공통 shadcn Toast를 사용한다. 저장하지 않은 변경이 있는 페이지를 새로고침하거나 링크로 이탈할 때 확인한다. 역할 전환·브라우저 뒤로가기 등 모든 SPA 이탈을 가로채는 기능은 아니므로 이동 전 저장 버튼으로 완료 상태를 확인할 수 있다.
- 응답/답변 테이블은 향후 질문–답변 쌍 ID를 위한 구조만 준비했으며 클라이언트 쓰기는 허용하지 않는다. 현재는 저장·게시·검토·배포·조회까지 제공하며 배정·답변 작성·제출은 수행하지 않는다.
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
| `questionnaire_review_requests` | `id`, `version_id`, `requested_by`, `requester_name`, `description`, `created_at`, `resolved_at` | 검토 요청과 확인 이력 |

`responses`가 배정과 제출 묶음을 함께 담당한다. 같은 사람이 재응답하면 새 response를 만든다. 리드·관리자도 respondent가 될 수 있다. 응답 회차 내 각 질문에는 답변 행 하나만 허용한다.

`questions.id`는 특정 버전의 질문 ID다. `logical_key`는 새 버전으로 복제할 때 유지하여 버전 사이의 같은 질문을 추적한다. 완전히 다른 질문으로 교체하면 새 logical_key를 부여한다. 새 버전의 question id는 항상 새로 발급한다.

## 질문–답변 ID의 사용

예: 질문 Q1에 컨설턴트 A가 답하면 answer A1, 컨설턴트 B가 답하면 answer A2가 생긴다. 두 답변은 Q1을 공유하지만 쌍 ID는 다르다. A가 답변을 수정하면 A1은 유지하고 본문과 updated_at만 갱신한다.

다른 기능은 `answer_id`만 저장하고, answers → questions로 당시 질문을, answers → responses로 작성자와 응답 회차를 조회한다. 응답 제출 후에는 수정을 막는 것을 기본안으로 한다. 과거 답변 내용까지 시점별로 재현해야 한다면 이후 `answer_revisions`를 추가하고 해당 revision ID를 참조한다. 안정적인 answer ID만으로 수정 전 답변까지 보존되는 것은 아니다.

배정 시 해당 버전의 모든 질문에 대해 빈 답변 행을 원자적으로 만들어 두는 것을 권장한다. 그러면 작성 전부터 쌍 ID가 존재하며, 질문마다 자동 저장할 때 같은 행을 갱신할 수 있다. 본문은 빈 문자열을 허용하고 필수 응답 검증은 제출 시 수행한다.

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

실제 profiles 역할로 권한을 판단한다. 관리자 표시 역할 쿠키는 권한 근거가 아니다. 편집기의 컨설턴트 미리보기는 작성자가 공개 설정을 확인하는 기능이며, 실제 수신자 조회 API와 구분한다.

공개 설정도 버전에 고정되므로 새 버전에서 비공개로 바꿔도 과거 배포본에는 소급되지 않는다. 즉시 공개 철회가 필요하면 버전별 접근 철회 정책을 별도로 추가해야 한다.

## 단계별 구현

1. 질문지·버전·섹션·질문·설명 저장 및 초안 다시 열기, 충돌 감지, RLS 검증.
2. 게시·검토·배포본 고정 완료. 후속: 새 버전 복제, 사용자별 배정과 답변 ID 생성.
3. 컨설턴트 응답 화면, 질문별 저장·최종 제출, answer_id 기반 재사용.

초기 문서·섹션·질문 UUID는 서버에서 생성하고 추가 항목은 브라우저에서 생성한다. 저장할 때마다 전체 행을 삭제·재생성하지 않고 기존 ID를 유지한다. 공개 설정은 저장 필드 `visible_to_consultants`에 대응한다.

구현 시 검증: 비공개 설명의 직접 API 조회 차단, 학생 접근 거절, 컨설턴트의 게시본 접근 거절, 타인 답변 수정 거절, 교차 버전 답변 거절, 중복 저장의 ID 유지, 동시 편집 충돌, 배포 후 변경 거절, 이전 버전 응답 보존.

## 새 게시 표시

`questionnaire_publication_reads(user_id, version_id, read_at)`로 사용자별 확인 여부를 저장한다. 리드/관리자에게 다른 작성자의 미확인 게시본을 사이드바·게시 탭의 NEW 개수와 목록 항목의 NEW/연한 파란 배경으로 표시한다. 작성자 본인·초안·배포본·보관본은 제외한다. 기존 게시본도 확인 기록이 없으면 새 게시로 표시한다. 질문지 상세 화면이 실제로 열린 뒤 확인하며, 목록 조회·프리패치는 확인하지 않는다. 확인 성공 시 공유 클라이언트 상태만 갱신해 편집 중인 화면을 다시 로드하지 않는다. 저장된 확인 기록은 기기 간 공유되고, 수정/자동 저장으로 새 게시가 되지는 않는다. 새로고침·페이지 이동 시 새 게시 목록을 조회하며 실시간 푸시는 제공하지 않는다. RLS는 자신의 기록 조회·확인만 허용한다. 테스트: `supabase/tests/questionnaire_publication_reads.sql`.

삭제 정책 변경: `20260918055538_delete_questionnaires_before_distribution.sql`. `supabase/tests/questionnaire_published_deletion.sql`은 관리자에 의한 게시본 삭제, 타 리드 차단, stale revision 거절, 모든 연결 행의 실제 삭제, 삭제 재시도 및 늦은 자동 저장 재생성 차단을 검증한다. 기존 보관된 질문지를 일괄 삭제하는 정리는 수행하지 않는다.

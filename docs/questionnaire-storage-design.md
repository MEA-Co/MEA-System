# 질문지 저장 설계안

상태: 초안 저장·불러오기 구현 및 연결된 DB 적용 완료. 배포·배정·컨설턴트 답변 UI는 후속 단계다.

## 현재 구현

- 목록의 삭제 버튼은 확인 후 `delete_questionnaire` RPC를 호출한다. 발행 이력이 없으면 질문지·버전·섹션·질문·설명을 물리 삭제한다. 발행 이력이 하나라도 있으면 현재 초안도 포함하여 `questionnaires.archived_at`으로 보관 처리하고 질문·답변을 보존한다. 관리자/리드 권한과 revision을 검증하며 저장과 같은 잠금으로 직렬화한다. 완전 삭제 후에는 내용 없이 삭제된 버전 UUID·삭제 시각만 private 테이블에 남겨 늦게 도착한 최초 저장 재시도의 문서 재생성을 거절한다. 과거 보관된 자료를 일괄 삭제하는 데이터 정리는 수행하지 않는다. `supabase/tests/questionnaire_deletion.sql`로 권한·충돌·완전 삭제·발행 이력 보존·재생성 차단을 검증한다.

- `20260917080504_add_questionnaire_draft_storage.sql`, `20260917080738_index_questionnaire_composite_references.sql`에 7개 테이블·읽기 정책·원자적 초안 저장/조회 RPC와 인덱스를 기록했다.
- `features/questionnaires/server.ts`에서 실제 관리자/리드 권한을 확인하고, `schema.ts`에서 UUID·본문 길이·중복 ID·문서 크기를 검증한다. 클라이언트는 대시보드의 얇은 서버 액션을 호출한다.
- `QuestionnaireWorkspace`의 질문지 관리 목록에서 저장한 초안을 선택하거나 새 질문지 제작을 시작한다. 편집 화면의 질문지 목록으로 버튼으로 돌아갈 수 있다. `draft` URL 매개변수는 버전 ID다. 기본 진입은 제목·최근 저장 시각이 있는 질문지 목록을 표시하며, `draft=new`는 DB 쓰기 없이 빈 문서를 준비한다. 초안은 관리자/리드가 공유한다.
- 수정 사항이 있을 때 10초 간격으로 자동 저장하고 수동 저장도 제공한다. 저장 중 추가 입력은 다음 저장 대상으로 남는다. 중복 저장을 막고 응답을 받지 못한 요청은 동일 saveId·revision·문서로 재시도한다. 새 문서가 처음 저장되면 `history.replaceState(null, ...)`로 URL만 갱신한다. Next 내부 history state를 전달하거나 `router.refresh()`를 호출하지 않아 편집기와 저장 중 입력을 유지한다. 목록은 돌아갈 때 다시 조회한다.
- 버전의 `revision`, `last_save_id`, `last_save_hash`로 충돌과 불확실한 네트워크 결과의 재시도를 처리한다. 충돌/권한 오류는 자동 재시도를 멈추며, 화면의 작성 내용은 유지한다. 데이터 삭제·덮어쓰기 없이 새로고침 전 복사를 안내한다.
- 저장 중/완료/실패는 공통 shadcn Toast를 사용한다. 저장하지 않은 변경이 있는 페이지를 새로고침하거나 링크로 이탈할 때 확인한다. 역할 전환·브라우저 뒤로가기 등 모든 SPA 이탈을 가로채는 기능은 아니므로 이동 전 저장 버튼으로 완료 상태를 확인할 수 있다.
- 응답/답변 테이블은 향후 질문–답변 쌍 ID를 위한 구조만 준비했으며 클라이언트 쓰기는 허용하지 않는다. 현재는 초안 저장만 제공하므로 배포·배정·제출은 수행하지 않는다.
- 공개 테이블은 읽기만 허용한다. 초안 쓰기는 private의 제한된 SECURITY DEFINER 함수에서 실제 역할·문서 소속·revision을 검증하며, 공개 RPC는 SECURITY INVOKER 연결층이다. 배포된 콘텐츠는 DB 트리거로 수정/삭제를 차단한다.

검증: `node --test scripts/verify-questionnaire-storage.mjs`, `supabase/tests/questionnaire_storage.sql` (테스트 계정/자료를 만들고 전체 롤백). 연결 DB에서 저장·재조회·ID 보존·삭제 반영·중복 재시도·충돌·실패 원자성·역할별 조회와 비공개 설명 차단·배포본 보호를 확인했다. 보안/성능 advisor의 질문지 관련 누락 인덱스는 보완했으며 신규 미사용 인덱스 안내는 데이터 사용 전 정상 상태다.

## 핵심 결정

질문지 전체를 JSON 한 덩어리로 저장하지 않고 질문과 설명 항목을 별도 행으로 저장한다. 질문–답변 쌍의 외부 참조 ID는 `questionnaire_answers.id`로 사용한다. UUID를 사용하며 화면의 질문 번호나 배열 인덱스는 식별자로 사용하지 않는다.

배포한 질문지 버전의 제목·섹션·질문·설명·공개 설정은 고정한다. 수정하려면 새 초안을 만들고 다음 버전으로 배포한다. 기존 응답은 기존 버전의 질문을 계속 참조한다.

## 테이블

공통: PK는 `uuid`, 날짜는 `timestamptz`, 본문은 `text`. 생성·수정 시간은 DB에서 관리한다. 사용자 FK는 현재 `profiles.id`를 참조한다.

| 테이블 | 주요 필드 | 역할 |
| --- | --- | --- |
| `questionnaires` | `id`, `created_by`, `archived_at`, `created_at` | 버전이 바뀌어도 유지되는 질문지 ID |
| `questionnaire_versions` | `id`, `questionnaire_id`, `version_number`, `title`, `status`, `revision`, `published_at`, `created_at`, `updated_at` | 초안/배포 버전. `status`: draft 또는 published |
| `questionnaire_sections` | `id`, `version_id`, `title`, `position` | 버전 내 섹션과 순서 |
| `questionnaire_questions` | `id`, `version_id`, `section_id`, `logical_key`, `body`, `position` | 특정 버전의 질문 원문 |
| `questionnaire_question_details` | `id`, `question_id`, `title`, `body`, `visible_to_consultants`, `position` | 질문 의도 등 설명 항목. 공개 기본값 false |
| `questionnaire_responses` | `id`, `version_id`, `respondent_id`, `assigned_by`, `status`, `assigned_at`, `submitted_at` | 한 사람에게 배정한 응답 회차. status: assigned / in_progress / submitted |
| `questionnaire_answers` | `id`, `response_id`, `version_id`, `question_id`, `body`, `created_at`, `updated_at` | 개별 질문에 대한 답변. 이 ID가 질문–답변 쌍 ID |

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
- 제목·본문은 초안에서 빈 값 허용, 배포 시 제목·섹션명·질문 본문 및 추가된 설명 항목 제목/본문을 검증한다. 빈 질문지 배포는 거절한다.
- 배포 버전과 그 하위 행의 변경/삭제는 DB에서도 차단한다. 초안만 편집·하위 항목 삭제 가능하다. 발행 이력이 없는 질문지는 전체 삭제하고, 발행 이력이 있으면 삭제 제한 FK로 연결을 보존하며 archive 처리한다.
- 질문지 전체 저장은 트랜잭션으로 처리한다. `expected_revision`이 DB revision과 같을 때만 저장하고 증가시켜 동시 편집 덮어쓰기를 방지한다.
- 배정은 배포 버전에만 허용한다. 배정 대상은 실제 consultant / consultant_lead / admin 역할인지 서버와 DB에서 검증한다.
- 답변 수정 시 질문·버전·응답·작성자 연결은 변경할 수 없다. 소유자와 응답 상태를 검증한 저장 경로로 body만 변경한다. submitted 전환은 전체 제출 검증과 함께 원자적으로 처리한다.
- FK 조회, 정렬, RLS에 쓰는 `questionnaire_id`, `version_id`, `section_id`, `question_id`, `response_id`, `respondent_id`, `created_by`, `assigned_by`에 기존 복합 인덱스의 선두 열을 고려해 필요한 인덱스를 둔다.
- 사용자 탈퇴 시 응답이 연쇄 삭제되지 않도록 사용자 FK는 우선 RESTRICT로 설계하고, 삭제/익명화는 별도 보존 정책으로 처리한다.

## 권한 제안

질문지 작성·배포는 리드와 관리자, 응답은 배정받은 컨설턴트·리드·관리자가 수행하는 것으로 가정한다. 리드의 타인 답변 열람은 요구사항이 없으므로 기본적으로 허용하지 않는다. 다른 사람의 응답을 검토하는 권한은 구현 전에 확정해야 한다.

| 대상 | 컨설턴트 | 리드·관리자 |
| --- | --- | --- |
| 질문지 초안 | 접근 불가 | 작성·조회·편집 |
| 배포 질문 | 본인에게 배정된 버전 조회 | 조회 |
| 질문 설명 | 접근 가능한 질문의 공개 항목만 조회 | 접근 가능한 질문의 전체 항목 조회 |
| 응답·답변 | 본인에게 배정된 응답만 조회·작성 | 기본적으로 본인 응답만 조회·작성 |

모든 노출 테이블에 GRANT와 RLS를 함께 설계한다. 공개 여부는 프런트엔드에서 숨기기만 하지 않고 설명 행의 SELECT 정책에 적용한다. 질문 본문 JSON에 비공개 설명을 중복 저장하지 않는다. [Supabase RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security)

실제 profiles 역할로 권한을 판단한다. 관리자 표시 역할 쿠키는 권한 근거가 아니다. 편집기의 컨설턴트 미리보기는 작성자가 공개 설정을 확인하는 기능이며, 실제 수신자 조회 API와 구분한다.

공개 설정도 버전에 고정되므로 새 버전에서 비공개로 바꿔도 과거 배포본에는 소급되지 않는다. 즉시 공개 철회가 필요하면 버전별 접근 철회 정책을 별도로 추가해야 한다.

## 단계별 구현

1. 질문지·버전·섹션·질문·설명 저장 및 초안 다시 열기, 충돌 감지, RLS 검증.
2. 배포본 고정, 새 버전 복제, 사용자별 배정과 답변 ID 생성.
3. 컨설턴트 응답 화면, 질문별 저장·최종 제출, answer_id 기반 재사용.

초기 문서·섹션·질문 UUID는 서버에서 생성하고 추가 항목은 브라우저에서 생성한다. 저장할 때마다 전체 행을 삭제·재생성하지 않고 기존 ID를 유지한다. 공개 설정은 저장 필드 `visible_to_consultants`에 대응한다.

구현 시 검증: 비공개 설명의 직접 API 조회 차단, 학생/미배정 계정 접근 거절, 타인 답변 수정 거절, 교차 버전 답변 거절, 중복 저장의 ID 유지, 동시 편집 충돌, 배포 후 변경 거절, 이전 버전 응답 보존.

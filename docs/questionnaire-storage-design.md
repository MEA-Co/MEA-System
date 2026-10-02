# 질문·질문지 저장 구조

로컬 기준: `20261002074415_distributed_response_submissions.sql`. 운영은 사용자가 `20261002071428_direct_question_responses.sql`까지 적용 완료를 알렸으며 새 제출 기능은 적용 대기다. 기능은 [질문·질문지 관리](questions.md), 적용 절차는 [운영 안내](questions-operations.md)를 따른다.

## 식별자와 테이블

| 테이블 | 역할 |
| --- | --- |
| `questions` | 원본 질문의 본문·답변 필드·조건·행 설정·revision |
| `question_details` | 원본 질문의 설명과 컨설턴트 공개 여부 |
| `questionnaires` | 질문지 제목·작성자·상태·revision |
| `questionnaire_sections` | 질문지의 섹션과 순서 |
| `questionnaire_questions` | 원본 질문을 배치한 위치·섹션·순서 |
| `response_sessions` | 응답 작성자·출처 질문지·상태·구성·revision |
| `response_submissions` | 세션별 마지막 제출 답변·제출 시각·제출 revision |
| `question_responses` | 세션 안 원본 질문별 응답 ID·행·활성 행·본문 |
| `question_review_requests` | 원본 질문별 검토 요청 |
| `question_review_reads` | 요청별 제작자 읽음 기록 |
| `questionnaire_publication_reads` | 게시본 확인 기록 |

질문지 버전 테이블과 질문 버전 테이블은 제거했다. 질문지는 `questionnaireId`/`questionnaire_id`, 원본 질문은 `questions.id`로 식별한다. `questionnaire_questions.id`는 배치 ID이므로 원본 질문 ID와 다르다. `legacy_parent_id`는 과거 ID 추적용이며 현재 식별자로 사용하지 않는다.

`question_responses.question_id`는 원본을 직접 참조한다. `session_id` → `response_sessions.origin_questionnaire_id`로 출처 질문지를, `respondent_id`로 작성자를 구분한다. 같은 원본이라도 질문지가 다르면 응답 세션과 응답이 다르다. 동일 세션·원본 질문의 중복 응답은 금지한다. 응답 JSON은 `questionId`를 반환한다.

## 저장과 권한

질문은 `save_question`, 질문지는 `save_questionnaire_draft`로 저장한다. `revision`과 요청 ID로 충돌·중복 재시도를 보호하고, DB가 실제 역할·작성자·배치 소속·선행 관계를 검사한다. 표시 역할 전환은 실제 권한을 바꾸지 않는다. 질문과 설명은 원자적으로 저장하며 details 생략은 보존, 빈 배열은 삭제다.

독립 질문은 작성자·관리자가 조회한다. 게시본 공유 조회는 해당 질문지의 원본만 허용하는 별도 경로다. 작업 중 응답은 본인만 읽고 저장하며 게시 단계 실제 저장은 지정 가이드 계정에 제한한다. 다른 리드는 저장 없는 미리보기다.

가이드 응답은 최신 질문과 질문지 구성을 읽는다. 질문 변경 시 `OLD.fields`와 새 필드의 ID·유형을 비교해 호환 답변은 유지하고 삭제되거나 유형이 바뀐 필드의 답변만 지운다. 가이드 답변이 있으면 저장 API가 확인 동의를 검사한다. 이전 답변 보관·구조 변경 재작성 안내는 제공하지 않는다. `definitionToken`으로 오래된 구조의 저장을 거절한다.

질문지에서 질문·섹션을 제거할 때 가이드 응답이 있으면 확인한다. 저장 시 해당 질문지 세션의 응답만 삭제하고 다른 질문지의 응답·원본은 유지한다. 재배치는 빈 응답으로 시작한다.

배포 응답은 `question_responses`에 본인 작업 내용을 저장하고 제출 시 `response_submissions`에 활성 답변만 갱신한다. 제출 후 저장은 공개본을 바꾸지 않는다. 리드·관리자는 제출본만 조회할 수 있으며 원본 작업 응답 RLS는 본인 전용이다. 질문 정의는 잠긴 원본을 읽고 복제하지 않는다. 세션 유일성은 작성자·질문지·시작 단계 조합이며 가이드 게시 응답과 개인 배포 응답을 분리한다. 가이드 예시는 게시 단계 응답만 읽는다.

## 배포와 삭제

배포는 원본 질문별 미처리 검토 요청이 없어야 가능하다. 배포된 질문지와 포함된 원본·설명은 수정/삭제가 차단된다. 같은 원본을 사용하는 다른 질문지에서도 원본을 바꿀 수 없다.

저장된 배포 응답이 없으면 같은 질문지 ID로 게시/수정 중으로 돌아갈 수 있다. 빈 열람 세션과 게시 가이드 응답은 이 판정에서 제외한다. 다른 배포본이 사용하는 원본은 잠금을 유지한다.

질문 제거는 원본 삭제가 아니다. 원본 삭제 API는 archive 방식이며 배치·참조·배포 잠금 검사를 따른다. 질문지 삭제는 기존 응답 세션을 보존한다. 검토 요청은 원본에 귀속되며 출처 질문지 삭제로 사라지지 않는다.

## 구형 호환과 이력

원본 없는 구형 배포 응답만 `legacy_question_id`와 `legacy_definition`으로 기존 정의를 보존한다. 새 원본 응답에는 두 열이 NULL이다. 구형 응답 테이블은 제거했지만 기존 공개 저장 RPC와 호환 경로는 유지한다. 새 배치형 배포본은 별도 distributed-responses API로 저장·제출한다.

과거 migration·이전 장부·SQL 스니펫은 현재 기능과 구분한다. 폐기된 import 함수를 재실행하지 않는다. 미사용 구조 점검을 실제 질문지·응답 데이터 삭제 요청으로 해석하지 않는다. 과거 데이터 복원 기록은 Git 이력에서 확인할 수 있다.

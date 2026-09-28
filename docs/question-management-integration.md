# 질문·질문지 관리 통합

사이드바의 질문 관리에서 질문과 질문지를 관리한다. 리드·관리자는 질문/질문지 탭을 사용하고, 컨설턴트는 배포 질문지 목록과 본인의 응답 기능을 사용한다. 학생의 접근 정책은 유지한다.

- `/dashboard?view=questions`: 질문 목록(컨설턴트는 배포 질문지).
- `/dashboard?view=questions&question=<ID>`: 질문 편집.
- `/dashboard?view=questions&tab=questionnaires`: 질문지 목록.
- `/dashboard?view=questions&tab=questionnaires&draft=<ID 또는 new>`: 질문지 편집·조회.
- 이전 `view=questionnaire` 링크도 통합 화면의 질문지로 열린다.

편집·응답 화면에서는 상단 전환 탭을 숨긴다. 기존 목록 복귀, 미저장 변경 확인, 10초 자동 저장, 충돌 보호를 유지한다. 질문지에서 원본 질문을 여는 링크도 유지한다.

## 현재 파일 위치

| 역할 | 위치 (`app/(private)/dashboard/_views/` 기준) |
| --- | --- |
| 통합 화면 | `questions/QuestionsView.tsx` |
| 질문 컴포넌트·편집 화면 | `questions/components/question/` |
| 질문지 컴포넌트·목록·편집·응답·알림 | `questions/components/questionnaire/` |
| 질문지 조회·저장·검증 | `questions/lib/questionnaire/` |
| 질문지 자동 저장·실시간 갱신 훅 | `questions/hooks/questionnaire/` |
| 독립 질문 정의·검증 | 기존 `questions/lib/` |

기존 `questionnaire/` 파일은 삭제하지 않고 보존한다. 앱·API·회귀 검증은 새 구현을 사용한다. 이전 폴더의 README로 미사용 상태를 표시한다. 현재 사용하지 않는 `QuestionnaireEditor`, `QuestionDetailsEditor`, `QuestionTypeEditor`는 복사하지 않았다. 현행 질문 관리의 동명 컴포넌트와 혼동하지 않는다.

DB 스키마·데이터·API 경로는 바뀌지 않으며 DB migration은 필요하지 않다. 앱 배포로 적용한다.

## 질문지 테이블과 상태 변경

질문지 관리 목록은 제목 검색, 상태 필터(보관 제외/전체/수정 중/게시/배포/보관), 제목·상태·최근 수정·배포일·관리 열을 제공한다. 각 행의 공통 Select에서 변경할 상태를 고르고 확인한다. 컨설턴트의 답변 전/완료 화면은 유지한다.

- 작성자는 수정 중↔게시, 게시/수정 중→배포, 보관·복원을 할 수 있다. 관리자는 다른 작성자의 질문지도 보관할 수 있다.
- 배포→수정 중은 원본의 상태와 질문·답변을 유지하고, 별도의 질문지 초안을 만들어 편집 화면으로 이동한다. 섹션·질문·설명 순서, 질문 설정과 원본 질문 참조를 복사한다. 답변·검토 요청·읽음 기록은 복사하지 않는다. 기존 배포본과 새 초안은 서로 독립적으로 보관한다.
- 보관은 삭제하지 않는다. 보관 필터에서 확인하고 상태를 선택해 복원한다. 보관 중인 내용은 복원 후 열 수 있다.
- 배포본을 게시로 되돌리지는 않는다. 보관했던 배포본은 배포 상태로 복원하거나 새 수정용 초안을 만들 수 있다.
- 저장된 질문을 배치한 질문지의 배포는 기존 DB 보호 규칙으로 차단한다. 질문 버전 고정·열/행 답변 저장 연결은 별도 작업이다.

`PATCH /api/questionnaires/:id/status`는 `change_questionnaire_status` RPC를 호출한다. 실제 역할/작성자, revision, 이전 상태와 보관 시각을 검증하며 private 요청 영수증으로 동일 요청 재시도를 처리한다. 배포본은 수정하지 않으며 초안 복사 실패나 유효성 오류는 트랜잭션 전체를 롤백한다.

배포 전에 `20260928050243_questionnaire_status_management.sql` migration을 먼저 적용해야 한다. **위의 “DB migration은 필요하지 않다”는 뷰 통합만의 설명이며, 상태 관리에는 이 migration이 필요하다.** 로컬에서 SQL 상태·권한·답변 보존·재시도·배포 차단 테스트를 통과했다. 운영 DB에는 적용하지 않았다.

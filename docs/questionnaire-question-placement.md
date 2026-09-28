# 저장된 질문을 배치하는 질문지 제작

2026-09-28. 기존 파일과 데이터를 삭제하지 않고 제작 진입점을 `QuestionnaireComposer`로 전환했다.

## 사용 흐름

- 질문지 제목과 섹션 제목을 입력하고 `저장된 질문 배치`에서 질문 이름·본문으로 검색한다.
- 질문 관리에 저장된 활성 질문을 추가한다. 필요한 선행·참조 질문은 빠진 항목만 찾아 먼저 함께 추가한다.
- 한 질문은 한 질문지에 한 번 배치한다. 질문의 위·아래 버튼으로 순서를 변경하고, 섹션의 처음·끝을 넘기면 이웃 섹션으로 이동한다. 섹션 자체 순서도 변경할 수 있다.
- 조건·행 참조·선행 질문은 항상 먼저 배치한다. 올바른 배치를 깨는 이동·제거는 안내하고 취소한다. 원본 수정으로 배치가 이미 어긋났다면 수정은 허용하되 올바른 순서가 될 때까지 저장을 막는다.
- 원본 질문 수정은 `원본 질문 열기`로 질문 관리에서 진행한다. 질문지에서는 질문·열·조건·원본 설명을 직접 편집하지 않는다.
- 기존 질문지는 기존 본문·선택지·설명을 보존해 표시하며 순서 변경·제거와 새 질문 배치가 가능하다.
- 10초 자동 저장, 수동 저장, 동일 요청 재시도, revision 충돌 보호, 첫 저장 URL 유지 흐름을 재사용한다.
- 미리보기는 배치 순서대로 하나의 응답 상태를 공유한다. 모든 열 answered는 동일 행에서 검사한다. 조건의 all/any, 선택·텍스트·척도 비교와 참조 행 ID를 유지한다. 공개 설명만 노출하고 미리보기 답변은 저장하지 않는다.

## 질문과 답변의 식별

현재 제작 단계는 **원본 참조 방식**이다.

- `public.questions.id`: 여러 질문지에서 공통으로 쓰는 원본 질문의 ID.
- `questionnaire_questions.id`: 특정 질문지 안에 배치한 항목의 ID. 원본 수정이나 순서 변경으로 바뀌지 않는다.
- `questionnaire_questions.source_question_id`: 원본을 가리키는 외래 키. 기존 질문은 NULL이다.
- 질문의 필드·선택지·조건·행 구성·설명은 원본에서 읽는다. 배치 때 원본을 별개의 질문으로 복제하지 않는다.
- `questionnaire_questions.body`는 기존 저장·게시 검사와의 호환을 위한 본문이며, 원본 질문 전체나 고정 버전을 뜻하지 않는다. 새 배치의 본문·답변 형식을 읽는 소비자는 반드시 `source_question_id`를 따라야 한다. 제작 화면과 게시 상세는 이를 처리한다.
- 원본 조회는 포커스 복귀·재연결·60초 간격으로 갱신한다. 변경된 조건이 기존 배치 순서를 위반하면 배치 수정이 필요하다.
- 활성 질문지에 배치된 원본은 보관할 수 없다. 질문지 배치 제거는 원본 질문을 삭제하지 않는다.

질문–답변 데이터의 다음 단계는 **배포 때 질문 버전 고정**이다. 원본 ID를 유지하면서 별도의 불변 버전/스냅샷에 질문·열·선택지·조건·설명과 참조 관계를 보관하고, 답변은 `원본 질문 ID + 배포 질문 버전 ID + 배치 ID + 열 ID + 행 ID`로 연결하는 것을 권장한다. 배포 뒤 원본을 수정해도 이미 받은 답변의 의미가 바뀌지 않아야 한다. 같은 원본이라도 질문 의미·척도·선택지가 달라진 버전은 분석에서 무조건 합치지 않는다.

**이번 변경에는 배포 스냅샷과 새 열/행 응답 저장을 포함하지 않는다.** 새 배치를 포함한 질문지는 제작·저장·게시·미리보기까지 지원한다. 기존 단일 답변 저장 경로로 잘못 배포되지 않도록 DB 트리거와 API 안내로 배포를 차단한다. 기존 방식의 배포본·답변 경로는 유지한다. 새 배포/응답 구현 후 이 제한을 해제해야 한다.

## DB 반영과 검증

- migration: `supabase/migrations/20260928034945_questionnaire_question_placements.sql`
- 원본 외래 키 인덱스, 버전별 중복 배치 제약, 참조 순서 검증, 원본 보관 보호, 신규 배치 배포 보호를 포함한다.
- 기존 RLS와 작성자 RPC 권한을 유지한다. 클라이언트가 보낸 가짜 원문 대신 원본의 본문을 사용한다.
- 연결된 DB에 migration이 없으면 저장 전에 오류를 표시한다. 구형 RPC가 원본 ID를 무시한 채 일반 질문으로 저장하는 것을 방지한다.
- **로컬에만 적용했다. 운영 DB에는 반영하지 않았다.** 운영 적용 전 기존 이력 동등성 검토는 `local-supabase.md`를 따른다.
- Node 회귀: `scripts/verify-questionnaire-placements.mjs`와 기존 storage/API/question-types/answers 검증.
- SQL 회귀: `supabase/tests/questionnaire_question_placements.sql`과 관련 기존 질문·질문지 SQL 검증.
- 앱 빌드·타입 검사·변경 영역 lint 통과. Node 회귀 41개 통과.
- 질문·질문지 SQL 20개 중 19개 통과. `questionnaire_published_deletion.sql`은 `docs/local-supabase.md`에 이미 기록된 기존 `guard_submitted_answers` DELETE 처리 문제로 실패한다. 이번 변경에서는 해당 삭제 경로를 수정하지 않았다.
- 로컬 보안 advisor 오류·경고 없음. 전체 migration 재생과 로컬 스키마의 차이 없음 확인 후 이 migration 하나의 로컬 적용 이력을 등록했다. 이후 제거·재추가 저장 검증도 통과했다.
- 별도 브라우저 테스트는 수행하지 않았다.

## 삭제 후보 파일 — 아직 모두 보존

다음 3개는 현재 앱 진입점에서 사용하지 않으므로 새 제작 화면 확인 후 함께 삭제할 수 있다. 같은 이름의 **questions 폴더 파일은 삭제 대상이 아니다.**

| 파일 (프로젝트 루트 기준)                                                           | 이유                                                                                   |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `app/(private)/dashboard/_views/questionnaire/components/QuestionnaireEditor.tsx`   | 기존 직접 질문 제작 화면. `QuestionnaireView`가 새 `QuestionnaireComposer`를 사용한다. |
| `app/(private)/dashboard/_views/questionnaire/components/QuestionDetailsEditor.tsx` | 위 기존 편집기에서만 사용하는 설명 편집 요소.                                          |
| `app/(private)/dashboard/_views/questionnaire/components/QuestionTypeEditor.tsx`    | 위 기존 편집기에서만 사용하는 질문 유형·선택지 편집 요소.                              |

다음 파일은 현재 삭제하면 안 된다.

- `QuestionAnnotationEditor`, `QuestionRichTextEditor`, `RichTextContent`, 관련 CSS·rich-text·list-extension: 검토 요청·게시 설명·기존 답변에서 계속 사용한다.
- `QuestionChoiceInput`, `QuestionTextAnswerPreview`, `QuestionAnswerEditor`, `QuestionnaireAnswers`, `QuestionnaireFreeResponse`, `answer-session`, `answers-server`, `question-types`: 기존 배포본·답변 또는 미리보기에서 사용한다.
- `PublishedQuestionnaire`, `QuestionnairePreview`, `QuestionnaireReviews`, `PublishedExplanation`, `QuestionExplanationForm`: 새 배치와 기존 문서의 상세·미리보기·검토·설명에 필요하다.
- 질문지 API·저장 훅·저장 세션·타입·스키마·서버·목록·알림 파일: 새 제작 화면도 재사용한다.
- 모든 기존 migration과 DB 회귀 테스트: 운영 이력 및 기존 응답 호환 검증에 필요하다.

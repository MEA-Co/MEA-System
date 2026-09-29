# 질문·질문지 저장 구조

현재 기능 범위는 [질문·질문지 관리](questions.md), 적용 명령과 검증은 [운영 안내](questions-operations.md)를 따른다. 이 문서는 현재 코드의 데이터 계약이며 새 배치형 배포/응답이 구현됐다는 뜻은 아니다.

## ID와 테이블

| 테이블                            | 역할과 식별                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `questions`                       | 독립 원본 질문. ID, 작성자, 본문, fields JSONB, 조건·참조, 행 설정, revision   |
| `question_details`                | 원본 질문의 보조 설명·공개 여부. 질문–답변 원문과 분리                         |
| `questionnaires`                  | 질문지의 ID·최초 작성자·보관 시각                                              |
| `questionnaire_versions`          | 질문지 버전 ID·제목·상태·revision·게시/배포 시각                               |
| `questionnaire_sections`          | 버전 안 섹션과 순서                                                            |
| `questionnaire_questions`         | 배치 ID·섹션·순서·logical_key·source_question_id. 기존 질문은 원문을 직접 보유 |
| `questionnaire_question_details`  | 기존 질문지 질문의 설명. 작성자 이력과 공개 여부                               |
| `questionnaire_review_requests`   | 질문별 요청·요청자·내용·resolved_at. 구형 질문지 단위 요청도 유지              |
| `questionnaire_publication_reads` | 사용자/게시 버전별 확인 기록                                                   |
| `questionnaire_responses`         | 기존 배포본의 사용자/버전별 응답 세션·제출 상태·free_response                  |
| `questionnaire_answers`           | 기존 응답 세션 내 질문별 답변 ID·body·selection                                |

UUID와 답변 ID를 식별자로 사용하며 화면 번호·행 이름·배열 인덱스를 식별자로 쓰지 않는다. `questions.id`는 독립 원본 ID이고 `questionnaire_questions.id`는 특정 버전의 배치/기존 질문 ID다. `source_question_id`가 있는 배치의 fields·조건·행·설명은 원본에서 읽는다. 배치의 body는 기존 검사 호환용이며 고정 질문 버전이 아니다.

질문지 내 원본 중복 배치를 금지하고 선행 관계와 순서를 검증한다. 원본 수정·배치 순서 변경에도 해당 배치 ID를 유지한다. 사용 중인 질문지나 다른 질문이 참조하는 원본의 삭제/보관은 차단한다. 사용 현황은 `lib/question-usage.ts`와 관련 서버 조회에서 제공한다.

## 저장과 갱신

독립 질문은 `save_question`, 질문지는 `save_questionnaire_draft`로 저장한다. 실제 역할·작성자·소속·UUID·본문 길이·순환·참조 정의를 검증하고 부모와 자식을 트랜잭션으로 저장한다. revision과 saveId/내용 해시로 오래된 저장과 중복 재시도를 보호한다. 설명 details 생략은 보존, 빈 배열은 삭제다.

클라이언트는 10초 자동 저장과 수동 저장을 제공한다. 저장 중 추가 입력은 다음 저장 대상으로 남고, 응답이 불분명하면 같은 요청 ID·revision·내용으로 재시도한다. 충돌/삭제/권한 오류는 입력을 보존하고 저장을 차단한다. 질문의 미완성 로컬 초안은 사용자·질문별로 구분한다. 새 질문지 첫 저장은 `history.replaceState(null, ...)`로 URL만 바꾸어 편집기를 유지한다.

질문지 SWR 캐시는 사용자·표시 역할별로 분리한다. private Broadcast 알림을 250ms 단위로 모아 재조회하고 포커스·재연결·60초 예비 조회로 누락을 보완한다. 알림 payload에는 질문 본문 등 업무 데이터를 넣지 않는다. 깨끗한 편집기에만 원격 revision을 반영하며 미저장·저장 중·불확실한 요청을 덮어쓰지 않는다.

질문 페이지 검색은 DB의 `search_text` 생성 열·trigram GIN·수정시각/ID 정렬 인덱스와 RLS를 사용한다. 페이지당 10개, 유효 페이지로 보정한다. 관계/배치용 전체 조회는 500개 단위로 읽으며 상세 설명은 개별 조회로 분리한다.

## 권한과 게시

표시 역할은 UI/서버 조회 범위를 좁히는 용도다. RPC와 RLS는 실제 계정 권한을 검증한다. 독립 질문은 리드 본인 및 실제 관리자 접근이 기본이고 관리자 리드 화면에서는 추가로 본인만 조회한다. 질문지 목록의 내 질문지는 작성자로 제한한다.

`read_published_question_sources`는 실제 리드·관리자와 게시·미보관 상태를 검증하고 해당 질문지 원본만 제공한다. `published_questionnaire_authors`는 게시본 제작자 이름만 제공한다. 게시 취소 후 전용 원본 조회도 차단한다. profiles 전체 권한을 넓히지 않는다.

질문지 설명 RPC는 질문지 작성자만 추가·수정·삭제할 수 있다. 다른 설명 작성자·다른 관리자도 예외가 아니다. 질문별 검토 요청은 다른 리드·관리자가 등록하고 작성자가 확인한다. 배포 후 새 검토 요청은 차단한다. 요청 UUID 재시도로 완료된 요청을 재생성하지 않으며 질문 삭제 시 연결 설명·요청도 삭제한다. 게시 확인 기록은 검토 확인 및 응답 세션과 별개다.

## API

두 도메인은 하나의 화면에서 관리하지만 HTTP 계약은 분리한다.

| 경로                                                       | 계약                                                |
| ---------------------------------------------------------- | --------------------------------------------------- |
| `/api/questions`                                           | 목록/페이지 검색/관계 조회·질문 생성                |
| `/api/questions/:id`                                       | 상세·수정·삭제(현재 archive_question 호출)          |
| `/api/questionnaires`                                      | 목록·첫 저장                                        |
| `/api/questionnaires/new`                                  | DB 쓰기 없는 새 문서 준비                           |
| `/api/questionnaires/:versionId`                           | 상세·저장·삭제                                      |
| `/:versionId/status`                                       | 상태 변경·revision/이전 상태/보관 시각/요청 ID 검증 |
| `/:versionId/publication`, `/:versionId/distribution`      | 기존 게시·배포 API. 배치형 배포는 차단              |
| `/:versionId/reviews`, `/:versionId/reviews/:reviewId`     | 요청 등록·확인 완료                                 |
| `/:versionId/explanations`, `/:versionId/explanations/:id` | 설명 추가·수정·삭제                                 |
| `/unread`, `/:versionId/read`                              | 게시 확인 조회·기록(컨설턴트 배포본은 응답 시작)    |
| `/responses`, `/:versionId/answers`                        | 기존 배포본 본인 응답 목록·조회·저장·완료           |

위 표에서 축약 경로는 `/api/questionnaires` 기준이다. REST는 인증·온보딩·요청 크기·ID·동일 출처를 검사하고 JSON 오류와 private/no-store를 반환한다. DB에서도 다시 권한을 검증한다.

## 삭제·기존 배포본 호환

배포 이력이 없는 질문지는 `delete_questionnaire`가 질문지·버전·자식 데이터를 물리 삭제한다. 배포 이력이 있으면 보관해 내용과 답변을 보존한다. 늦은 최초 저장 재시도로 삭제한 문서가 재생성되지 않도록 private에 버전 UUID·삭제 시각만 남긴다. 원본 질문은 질문지 삭제와 별개다.

기존 배포본은 본문·질문·설명 변경을 DB에서 막는다. 서버의 배포→수정 중 계약은 기존 배포본을 유지하고 별도 초안을 만든다. 현재 UI에서 배포·보관 전환은 비활성이다. 새 배치형은 원본 버전 고정과 열/행 응답 모델을 연결하기 전까지 배포하지 않는다.

기존 응답은 사용자/버전당 하나이며 assigned → in_progress → submitted 상태다. 첫 답변 저장 이후 `questionnaire_answers.id`를 유지한다. body에는 읽을 수 있는 텍스트, selection에는 척도 점수·선택 ID/직접 입력 구조를 저장한다. 단일 직접 입력은 `{id,text}`, 다수는 일반 ID와 직접 입력 객체 배열, 추가 서술은 `{choices,text}`를 호환한다. 척도는 숫자 또는 `{score,text}`다. AI에 넘길 때 body와 `richTextPlainText`를 사용한다. 독립 질문 미리보기의 entryId별 다중 직접 입력과 기존 응답 저장 계약을 혼동하지 않는다.

자유 응답은 `responses.free_response`에 별도 저장하며 생략은 보존, 빈 문자열은 삭제다. 완료는 전체 답변 검증·저장·잠금을 원자적으로 수행한다. 제출 후 RPC/트리거로 변경을 차단한다. 답변 쓰기는 본인만 가능하며 관리자 컨설턴트 표시 모드도 관리자 자신의 응답을 사용한다. 공개 설명만 컨설턴트에게 전달하고 별도 배정 UI는 아직 없다.

본문은 일반 텍스트 또는 `::mea-rich-text:v1::` 접두사의 제한된 JSON으로 보관한다. 글머리·플러스 목록·번호 목록·하이라이트를 지원하며 임의 HTML을 삽입하지 않는다. 검색·AI 추출에는 표시 텍스트 변환 함수를 사용한다. 원문/선택 데이터와 설명을 섞지 않는다.

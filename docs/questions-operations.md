# 질문·질문지 운영과 검증

현재 기능은 [통합 안내](questions.md), 데이터 계약은 [저장 구조](questionnaire-storage-design.md)를 따른다. 문서에 기록된 과거의 ‘운영 미적용’은 현재 운영 상태의 근거가 아니다. 실제 연결 대상과 migration 이력으로 확인한다. 게시 후 검토 요청은 사용자 점검 전이다.

## 운영 DB 적용 순서

앱 코드·문서 정리만 배포할 때는 새 migration이 필요하지 않다. DB 변경이 포함된 릴리스는 항상 아래 순서로 진행한다. 자동으로 원격 DB를 변경하지 않는다.

1. 프로젝트 루트에서 연결 대상과 이력을 확인한다.

```bash
cat supabase/.temp/project-ref
npx supabase migration list --linked
```

2. [로컬/운영 이력 주의사항](local-supabase.md)을 읽고 적용 대상을 확인한다.

```bash
npx supabase db push --linked --dry-run
```

대기 목록을 해당 릴리스의 migration과 비교한다. 이미 운영 객체가 있지만 이력이 없는 항목은 동등성을 확인하기 전 진행하지 않는다. 예상 밖 항목을 적용하려고 `--include-all`, 원격 reset, `migration repair`를 임의 실행하지 않는다.

3. 대상과 이력이 확인된 경우 적용하고 재확인한다.

```bash
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

4. 앱을 배포하고 아래 기능별 확인을 수행한다. DB가 먼저 필요한 기능은 앱만 먼저 배포하지 않는다. 운영 데이터의 일회성 변환은 일반 migration 적용과 별개이며 [기존 질문지 이전 절차](legacy-questionnaire-import.md)를 따른다.

## 관련 migration 지도

아래는 추적용 목록이다. 이미 적용한 migration을 다시 실행하지 않으며 과거 파일을 수정·삭제하지 않는다. 전체 의존 순서는 `supabase/migrations/`의 이력이 기준이다.

| 버전·파일 이름의 핵심 부분                                                                                                                                 | 기능                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `20260923062030_create_question_blocks`, `20260923065223_question_block_editor_settings`                                                                   | 독립 질문 저장·설정                               |
| `20260923070752_rename_question_blocks_to_questions`, `20260923071712_optional_question_management_title`                                                  | questions 이름·선택 관리 제목                     |
| `20260923073954_question_details`                                                                                                                          | 독립 설명 원자적 저장                             |
| `20260923083334_question_response_references`, `20260923084501_question_choice_reference_conditions`, `20260923085519_question_answered_column_references` | 질문/열 응답 조건·선택 조건·행 참조               |
| `20260928034945_questionnaire_question_placements`                                                                                                         | 독립 질문 배치·순서 검증·배포 차단                |
| `20260928042153_import_legacy_text_questionnaire`                                                                                                          | 운영자 전용 전환 도구 설치(데이터 자동 이전 아님) |
| `20260928050243_questionnaire_status_management`                                                                                                           | 기존 상태 전환·보관·초안 복사 계약                |
| `20260928052431_question_server_pagination`, `20260928055251_question_page_size_ten`                                                                       | 서버 검색·페이지당 10개                           |
| `20260928061511_question_creator_visibility`                                                                                                               | 작성자별 질문 조회·참조 권한                      |
| `20260928102529_question_row_settings`                                                                                                                     | 최소 행 수·행 이름                                |
| `20260929053605_question_exploration_type`                                                                                                                 | 탐구활동 열 허용                                  |
| `20260929063207_questionnaire_published_sources`                                                                                                           | 게시본 범위의 원본 질문 조회                      |
| `20260929071720_questionnaire_published_review_permissions`                                                                                                | 제작자 이름·작성자 전용 설명 권한                 |

파일은 모두 `supabase/migrations/<위 이름>.sql`이다. 2026-09-23 당시 운영 반영 결과는 [별도 기록](production-db-rollout-20260923.md)에 있다. 이후 실제 운영 반영 여부를 이 문서만으로 추정하지 않는다.

## 검증 지도

브라우저 테스트는 별도 요청이 있을 때 수행한다. 자동 테스트 성공은 사용자 점검 완료를 뜻하지 않는다.

| 범위                  | 주요 검증 파일                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 접근 정책·통합 진입   | `scripts/verify-dashboard-access.mjs`                                                                                                                                                            |
| 질문 저장·조건·행     | `supabase/tests/questions.sql`, `question_details.sql`, `question_response_references.sql`, `question_choice_conditions.sql`, `question_row_settings.sql`                                        |
| 검색·작성자 분리      | `scripts/verify-question-pagination-api.mjs`, `supabase/tests/question_server_pagination.sql`, `question_creator_visibility.sql`                                                                 |
| 질문 Drawer·미리보기  | `scripts/verify-question-drawer.mjs`, `verify-question-reference-rows.mjs`, `verify-question-choice-conditions.mjs`, `verify-question-preview-direct-input.mjs`                                  |
| 질문지 편집·배치·저장 | `scripts/verify-questionnaire-drawer.mjs`, `verify-questionnaire-placements.mjs`, `verify-questionnaire-storage.mjs`, `supabase/tests/questionnaire_question_placements.sql`                     |
| HTTP·갱신·기존 응답   | `scripts/verify-questionnaire-api.mjs`, `verify-questionnaire-realtime.mjs`, `verify-questionnaire-answers.mjs`, `verify-questionnaire-rich-text.mjs`, `verify-questionnaire-question-types.mjs` |
| 게시 공유·권한        | `supabase/tests/questionnaire_published_sources.sql`                                                                |
| 탐구활동 열           | `supabase/tests/question_exploration_type.sql`                                                                                                                                                   |
| 기존 자료 이전        | `supabase/tests/import_legacy_text_questionnaire.sql`                                                                                                                                            |

위 표의 축약 파일은 같은 행의 직전 디렉터리 기준이다. 이전 설명 RPC 전용 SQL 테스트는 로컬 구조 제거와 함께 폐기했고 원본 설명·게시 조회 테스트로 대체했다. 과거 통과 기록을 현재 결과로 재사용하지 않는다. 실제 DB 테스트는 로컬 롤백 트랜잭션에서 수행한다. 로컬 실행·초기화 주의사항은 `local-supabase.md`를 따른다.

## 배포 후 확인할 화면

- 리드는 본인 질문만, 관리자는 관리자 화면에서 전체 질문·제작자를 본다. 관리자 리드 화면에서는 본인만 보인다.
- 질문 검색·다음 페이지는 최대 10개이며 미완성 본문 저장을 막는다. 사용/참조 중 질문은 삭제 이유를 툴팁으로 보여준다.
- 최소 2·최대 4행과 일부 행 이름을 저장·재조회한다. 미지정 이름은 숫자, 참조형은 앞선 응답 수를 따른다.
- 탐구활동 열은 본인의 활성 확정 자료만 첨부하고 미리보기 선택은 영속 저장하지 않는다.
- 질문지 추가 Drawer에서 생성/불러오기·원본 수정·배치를 확인한다. 게시 전 제목 없는 저장을 막는다.
- 게시본에 본인/타인의 질문지·제작자명이 표시된다. 타인은 확인 전 파란 강조, 확인 후 해제를 확인한다. 타인에게는 질문지 형태, 작성자에게는 편집기가 보이고 돌아가기는 대시보드다.
- 게시 후 검토 요청의 등록 → 작성자 알림 → 확인 → 이력 보존은 사용자 점검 대기다. 다른 사람의 설명 추가/수정은 차단돼야 한다.
- 새 배치형 배포·응답 저장은 지원 범위에 넣지 않는다. 기존 배포본의 답변은 보존한다.

## 원본 참조 저장 통일 — 로컬 전용 단계 (2026-09-29)

`20260929075817_questionnaire_source_required.sql`을 로컬에 적용했다. 앱 저장 검증과 DB 저장 함수는 sourceQuestionId 없는 신규/수정 요청을 거절한다. 제작·게시 미리보기는 원본 없이 기존 복사 본문으로 대체하지 않는다. 저장된 배치의 본문이 오래돼도 원본을 수정한 최신 내용으로 조회하고 게시 검사도 원본·참조 순서를 사용한다. 질문지 안의 새 질문 생성은 원본 저장 후 배치로 유지한다. 테이블·열·기존 데이터와 배포 응답 코드는 삭제하지 않았다.

로컬 적용 순서(현재 작업 DB에는 이미 적용됨):

```bash
npx supabase migration list --local
npx supabase migration up --local
npx supabase migration list --local
```

운영 DB 접근·적용은 하지 않았다. **이 단계 앱/migration을 현재 운영에 그대로 배포하지 않는다.** 운영의 기존 게시본을 같은 ID·게시 상태로 유지하면서 원본 참조형으로 전환하는 별도 작업이 먼저 필요하다. 그 작업과 검증을 마친 이후에만 이 문서의 운영 이력 확인 → dry-run → DB 적용 → 앱 배포 순서를 따른다.

다음 단계는 질문지의 이전 설명 API·RPC·저장/조회 의존성을 원본 question_details로 통일하는 것이다. 아직 해당 테이블을 제거하지 않았다. 이전 직접 질문 저장을 전제로 한 SQL fixture는 이제 저장에서 거절되므로, 향후 각 기능을 정리할 때 원본 생성·배치 fixture로 갱신한다. 이번 검증은 현행 제작·저장·게시·Drawer 및 기존 응답 세션 단위 테스트를 대상으로 한다.

## 원본 설명으로 통일 — 로컬 전용 단계 (2026-09-29)

`20260929080341_questionnaire_source_details_only.sql`을 로컬에 적용했다. 비어 있던 questionnaire_question_details와 전용 설명 RPC 5개·앱 API·UI를 제거했다. 설명은 원본 질문 편집기와 save_question/question_details로 관리한다. 질문지 저장에서 비어 있지 않은 배치 details를 거절하며 원본 설명을 덮어쓰지 않는다. 조회는 배치 details를 빈 배열로 유지하고 실제 설명은 원본 조회에서 읽는다. 검토 요청은 별도로 유지한다.

저장·삭제·상태 복사·조회·내용 보호 함수에서 이전 테이블 의존성을 제거했다. 일회성 이전 함수는 삭제된 테이블을 참조하지 않고 명시적으로 중단하는 안내만 반환하도록 폐기 처리했으며 이전 대응 기록 테이블은 유지한다. 이전 함수가 필요한 운영에서는 아직 이 변경을 적용하지 않는다.

로컬 적용 순서(현재 DB는 적용 완료): `npx supabase migration list --local` → `npx supabase migration up --local` → `npx supabase migration list --local`. 새 migration은 기존 설명 데이터가 한 건이라도 있으면 DROP 전에 중단한다. 운영 DB·데이터에는 접근하지 않았고 원본/질문지/응답 데이터도 삭제하지 않았다. 운영 적용은 게시본의 동일 ID 전환·설명 보존 계획을 별도로 검증한 후에만 진행한다.

다음은 배치 테이블의 중복 본문·유형·선택지·척도 열을 제거하는 단계다. 아직 이 열들과 기존 응답 테이블은 유지한다.


## 배치 중복 정의 정리 — 로컬 전용 단계 (2026-09-29)

`20260929081236_questionnaire_placement_definitions.sql`을 로컬에 적용했다. source_question_id가 있는 배치의 body·kind·options·scale_config·choice_style·choice_allow_text 값만 NULL로 정리한다. 저장 RPC는 앞으로도 이 값을 복사하지 않으며 DB 제약으로 중복 저장을 차단한다. 질문·배치 ID, 섹션·순서, 게시 상태, 검토 요청은 유지한다. 조회 응답의 이전 형식 필드는 호환용 기본값이며 실제 제작/게시 화면은 원본 질문을 읽는다.

**열 자체는 아직 제거하지 않는다.** 원본 참조가 없는 이전 배포본의 조회 및 답변 검증 RPC가 사용한다. 이전 행은 기존 값과 필수 조건을 유지한다. 원본 참조 배치에 배포/답변 이력이 있으면 migration은 정리 전에 중단한다. 해당 경우에는 별도 응답 구조 전환이 필요하다. 새 배치형 배포 차단도 유지한다.

현재 로컬은 원본 참조 배치 1개, 이전 배치 0개, 답변 0개였다. 정리 후에도 배치와 원본 설명은 유지했다. 제작·게시 SQL 회귀, 가상 이전 배포본의 선택 답변 검증·ID 유지·완료 잠금 회귀, 관련 JS 테스트 21개 및 보안 advisor를 검증했다. 실제 브라우저 검증은 실행하지 않았다.

다른 로컬 환경 적용 순서(현재 로컬에는 적용 완료):

```bash
npx supabase migration list --local
npx supabase migration up --local
npx supabase migration list --local
```

이전 `20260929080341`의 테이블 잠금이 shadow 재생에서도 트랜잭션 안에서 실행되도록 BEGIN/COMMIT을 보완했다. 운영에는 이번 변경이나 앞선 로컬 정리를 그대로 적용하지 않는다. 운영 전환·설명 보존 검토가 선행되어야 한다.

추가 열 삭제는 배포·응답 모델을 정할 때 이전 답변 경로와 함께 진행한다. 제작·게시 범위의 불필요한 중복 값 정리는 여기까지이며, 응답용 테이블과 이전 이전(import) 대응 기록은 삭제 대상에서 제외한다.

## 기존 운영 게시본 연결 예행연습 (2026-09-29)

사용자 조회 결과: 기존 게시본 dbc59647-e728-4d17-b312-b12fd2c8cd82에 원본 미연결 16개, 이전 설명 19개, 응답/답변 0개. 전환본에는 원본 16개가 연결되어 있고 설명 19개가 이전되어 있다. 본문·답변 열·행 설정이 바뀐 원본 1개는 사용자가 최신 내용을 게시본에 반영하기로 선택했다. 사용자는 public/private 백업 완료를 확인했다.

`supabase/snippets/link-published-questionnaire-sources.sql`을 운영 SQL Editor의 postgres 역할에서 **전체 실행**한다. 기본 마지막 문장은 ROLLBACK이다. 결과 linkedQuestions=16, removedDuplicateDetails=19, status=published 및 보존 검사가 true인지 확인한다. 예행연습은 실제 반영이 아니다. 성공한 같은 파일의 마지막 ROLLBACK만 COMMIT으로 바꿔 전체 실행하면 실제 전환이다. 질문/설명 매핑·소유자·내용·공개 여부·응답 없음 조건을 다시 검사하며, 기존 게시본 ID/상태/순서와 전환본 및 원본 질문/설명은 보존한다. 게시본 revision만 증가시켜 오래된 편집 요청을 거절한다. 이미 전환한 파일을 재실행하면 중단한다.

전환부터 migration·앱 배포 완료까지 질문/질문지 편집을 중지하고 기존 편집 탭을 닫는다. 운영 SQL은 이번에 조회한 특정 게시본과 16/19건만 대상으로 하며 다른 이전 설명이 있으면 중단한다. 실제 적용 성공 후 대기 migration이 확인한 3개뿐인지 dry-run으로 재확인하고 db push --linked → migration list --linked → db push --linked --dry-run → 앱 배포 순서로 진행한다. 오류가 발생하면 후속 단계는 실행하지 않는다. 기존 import 검증 SQL은 연결 전 상태를 전제하므로 전환 후 source_placements_unchanged 등이 false인 것이 정상이며 재사용하지 않는다.

로컬에서는 폐기 전 설명 테이블/내용 보호 함수를 트랜잭션 안에서 재현해 16질문·19설명과 수정된 원본 1개로 전환 및 전후 보존 검사를 실행한 후 전부 롤백했다. 운영 실제 전환은 사용자가 수행하며 아직 실행 결과를 받지 않았다.


## 서술형 탐구활동 참조 권장 (2026-10-01)

`20261001034040_question_text_exploration_recommendation.sql`은 기존 `private.question_editor_settings_valid(jsonb)` 검증 함수에 `explorationRecommended`의 서술형 전용 boolean 검사를 추가한다. 테이블·열·권한 변경이나 기존 행 수정은 없다. UI는 각 서술형 답변 열에서 체크박스로 설정하며 질문/질문지 미리보기 입력에 포커스할 때 파란 테두리와 탐구활동 참조 안내 말풍선을 표시한다. 유형 변경 시 옵션을 제거한다. 필수 첨부/실제 응답 저장 기능을 추가하는 변경은 아니다.

로컬 적용·저장/조회/끄기/재시도·잘못된 값 거절 SQL 회귀(`supabase/tests/question_exploration_recommendation.sql`)와 앱 스키마/변환 회귀(`scripts/verify-question-exploration.mjs`), 타입·린트 및 보안 advisor를 검증했다. 운영에는 자동 적용하지 않았다. 실제 브라우저 테스트는 진행하지 않았다.

운영 적용 순서:

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

운영 프로젝트가 `epwlcallocdjkmgdmtlv`이고, 이번 추가 대상이 `20261001034040_question_text_exploration_recommendation.sql`인지 확인한다. 예상과 다른 migration이 나오면 적용 전에 이력을 검토한다. 확인 후:

```bash
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

적용 대기가 없음을 확인한 뒤 앱을 배포한다. 서술형에서 체크 → 저장 → 다시 열어 체크 상태 유지 → 미리보기 권장 안내 → 체크 해제/저장 → 안내 사라짐을 확인한다. 다른 유형에서 옵션이 보이지 않는지도 확인한다.

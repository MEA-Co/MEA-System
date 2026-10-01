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

## 2026-10-01 질문 중심 응답 전환 — 1단계

`20261001043026_question_centric_responses.sql`은 `question_versions`, `response_sessions`, `question_responses`를 생성한다. 게시된 배치형 질문지에 리드·관리자가 실제 답변을 작성한다. 타인 답변 조회는 허용하지 않으며 일반 컨설턴트의 게시본 접근과 배치형 배포는 계속 차단한다. 이전 응답 테이블·데이터를 삭제하거나 옮기지 않는다.

### 전체 전환 순서

1. **이번 변경:** 새 테이블/RPC를 추가하고 게시본 리드 응답을 새 경로로 저장한다. 로컬에 적용하고 SQL 회귀·보안 검사를 수행했다. 기존 질문지·원본 질문·게시 상태는 유지한다.
2. **기존 경로 교체:** 일반 컨설턴트의 응답/목록/확인 기록과 구형 저장 RPC를 새 구조에 연결하고 기존 배포본 회귀를 검증한다. 리드와 컨설턴트의 공개 설명 범위는 구분한다. 로컬 완료.
3. **이전 데이터 확인:** 로컬·운영 모두 구형 응답 0건으로 확인했다. 별도 수동 데이터 이전은 불필요하다. 로컬 이전 migration 및 가상 데이터 보존 회귀는 완료했다. 아래 3단계 최신 기록을 따른다.
4. **마지막 정리:** 이전 내용의 동등성·새 경로 사용·롤백 가능성을 검증한 뒤 별도 migration으로 `questionnaire_answers`, `questionnaire_responses`와 더 이상 참조되지 않는 구형 정의 열을 제거한다. 빈 테이블이라도 의존 함수가 있으므로 지금 DROP하지 않는다.

### 운영 적용 순서

아래는 **1단계만** 적용하는 절차다. 로컬 적용 완료와 운영 적용은 별개이며 운영은 아직 적용하지 않았다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

연결 대상이 의도한 운영 프로젝트인지 확인한다. 이번 신규 파일은 `20261001043026_question_centric_responses.sql` 하나다. 앞선 `20261001034040_question_text_exploration_recommendation.sql`을 아직 운영에 적용하지 않았다면 이 파일이 먼저 나올 수 있다. 예상하지 않은 다른 migration 또는 이력 차이가 보이면 적용 전에 내용을 검토한다. 이력 확인 없이 `--include-all`, 원격 reset, `migration repair`를 실행하지 않는다.

```bash
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

적용 대기 없음과 이력 일치를 확인한 다음 앱을 배포한다. 배포 후 다른 리드로 게시본 열기 → 답변 입력 → 수동/10초 자동 저장 → 다시 열어 복원 → 조건 질문 응답 → 답변 완료 후 잠금을 확인한다. 작성자는 게시본 편집 화면의 `내 답변 작성`으로 본인 응답을 작성한다. 일반 컨설턴트 접근 차단, 타인 응답 비노출, 원본 수정 뒤 기존 응답 질문 내용 유지도 확인한다. 브라우저 실사용 검증은 아직 수행하지 않았다.

SQL 검증: `supabase/tests/question_responses.sql`, `question_response_conditions.sql`, `question_response_types.sql`. 모두 트랜잭션을 롤백하며 로컬 기존 데이터를 바꾸지 않는다.

## 2026-10-01 기존 배포본 응답 경로 전환 — 2단계

사용자가 1단계 게시본 응답 기능의 실사용을 확인했다. 모든 단계는 우선 로컬에서 진행하고, 운영은 전체 정리 후 별도로 진행한다.

`20261001044352_distributed_question_response_path.sql`을 로컬에 적용했다. 기존 일반 컨설턴트의 `/answers` 조회·저장·완료, `/responses` 상태 조회, `/read` 확인과 NEW 알림은 새 응답 테이블/RPC를 사용한다. 자동 저장·재시도·revision·완료 잠금·자유 응답 생략 시 보존을 유지한다. 개인 Realtime 알림도 `response_sessions`에서 발생한다. 기존 open/save RPC는 새 저장 함수로 연결하여 예전 클라이언트도 이전 테이블에 새 데이터를 쓰지 않는다.

구형 배포 질문은 독립 원본이 없으므로 `question_versions.legacy_question_id`에 역사적 질문 ID를 보존하고 본문/답변 정의를 불변 버전으로 캡처한다. `question_id`와 `legacy_question_id`는 정확히 하나만 존재한다. 질문 라이브러리에 임의의 원본을 생성하지 않는다. 일반 컨설턴트에게 비공개 설명을 노출하지 않으며 배치형 질문지의 배포 기능은 계속 차단한다.

**데이터 이전은 아직 3단계다.** 이전 세션이 있는데 같은 ID의 새 세션으로 이전되지 않았다면 조회·저장을 `Legacy response migration required`로 중단한다. 빈 답변을 생성하거나 기존 답변을 덮어쓰지 않는다. 미이전 세션의 완료/확인 표시는 이전 테이블을 읽어 유지한다. 이 두 읽기와 이전 보호 검사는 3~4단계에서 정리한다. 이전 테이블은 삭제하지 않았다.

로컬 검증: `supabase/tests/distributed_response_path.sql`, `questionnaire_legacy_response_compatibility.sql`, 기존 질문 중심 응답 SQL 3개, 답변 세션/Realtime Node 테스트. 브라우저 실사용은 2단계에서 별도로 수행하지 않았다.

### 나중에 운영에 적용할 때

지금은 실행하지 않는다. 3단계 데이터 이전과 4단계 정리 파일이 완성되면 아래 예상 파일 목록에 함께 포함하여 검토한다. 기존 응답이 있는 운영에 2단계만 배포하면 이전 보호에 따라 해당 응답 작성이 중단될 수 있다.

1. 프로젝트로 이동: `cd /Users/mealdm/Desktop/MEA/system`
2. 연결 대상·이력 확인: `cat supabase/.temp/project-ref`, `npx supabase migration list --linked`
3. 예상 파일 확인: `npx supabase db push --linked --dry-run`. 현재 새 구조 파일은 `20261001043026_question_centric_responses.sql` → `20261001044352_distributed_question_response_path.sql` 순서다. 아직 적용하지 않은 이전 migration과 앞으로 추가할 이전/정리 migration을 함께 검토한다. 예상과 다른 파일 또는 이력 차이는 적용 전에 해결하며 무조건 repair/include-all 하지 않는다.
4. 실제 적용: `npx supabase db push --linked`
5. 대기 없음 재확인: `npx supabase migration list --linked`, `npx supabase db push --linked --dry-run`
6. 앱 배포.
7. 리드 게시본과 일반 컨설턴트 기존 배포본에서 답변 복원·저장·완료·NEW·권한을 확인한다.


## 2026-10-01 데이터 확인 — 3단계 완료 및 절차 단축

사용자 요청으로 연결된 운영 `epwlcallocdjkmgdmtlv`를 읽기 전용 조회했다. `questionnaire_responses` 0건, `questionnaire_answers` 0건, `source_question_id` 없는 배치 0건이며 질문지 버전은 게시본 2개다. 새 `response_sessions`/`question_responses`는 아직 없고 운영 최신 migration은 `20260929081236`이다. 운영 DB에는 아무 변경도 적용하지 않았다.

따라서 별도 백업 복사·수동 데이터 이전·행별 대조 절차는 요구하지 않는다. 다음 4단계는 남은 구형 읽기/함수 의존성을 제거하고, 적용 시 대상 테이블이 여전히 비어 있는지 검사한 후 두 구형 응답 테이블을 제거하는 것이다. 기존 게시본 2개와 원본 질문·배치 구조는 유지한다. 데이터가 생겼다면 삭제를 중단한다.

로컬 `20261001045140_migrate_legacy_question_responses.sql`은 이전 데이터 0건으로 완료됐다. 이미 작성한 이전 함수는 migration 내에서 자동 실행되어 빈 DB에서는 아무 응답도 만들지 않는다. 운영자가 별도로 실행할 필요는 없다. 가상 세션 3개·답변 8개로 ID/작성자/본문/선택/자유 응답/시각/완료 상태, 중복 실행, 이전 후 수정 보존과 충돌 시 전체 취소를 확인했다. 테스트 데이터는 롤백했다. 이 단계에서 테이블 삭제는 수행하지 않았다.

나중에 운영 적용할 때는 앞 절의 명령 순서를 따른다: 프로젝트 이동 → 대상·이력 확인 → dry-run 예상 파일 확인 → 실제 적용 → 대기 없음 확인 → 앱 배포 → 기능 확인. 현재 응답 전환 파일 순서는 `20261001043026` → `20261001044352` → `20261001045140`이다. 앞으로 추가할 4단계 정리 파일과 아직 운영 미적용인 선행 파일도 함께 검토한다. 예상과 다른 파일이 있으면 적용 전에 이력을 검토한다. 지금은 운영 적용하지 않는다.


## 구형 응답 테이블 제거 — 4단계 (2026-10-01)

로컬 `20261001050017_remove_legacy_response_tables.sql` 적용 완료. `questionnaire_answers`, `questionnaire_responses` 두 테이블과 구형 이전·검증·미이전 보호·완료 잠금 함수를 제거했다. 상태/NEW 조회는 새 응답 세션만 읽는다. 질문지 삭제는 원본 질문과 질문별 응답·불변 질문 버전을 보존하고 세션의 질문지 연결만 NULL로 만든다. 게시된 기존 질문지 데이터는 삭제하지 않았다.

migration 첫 부분에서 두 테이블을 잠그고 0건인지 확인한다. 데이터가 있으면 전체 적용을 중단한다. CASCADE로 다른 객체를 무작정 제거하지 않는다. 기존 공개 open/save 응답 RPC는 새 저장 함수로 연결하는 호환 진입점으로 유지한다. 구형 배포 질문의 정의 열과 화면 호환은 이번 정리에서 제거하지 않았으며 새 배치형 배포도 활성화하지 않았다. 저장 테이블 통합과 모든 응답 UI/검증 함수의 완전한 통합을 구분한다.

검증: 게시본 저장·조건·유형 SQL, 구형 배포 경로/호환 SQL, 삭제 후 답변 보존, 남은 함수 참조 부재 검사. 구형 테이블을 직접 사용하는 과거 테스트는 해당 migration 시점 전용이다. `migrate_legacy_question_responses.sql` 및 이전 dry-run/verify snippet은 3단계까지만 실행 가능하다. 현재 회귀는 `question_responses.sql`, `question_response_conditions.sql`, `question_response_types.sql`, `distributed_response_path.sql`, `questionnaire_legacy_response_compatibility.sql`, `legacy_response_cleanup.sql`이다.


### 나중에 운영에 적용하는 순서 (현재 미적용)

1. 프로젝트 이동 후 연결 대상과 이력을 확인한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

운영 대상은 `epwlcallocdjkmgdmtlv`다. 2026-10-01 읽기 확인 기준 최신 이력은 `20260929081236`이므로 이후 파일은 다음 순서로 예상한다.

- `20261001034040_question_text_exploration_recommendation.sql`
- `20261001043026_question_centric_responses.sql`
- `20261001044352_distributed_question_response_path.sql`
- `20261001045140_migrate_legacy_question_responses.sql`
- `20261001050017_remove_legacy_response_tables.sql`

이미 적용한 파일은 제외된다. 예상과 다른 migration이나 이력 차이가 나오면 적용 전에 이력을 검토한다. 임의 repair/include-all/reset은 사용하지 않는다. 수동 이전 snippet은 실행하지 않는다.

2. 예상 목록이 맞을 때 실제 적용 후 대기 없음까지 확인한다.

```bash
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

3. 앱을 배포한다.
4. 기존 게시본 2개와 원본 질문 유지, 리드 응답 저장/재조회/완료 잠금, 일반 컨설턴트의 게시본 접근 차단을 확인한다. 별도 운영 데이터 삭제나 실사용 게시본 삭제 테스트는 하지 않는다.


## 게시 단계의 수정 가능한 응답 (2026-10-01, 최신 정책)

`20261001052151_published_live_editable_responses.sql`은 게시 단계에 대한 이전의 질문 고정/완료 잠금 정책을 대체한다. 배포 단계의 기존 동작은 변경하지 않는다.

- 게시본을 연 리드·관리자는 본인 응답을 저장하고 다시 수정한다. 게시 응답 UI에서 완료 잠금 버튼을 제거했고 이미 완료했던 게시 응답도 수정할 수 있다.
- `question_versions`는 마지막 저장 당시 정의 및 과거 답변 해석용으로 유지하지만, 게시 응답 화면과 검증은 원본 `questions`의 최신 정의를 사용한다. 질문 본문 수정은 기존 입력을 보존하고 반영한다. 5초 주기와 화면 포커스 복귀 시 최신 내용을 조회한다.
- 응답 시작 당시 제목·섹션·배치 구성을 개인 세션에 유지한다. 이후 원본 질문지의 배치를 복사본에 다시 덮어쓰지는 않는다. 원본 질문지가 삭제돼도 대시보드 `내 응답` 목록과 `response=<세션 ID>`로 본인 응답을 조회·수정한다. 원본이 다시 draft가 되어도 이미 연결된 본인 응답은 유지한다. 신규 응답 시작은 활성 게시본에만 허용한다.
- 유형/열/선택지/행/조건 등 답변 구조 변경 시 재작성 안내와 이전 답변을 표시한다. 사용자가 확인하기 전 자동 저장을 막는다. 저장된 이전 정의·행·본문은 `question_responses.previous_responses`에 보관하며 화면에서 다시 볼 수 있다. 작성 중 구조가 바뀐 미저장 입력도 현재 화면에 따로 남긴다.
- `definitionToken`과 세션 revision을 저장 시 검증하여 오래된 질문 구조로 저장하거나 원격 응답을 덮어쓰지 않는다. 질문/설명 정보는 연결된 본인 게시 응답에 대해서만 서버에서 읽으며 독립 질문 RLS는 넓히지 않는다.
- 원본 질문을 삭제하는 기존 archive 작업은 연결된 게시 응답과 그 이전 답변 기록도 제거한다. 다른 질문지/질문이 사용 중인 질문의 삭제 제한은 그대로다. 기존 배포 응답은 이 삭제 대상에서 제외한다.

테스트는 게시 응답 수정, 원본 본문 반영, 질문지 삭제 후 응답 조회/수정, 구조 변경 감지와 과거 답변 보존, 오래된 토큰 거부, 타인 세션 접근 거부, 원본 질문 삭제 후 응답 제거를 포함한다. 일반 컨설턴트의 게시본 접근 차단과 기존 배포 완료 잠금도 유지한다. 브라우저 실사용 테스트는 별도다.


### 이번 변경의 운영 적용 (아직 실행하지 않음)

1. 프로젝트 이동: `cd /Users/mealdm/Desktop/MEA/system`
2. 연결 대상·이력 확인: `cat supabase/.temp/project-ref`, `npx supabase migration list --linked`.
3. `npx supabase db push --linked --dry-run`으로 예상 파일 확인. 앞서 안내한 전환 migration을 모두 적용했다면 신규 파일은 `20261001052151_published_live_editable_responses.sql` 하나다. 아직 적용하지 않았다면 `20261001034040` → `20261001043026` → `20261001044352` → `20261001045140` → `20261001050017` → `20261001052151` 순서다. 예상과 다른 파일/이력은 적용 전에 검토한다.
4. 실제 적용: `npx supabase db push --linked`.
5. 적용 대기 없음 확인: `npx supabase migration list --linked`, `npx supabase db push --linked --dry-run`.
6. 앱 배포. 새 저장 API는 definitionToken을 함께 보내므로 이번 앱과 DB 변경을 함께 배포한다.
7. 리드 응답 저장/재수정, 원본 본문 수정 반영, 구조 변경 안내/이전 답변, 내 응답 목록을 확인한다. 삭제 후 보존/원본 질문 삭제 테스트는 별도 테스트용 질문지·질문으로 진행하며 실제 게시본을 테스트 목적으로 삭제하지 않는다.


## 가이드 계정의 게시 응답 (2026-10-01, 최신 정책)

`20261001055107_guide_consultant_published_answers.sql`은 게시 단계의 실제 응답 작성을 지정 계정으로 제한한다. 계정 UUID는 사용자 지정값 `b338f03e-9d7f-4367-be1e-96eb1d5473be`이며 `private.guide_consultant_id()` 한 곳에서 관리한다. 로컬 프로필의 consultant_lead 역할을 확인했다. 계정 ID와 리드/관리자 역할이 모두 맞아야 하며 다른 관리자도 실제 게시 응답을 저장할 수 없다.

- 대시보드 `내 응답` 영역 제거. 게시된 질문지를 열어 작성·수정한다.
- `PublishedResponse`가 실제 작성과 저장 없는 미리보기를 분기한다. 질문지 작성자는 편집 화면에서 가이드일 때 `내 답변 작성`, 그 외에는 `질문지 미리보기`로 전환한다.
- 일반 리드는 미리보기 입력만 가능하며 응답 저장 API/RPC는 차단한다. 일반 컨설턴트의 게시본 접근 제한은 그대로다.
- 가이드 답변을 별도 종류나 테이블로 복제하지 않는다. 기존 개인 응답 중 지정 계정의 질문별 최신 저장 본문을 예시로 조회한다. 원래 응답자 소유 정보와 일반 질문–응답 데이터의 의미를 유지한다.
- 질문지 제작 미리보기와 게시본 미리보기에서 각 질문 설명 아래에 같은 배경/테두리 스타일의 `가이드 답변` 접힘 영역을 표시한다. 답변이 없거나 최신 질문 구조에 재작성이 필요하면 예시를 표시하지 않는다. 작성 중인 미저장 입력과 구조 변경 이전 답변 기록은 타인에게 공유하지 않는다.
- 조회 요청은 최대 500개 질문 ID로 제한하고 작성자/관리자 또는 활성 게시본에 포함된 질문만 반환한다. 독립 질문 RLS와 개인 응답 테이블 RLS는 넓히지 않는다.
- 기존에 저장한 비가이드 리드의 응답은 삭제하지 않았다. 기존 배포 응답 로직도 변경하지 않았다.

검증: 가이드 저장/수정, 일반 리드 저장 거부, 미리보기용 가이드 조회, 일반 컨설턴트 조회 거부, 배포 응답 호환 SQL 회귀·타입 검사·린트. 브라우저 실사용 검증은 별도다.


### 운영 적용 순서 — 가이드 계정 지정

현재 운영은 변경하지 않았다. 계정이 운영에서도 동일 UUID의 리드/관리자인지 확인한 뒤 적용한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

직전 변경까지 적용했다면 예상 신규 파일은 `20261001055107_guide_consultant_published_answers.sql` 하나다. 이전 변경이 미적용이면 `20261001034040` → `20261001043026` → `20261001044352` → `20261001045140` → `20261001050017` → `20261001052151` → `20261001055107` 순서다. 예상과 다른 파일/이력이 나오면 실제 적용 전에 검토한다.

```bash
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

적용 대기 없음 확인 → 앱 배포 → 지정 계정으로 게시본 저장/재수정 → 다른 리드에서 미리보기 입력이 저장되지 않는지 확인 → 설명 아래 가이드 답변 펼침/접힘 확인 순서로 진행한다.


## 가이드 답변 서식·행 이름 수정 (2026-10-01)

`20261001060231_guide_answer_rich_rows.sql`은 가이드 조회 결과를 요약 문자열에서 `{ rows: [{ id, label, answers }] }`로 바꾼다. 저장된 rows의 RichText 원문에는 하이라이트가 유지되고 있었으나 이전 화면이 AI/검색용 plain-text body를 보여주면서 서식이 사라지고 내부 행 ID가 노출됐다. 표시에는 RichTextContent와 현재 질문의 열 이름을 사용하며, 행 이름은 row_labels 또는 원래 행 순서(1부터)를 사용한다. ID는 React 식별에만 쓰고 화면에 출력하지 않는다. 활성·비어 있지 않은 행만 공유하며 과거/비활성 응답은 노출하지 않는다. 기존 데이터 재저장이나 변환은 필요 없다.

로컬 회귀는 하이라이트 원문 유지, 음수 ID와 표시 이름 분리, 조건상 숨겨진 행 미노출을 검증한다. 운영 적용은 아직 하지 않았다.


운영 적용 순서:

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

직전 가이드 변경까지 적용했다면 예상 신규 파일은 `20261001060231_guide_answer_rich_rows.sql` 하나다. 미적용 선행 파일은 앞 절 순서대로 함께 확인하며 예상과 다른 파일/이력은 적용 전에 검토한다.

```bash
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

적용 대기 없음 확인 → 앱 배포 → 가이드 답변 하이라이트·행 이름·척도/선택 추가 서술 확인 순서로 진행한다.

## 운영 가이드 계정 지정 (2026-10-01)

사용자가 20261001060231까지 운영 migration 적용 완료를 확인했다. 운영 가이드 UUID는 `4e4c12e7-6357-4803-95de-e2d603bbda3e`, 로컬은 기존 `b338f03e-9d7f-4367-be1e-96eb1d5473be`다. 공통 migration의 과거 UUID를 수정하지 않는다.

운영 전용 `supabase/snippets/set-production-guide-consultant.sql`을 운영 프로젝트 `epwlcallocdjkmgdmtlv` SQL Editor에서 실행한다. 이 SQL은 계정의 리드/관리자 역할을 검사한 후 운영의 `private.guide_consultant_id()` 반환값만 교체한다. 반복 실행 가능하며 기존 응답 데이터는 변경하지 않는다. 로컬에서는 실행하지 않는다. 함수 정의의 환경별 차이는 의도된 설정이며 향후 db diff/db pull 결과에서 로컬 UUID로 운영 함수를 덮어쓰지 않도록 검토한다. 이 스니펫 작성만으로 운영에 적용된 것은 아니다.

순서: 프로젝트 경로 이동 → 연결 대상 및 `migration list --linked` 확인 → `db push --linked --dry-run`으로 대기 없음 확인 → 운영 SQL Editor에서 스니펫 실행 → 반환 UUID 확인 → 대기 없음 재확인 → 최신 앱 배포(이미 배포했다면 생략) → 운영 가이드 계정으로 저장/재조회 및 다른 리드의 미리보기 확인. 새로운 공통 migration은 없으며 기존 migration을 재실행하지 않는다.


## 게시본 최신 구성 동기화 (2026-10-01)

가이드 지정 계정과 나머지 컨설턴트 리드 모두 최신 게시본의 제목·섹션·질문 목록·순서를 표시한다. 이전의 응답 시작 당시 구성 고정 정책을 대체한다. 일반 consultant 역할의 기존 배포본 정책은 이 변경의 범위가 아니다.

가이드 세션의 `sync_published_response_layout`은 본인 세션에만 실행된다. 활성 게시본을 기준으로 신규 질문의 빈 응답을 만들고 현재 배치 ID에 연결하며 제목과 layout을 갱신한다. 기존 답변 rows/body/previous_responses 및 응답 ID는 유지한다. 배치에서 제외된 답변은 삭제하지 않고 활성 조회/저장 대상에서만 제외하며 같은 원본 질문을 재배치하면 기존 응답을 복원한다. 원본 질문 자체의 archive에 대한 기존 삭제 정책은 별도다. 게시 취소·보관·질문지 삭제 후에는 마지막으로 동기화한 구성을 유지한다.

질문지 단위 잠금 → 원본 질문 잠금 → 세션 잠금 순서를 적용하며 layout 갱신은 답변 revision을 증가시키지 않는다. 대신 definitionToken에 제목과 섹션/배치를 포함해 오래된 저장을 차단한다. 내부 동기화 함수는 공개 실행 권한이 없으며 기존 본인 세션 RPC에서만 호출한다. 실제 저장 권한은 가이드 지정 계정으로 유지한다. 환경별 guide_consultant_id 함수는 이 migration에서 변경하지 않는다.

상세 조회는 5초 및 포커스 복귀 시 갱신한다. 가이드 응답 UI는 추가된 질문만 원격 응답으로 초기화하고 기존 작성 중 입력을 유지한다. 제외된 질문의 작성 중 입력은 복사용 접힘 영역에 남긴다. 재추가한 질문은 기존 저장 답변으로 복원한다. 미리보기 입력은 계속 저장하지 않는다.

검증: `supabase/tests/published_live_layout.sql`, `question_responses.sql`, `question_response_conditions.sql`, `question_response_types.sql`, `distributed_response_path.sql`; `scripts/verify-published-live-layout.mjs`의 입력 병합 3개; 타입 검사·변경 파일 린트·로컬 보안 advisor. 실제 로컬 테스트 질문지에서 진로 흐름 노출과 기존 답변 동일성을 트랜잭션 롤백으로 확인했다. 브라우저 검증과 운영 적용은 진행하지 않았다.


### 운영 적용 순서

1. 프로젝트 경로로 이동하고 연결 대상과 이력을 확인한다. 대상은 `epwlcallocdjkmgdmtlv`인지 확인한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

2. 직전 적용이 `20261001060231`까지라면 예상 파일은 `20261001075311_live_published_response_layout.sql` 하나다. 예상과 다른 migration이 나오면 적용 전에 이력과 파일을 검토한다. 이 변경은 운영 가이드 계정 UUID를 덮어쓰지 않는다.
3. 실제 적용하고 대기가 없는지 다시 확인한다.

```bash
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

4. 최신 앱을 배포한다.
5. 테스트용 게시본에서 질문 추가·순서 이동·제외·재추가를 수행하고 가이드 계정과 다른 리드 화면이 최신 구성으로 갱신되는지 확인한다. 기존 답변 보존, 추가 질문 저장, 작성 중 다른 질문이 추가되어도 입력 유지, 오래된 구성 저장 차단을 확인한다. 실제 질문·답변을 검증 목적으로 삭제하지 않는다.

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
| 게시 공유·권한        | `supabase/tests/questionnaire_published_sources.sql`, `questionnaire_explanations.sql`, `questionnaire_explanation_ownership.sql`                                                                |
| 탐구활동 열           | `supabase/tests/question_exploration_type.sql`                                                                                                                                                   |
| 기존 자료 이전        | `supabase/tests/import_legacy_text_questionnaire.sql`                                                                                                                                            |

위 표의 축약 파일은 같은 행의 직전 디렉터리 기준이다. 설명 SQL 테스트는 최신 작성자 전용 계약에 맞춰 갱신했다. 과거 통과 기록을 현재 결과로 재사용하지 않는다. 실제 DB 테스트는 로컬 롤백 트랜잭션에서 수행한다. 로컬 실행·초기화 주의사항은 `local-supabase.md`를 따른다.

## 배포 후 확인할 화면

- 리드는 본인 질문만, 관리자는 관리자 화면에서 전체 질문·제작자를 본다. 관리자 리드 화면에서는 본인만 보인다.
- 질문 검색·다음 페이지는 최대 10개이며 미완성 본문 저장을 막는다. 사용/참조 중 질문은 삭제 이유를 툴팁으로 보여준다.
- 최소 2·최대 4행과 일부 행 이름을 저장·재조회한다. 미지정 이름은 숫자, 참조형은 앞선 응답 수를 따른다.
- 탐구활동 열은 본인의 활성 확정 자료만 첨부하고 미리보기 선택은 영속 저장하지 않는다.
- 질문지 추가 Drawer에서 생성/불러오기·원본 수정·배치를 확인한다. 게시 전 제목 없는 저장을 막는다.
- 게시본에 본인/타인의 질문지·제작자명이 표시된다. 타인은 확인 전 파란 강조, 확인 후 해제를 확인한다. 타인에게는 질문지 형태, 작성자에게는 편집기가 보이고 돌아가기는 대시보드다.
- 게시 후 검토 요청의 등록 → 작성자 알림 → 확인 → 이력 보존은 사용자 점검 대기다. 다른 사람의 설명 추가/수정은 차단돼야 한다.
- 새 배치형 배포·응답 저장은 지원 범위에 넣지 않는다. 기존 배포본의 답변은 보존한다.

# 질문·질문지 운영과 검증

기능은 [질문·질문지 관리](ui.md), 데이터 구조는 [저장 구조](data-api.md), 개발 환경은 [로컬 Supabase](../local-supabase.md)를 참고한다.

## 현재 적용 상태

**2026-10-15 사전 점검 후 보완: 시작 안내 이전 문제를 수정하고 별도 로컬 DB에서 검증했다.** 열린 구형 응답 화면 문제는 사용자 결정에 따라 이번 수정에서 제외하고, 작성자가 없는 새벽 시간에 저장 완료·편집 종료를 확인한 뒤 전환한다. 아직 운영 DB 적용과 앱 배포는 하지 않았다. 아래 최신 절차가 과거 날짜별 적용 안내보다 우선한다.

로컬 최신 이력은 `20261015105318_questionnaire_paged_list_reads.sql`이다. 상태 전환과 목록 조회 분리까지 로컬에 적용했다. 이번 사전 점검에서는 운영 `epwlcallocdjkmgdmtlv`의 이력·집계만 읽기 전용으로 재확인했고 dry-run만 실행했다. 운영 최신 이력은 `20261013033907_question_flow_insertions`이며 미적용 파일은 15개다. 운영 DB 변경·앱 배포·실제 브라우저 검증은 수행하지 않았다. 이전 published/distributed라는 표현은 당시 의미를 유지하며 새 코드의 상태는 검토 중(in_review)/배포(published)다.

## 최종 사전 점검 (2026-10-15)

검토 코드: `aa5e1ae`. 운영 조회는 `BEGIN READ ONLY`와 실행 시간 제한 아래 집계·식별자·형식만 확인했다. 개인 답변 본문을 출력하거나 운영 데이터를 시험용으로 변경하지 않았다. dry-run 성공은 SQL 실행·데이터 이전 성공을 의미하지 않는다.

### 1. 기존 응답을 보존하는 시작 안내 이전 — 수정·로컬 검증 완료

최초 점검의 `20261015034458_questionnaire_start_notice.sql`은 대상 질문지에 세션·응답·제출 이력이 하나라도 있으면 중단했다. 운영 2주차 질문지 `6e67447a-1c1b-4e09-aab9-7c3dd1e702cf`에는 세션 13개, 안내의 빈 응답 레코드 13개, 안내가 포함된 제출본 1개가 있었다. 안내의 실제 답변 내용은 비어 있었지만 다른 질문에는 작성 내용이 있으므로 세션을 삭제해서 해결하지 않는다.

**운영에 아직 적용하지 않은 해당 파일의 데이터 이전 부분을 보완했다.** 뒤에 새 파일을 붙여도 앞선 예외를 통과하지 못하기 때문이다. 이미 로컬에 적용된 결과와 영구 스키마·함수·권한은 같으며, 기존 로컬 DB에 재실행하거나 `migration repair`/reset으로 이력을 고치지 않는다. 운영에는 기존 15개 순서로 보완된 파일을 적용한다. 운영에 이미 적용된 과거 migration은 변경하지 않았다.

- 안내마다 질문지 1개 안내, 미배치 안내/부가 설명 없음 조건을 유지한다. 안내 응답의 행·활성 행·본문·과거 답변·참조, 제출본의 해당 항목, 마지막 저장 요청이 모두 비어 있는 지원 형식인지 확인한다. 출처/배치/질문지 연결이 예상과 다르면 중단한다.
- 빈 안내 응답 자리만 제거하고, 세션 `layout`에서 해당 배치와 그 결과 비는 섹션을 제거한다. 제출본과 마지막 저장 요청에서는 안내 키만 제거한다. 안내 원본은 보관하고 원문·버튼은 `start_notice`로 옮긴다.
- 일반 질문의 응답 ID·행·본문·생성/수정 시각, 세션 ID·revision·저장 ID·자유 응답·상태·제출 시각, 실제 제출 답변을 보존한다. 임시저장 작업본을 제출본에 복사하지 않으므로 제출 후 비공개 수정분도 유지된다. 질문지 자체 revision 증가는 기존 정책대로 유지한다.
- 전체를 한 트랜잭션·테이블 잠금 아래 실행하고 필요한 보호 트리거만 잠시 해제한 뒤 복구한다. 잠금 대기 5초/문장 실행 60초 제한, 전후 전체 행 지문 비교, 예상 밖 실제 안내 답변의 중단 조건을 둔다. 오류 시 해당 파일 전체가 롤백된다. 이미 성공한 앞선 파일까지 자동으로 되돌아가는 것은 아니다.

검증은 운영의 **스키마만** 가져온 독립 로컬 DB에서 가상 데이터로 수행했다. 운영 개인 답변을 복사하거나 쓰지 않았다.

- 안내 전용 섹션·일반 질문과 함께 있는 섹션·안내 없는 질문지 3종에 가이드, 임시저장, 최종 제출, 제출 후 비공개 수정, 단순 열람을 구성했다. 세션 15개/기존 제출본 6개/빈 안내 자리 10개를 사용했다.
- 안내 이전 전후 전체 행을 비교해 일반 답변·ID·과거 저장/제출 시각·메타데이터와 다른 질문/배치/섹션이 유지됨을 확인했다.
- 대기 migration 15개를 순서대로 끝까지 실행하고 함수 지문 검사도 통과했다. 이후 기존 사용자의 재조회, 동일 저장 재시도, 이어서 저장, 최초 제출/재제출, 가이드 및 직원 제출본 조회를 검증했다. 가상 데이터와 함수 변경은 모두 롤백했다.
- 실제 본문, 비활성 답변 행, 과거 답변, 제출 내용, 저장 재시도 내용, 잘못된 배치 연결, 들어오는 응답 참조의 7가지 비정상 사례는 모두 예상한 검사에서 중단·롤백했다.
- 검증 스크립트 린트와 로컬 보안 점검 통과. 실제 브라우저 테스트, 운영 전체 데이터 이전 시험, 운영 백업 복원 시험과 앱 배포는 미수행이다. 격리 검증 DB의 Realtime 메시지 권한 경고가 있었으므로 실시간 알림 전송은 이번 검증 범위가 아니다.

재현용 SQL 생성은 `node scripts/prepare-questionnaire-notice-session-check.mjs > /tmp/notice-chain-check.sql`이다. **20261013033907 상태로 복원한 별도 검증 DB 전용**이며 운영 또는 이미 최신인 개발 DB에서 실행하지 않는다. `response`, `rows`, `history`, `submission`, `retry`, `layout`, `reference` 인자를 주면 각 중단 사례를 만든다. `psql -v ON_ERROR_STOP=1`로 실행하고 성공 시 `ROLLBACK`, 실패 시 예상 오류와 연결 종료에 따른 롤백을 확인한다.

### 2. API 갱신 오류로 열린 응답 화면의 미저장 내용이 사라질 수 있음

- 새 `/api/questionnaires`는 `X-Questionnaire-Workflow: 2`가 없는 요청을 426으로 거절한다. 기존 브라우저는 새 서버 배포만으로 요청 헤더가 바뀌지 않는다.
- `QuestionnaireView.tsx`의 상세 조회는 5초마다 갱신하고 `sharedDocument && !error`일 때만 응답 화면을 유지한다. 갱신 오류가 발생하면 응답 편집기를 unmount한다. 이전 코드 `203e7ee`에도 `publishedDocument && !error` 분기가 있다. 이 커밋은 운영 DB 최신 이력에 대응하는 비교 기준이며 실제 배포된 앱 커밋은 별도로 확인하지 않았다.
- `useQuestionResponseEditor.ts`는 작성 내용을 React 상태에 두고 10초 간격으로 자동 저장한다. 응답의 미저장 내용을 localStorage/IndexedDB에 복구용으로 남기는 기능은 없다. `beforeunload`와 이동 확인은 React 내부 unmount를 막지 못한다. 따라서 마지막 저장 이후 입력이나 저장 실패 후 남아 있던 입력을 잃을 수 있다. 서버에 저장된 답변이 삭제된다는 뜻은 아니다.

사용자는 이 문제의 코드 수정은 이번 범위에서 제외하고, 작성자가 없는 새벽 시간으로 배포를 조정하기로 했다. **새벽이라는 시각이나 최근 DB 저장이 없다는 사실만으로 미저장 입력이 없다고 확인할 수는 없다.** 전환 전에 저장 완료·편집 종료를 확인하고 이후 DB 적용 → 앱 배포 → 새 버전 재접속을 진행한다. 작성 중인 화면을 먼저 차단하거나 강제로 새로고침하지 않는다. 장기적인 편집기 오류 유지/복구 저장 개선은 별도 후속 작업이다.

### 확인한 보존 범위와 한계

- 학습법·탐구활동의 대기 migration은 조회 함수 추가다. 해당 확정 데이터·파일·브라우저 임시저장을 일괄 삭제하는 작업은 없다.
- `203e7ee`의 실제 임시저장 코드로 가상 초안을 저장하고 현재 코드로 읽는 모듈 검증에서 두 도메인의 본문·참고자료·ID·revision·localVersion·첨부 메타데이터와 파일 원문이 유지됐다. 같은 Supabase URL·계정·브라우저 출처가 전제다. 실제 사용자 브라우저 저장소를 확인한 것은 아니다.
- 기존 저장/복구·첨부 실패·탭 충돌·응답 병합·제출 관련 JS 검사 74개 통과. 위 구형→신형 호환 검사는 별도 2개 도메인에서 통과했다. 브라우저 테스트는 하지 않았다.
- 첨부형→본문 언급 변환은 작업본·제출본·재시도 payload를 각각 변환하며 서로 복사하지 않는다. 22:23 조회상 운영 대상 원본 1개/작업 응답 1개/제출본 0개, 22:30 조회상 변환할 비어 있지 않은 값과 잘못된 UUID·구형 첨부 정의는 모두 0개였다. 실제 전환 직전 재확인이 필요하다.
- 제출된 행 이름 보정은 제출 revision과 실제 활성 행이 일치하는 경우만 보정하고 이후 비공개 수정분을 제출본에 복사하지 않는다. 상태 명칭 전환에는 행 수/내용 지문 비교와 함수 정의 지문 검사가 있다. 응답 무결성 migration은 기존 답변을 일괄 재저장하지 않으며 필수 조건은 이후 제출에 적용한다. 운영 진로흐름의 필수 대상 3개 필드가 모두 예상 text 형식인 것도 확인했다.
- 운영 가이드 계정 함수 지문은 `607716af71009f7941df8fef56b2e443`였다. 이번 작업에서는 변경하지 않았다.
- 전체 migration 연속 실행/롤백은 위 독립 로컬 DB의 가상 데이터로 검증했다. 실제 운영 전체 데이터 이전 시험, 백업 복원 시험, 배포 앱 버전 확인은 미수행이다. 로컬 검사 통과를 실제 운영 이전 성공으로 간주하지 않는다. DB 저장 시각만으로 사용자의 미저장 입력이나 접속 여부를 판단할 수 없다.

### 확인된 대기 파일

아래는 사전 점검 및 보완 후 dry-run의 15개 목록이다. 추가 migration은 만들지 않았으며 7번 파일의 보완을 포함한다. 실제 적용 직전 대상·이력을 다시 확인한다.

1. `20261013085231_study_query_contract.sql`
2. `20261013094552_exploration_query_contract.sql`
3. `20261014064007_distributed_questionnaire_authors.sql`
4. `20261014075610_submitted_named_row_labels.sql`
5. `20261014081939_retire_question_attachment_types.sql`
6. `20261014082243_convert_question_attachments_to_mentions.sql`
7. `20261015034458_questionnaire_start_notice.sql` — 기존 응답 보존 이전으로 보완
8. `20261015051602_question_read_models.sql`
9. `20261015054101_question_review_paged_reads.sql`
10. `20261015055947_question_owned_reviews.sql`
11. `20261015064129_questionnaire_editable_notice.sql`
12. `20261015074005_questionnaire_private_draft_access.sql`
13. `20261015075725_questionnaire_review_publication_workflow.sql`
14. `20261015090145_response_integrity_and_submission_reads.sql`
15. `20261015105318_questionnaire_paged_list_reads.sql`

### 과거 운영 확인 기록

2026-10-12 운영 `epwlcallocdjkmgdmtlv`의 최신 이력은 `20261012050319_study_registration_cards`다. 다른 작업에서 이미 운영에 반영한 검토 조회·학습법 솔루션·게시 공동 편집 migration 3개는 최신 main을 합쳐 로컬 이력과 맞췄고 재적용/repair하지 않았다. 등록 카드 migration 한 개만 임시 시험·회귀·기존 데이터/권한/가이드 보존 검사 후 적용했으며, 적용 후 신규 SQL 회귀와 기존 조건 해제 회귀·dry-run 대기 없음을 확인했다. 새 보안 경고는 없고 기존 경고 4개가 유지된다. 앱 배포와 실제 브라우저 기능 확인은 별도다.

선행 표형 응답 migration `20261011143258_question_answer_layouts`도 2026-10-12 운영 적용과 회귀 검증을 완료했다. 당시 검증 내용은 아래 표형 응답 절을 따른다.

아래 날짜별 절과 이전 기록의 ‘운영 미적용/적용 대기’는 당시 상태이며 현재 운영 이력보다 우선하지 않는다. 위 과거 기록의 검증 범위는 당시 환경 기준이며 이번 로컬 검증은 최신 절에 별도로 기록한다.

과거 migration은 재현용으로 유지한다. 완료된 이전 절차를 재실행하지 않는다. 구형 질문지 import 함수는 폐기됐으며 관련 과거 SQL 스니펫은 현행 실행 안내가 아니다.

## 이후 DB 변경 적용 순서

**이번에는 실행하지 않았으며, 사용자가 정한 새벽 배포 때 아래 순서로 진행한다.** 먼저 저장 완료·편집 종료와 복구 가능한 백업 시점을 확인한다. 작성자가 남아 있다면 전환을 미룬다.

운영 DB 적용은 원칙적으로 사용자가 수행한다. 표형 응답과 학습법 등록 안내 변경은 사용자의 검증 후 적용·커밋 승인 범위에서 에이전트가 수행했다. DB 변경이 없는 코드·문서 정리에 새 migration은 필요하지 않다.

1. 보완한 파일까지 반영된 작업본인지 확인하고 운영 백업/복원 지점, 연결 대상과 이력을 점검한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
```

운영 대상은 `epwlcallocdjkmgdmtlv`다. 대기 파일은 위 15개이며, 예상과 다르면 적용 전에 이력을 검토한다. `--include-all`, 원격 reset, migration repair로 우회하지 않는다.

2. 확인한 변경을 적용하고 적용 대기가 없음을 재확인한다.

```bash
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
```

3. 적용 대기 없음 확인 후 앱을 배포하고 새 버전으로 접속한다. 2주차 안내·기존 임시저장 이어서 작성·최종 제출본·제출 후 비공개 수정분과 학습법/탐구활동 임시저장 복원을 확인한다. 검증 목적으로 실제 답변을 지우거나 재제출하지 않는다. 이미 저장을 끝내고 편집을 종료한 상태에서 전환하는 것이 전제다.

## 환경별 가이드 계정

운영 가이드 UUID는 `4e4c12e7-6357-4803-95de-e2d603bbda3e`, 로컬은 `b338f03e-9d7f-4367-be1e-96eb1d5473be`다. `private.guide_consultant_id()`의 환경별 차이는 의도된 설정이다. 스키마 비교·배포 시 로컬 UUID로 운영 함수를 덮어쓰지 않는다.

계정 설정이 필요한 경우에만 `supabase/snippets/set-production-guide-consultant.sql`을 검토한다. 운영에서만 실행하며 계정 역할을 검사한다. 이미 설정했다면 재실행할 필요가 없다.

## 현행 검증

기본은 타입 검사·관련 파일 린트·필요한 회귀 검사다. 브라우저 검증은 사용자 요청이 있을 때만 수행한다.

```bash
npm run typecheck
npm run build
```

질문·응답 DB 회귀는 아래 파일을 사용한다. 로컬 컨테이너 `supabase_db_system`에서 각 파일을 psql로 실행하며 테스트는 롤백된다.

- `supabase/tests/questionnaire_workflow_v2.sql`
- `supabase/tests/questionnaire_private_draft_access.sql`
- `supabase/tests/review_questionnaire_collaboration.sql`
- `supabase/tests/guide_answer_field_changes.sql`
- `supabase/tests/guide_question_removal.sql`
- `supabase/tests/question_responses.sql`
- `supabase/tests/review_live_layout.sql`
- `supabase/tests/question_response_conditions.sql`
- `supabase/tests/question_response_types.sql`
- `supabase/tests/published_response_path.sql`
- `supabase/tests/questionnaire_publication_withdrawal.sql`
- `supabase/tests/questionnaire_locked_publication.sql`
- `supabase/tests/published_response_submissions.sql`

과거 스키마 전용 SQL 테스트·이전 스니펫은 현재 DB에서 일괄 실행하지 않는다. migration 삭제·재작성이나 운영 데이터 초기화로 테스트를 맞추지 않는다.

## 확인할 동작

- 질문·질문지 생성/수정과 재조회, 저장 충돌 시 입력 보존.
- 가이드 답변이 있는 항목 삭제·유형 변경, 질문·섹션 제거의 확인 및 취소.
- 질문지에서 질문을 제거하면 해당 질문지의 가이드 응답만 삭제되고 다른 질문지의 응답은 유지됨.
- 미처리 검토 요청의 배포 차단, 배포본·원본의 수정 잠금.
- 배포 응답이 없을 때 게시/수정 중으로 복귀하고 컨설턴트 목록에서 제외됨.
- 새 배치형 배포본의 입력·저장·제출. 저장은 본인 전용이고 리드·관리자는 마지막 제출 내용만 조회함.
- 제출 후 수정·저장은 기존 공개 답변을 유지하고 재제출할 때만 갱신됨.
- 단순 열람은 저장 이력이 생기지 않으며 가이드 게시 응답과 개인 배포 응답이 분리됨.
- 구형 배포 응답 저장 경로는 호환 유지.

- 진로 흐름 부분 제출(2026-10-02): 원본 `5f6064ad-1dd6-4e0d-95dd-611ccacbce92`는 활성 칸 하나의 유효 응답만으로 배포 답변 제출을 허용한다. 전체 공백은 거절하며 다른 질문의 모든 필드/최소 행 검사는 유지한다. `20261002083415_career_flow_partial_submission.sql` 로컬 적용·한 칸/빈 답변 롤백 검증·기존 배포 응답 회귀·보안 검사 통과. 운영은 사용자 적용 대기. 실제 브라우저 제출은 수행하지 않았다.

## 배포본 가이드 답변 공개 (2026-10-06)

`20261006023910_distributed_guide_answers.sql`은 로컬 적용 완료, 운영 미적용이다. `read_guide_answers`는 컨설턴트에게 활성 배포본에 포함된 질문의 게시 단계 가이드 답변만 반환한다. 게시만 된 질문·보관 배포본은 일반 컨설턴트에게 공개하지 않으며, 가이드 계정의 개인 배포 초안은 제외한다. 기존 리드·관리자의 게시본 조회와 가이드 작성 권한은 유지한다. 배포 응답 UI에서 가이드 조회를 활성화했으며 비공개 설명은 계속 숨긴다.

타입·변경 파일 린트·배포 응답 SQL 회귀(배포 공개/게시본 및 보관본 차단/비공개 초안 제외/미인증 차단)와 로컬 보안 검사를 통과했다. 실제 브라우저 검증·운영 쓰기는 수행하지 않았다.

위 ‘이후 DB 변경 적용 순서’대로 연결 대상·이력 확인 → dry-run → 적용 → 대기 없음 확인 → 앱 배포 → 컨설턴트의 가이드 답변 표시 확인을 진행한다. 이번 예상 파일은 `20261006023910_distributed_guide_answers.sql`이며 이전 미적용 파일이 추가로 나오면 이력을 검토한 뒤 진행한다.

## 가이드 첨부 탐구활동 읽기 (2026-10-06)

`20261006031716_guide_exploration_reference_read.sql` 로컬 적용 완료, 운영 미적용. 선행 `20261006023910_distributed_guide_answers.sql`이 필요하다. 열람 가능한 최신 가이드 응답의 활성 행에 실제 explorationReference 마크로 연결된 활동만 공유한다. 활동의 최신 확정본과 등록된 보고서만 읽으며 삭제 활동·미첨부 객체·다른 활동·가이드 개인 배포 초안은 공유하지 않는다. 참조 제거 시 새 열람도 차단한다(이미 발급된 파일 URL은 기존 60초 만료까지 유효). 수정/삭제 권한은 소유자 정책 그대로다. 일반 목록과 첨부 선택기는 본인 목록을 유지하며 참조 클릭 조회만 특정 ID로 요청한다.

배포 SQL 회귀 및 기존 exploration_activity_storage 회귀, 타입·린트·보안 advisor 통과. 실제 브라우저 검증과 운영 적용은 수행하지 않았다. 위 운영 절차에서 예상 대기 파일과 대상 `epwlcallocdjkmgdmtlv`를 확인하고 DB 적용 → 대기 없음 확인 → 앱 배포 → 일반 컨설턴트의 가이드 첨부·보고서 열람 확인 순서로 진행한다.

## 학습법 관리·질문 참조 (2026-10-10)

`20261010055936_study_methods.sql` 로컬 적용·검증 완료, 운영 미적용. `study` 테이블과 저장/삭제 RPC, `study-reports` 비공개 버킷, 역할·가이드 참조 RLS, 질문의 `studyRecommended` 및 `kind: study` 검증을 추가한다. 기존 데이터는 변경하지 않는다. 기존 migration을 모두 적용했다면 예상 대기는 이 파일 하나다. 실행 명령·확인 순서는 [학습법 운영 적용](../study/operations.md)을 따른다.

학습법 입력 구성 후속 수정: `20261010061957_study_problem_sources.sql` 로컬 적용. 과목 분류의 기타·선택 과목명, 필수 문제 상황 출처(self/student)를 저장한다. 이전 학습법 migration 이후 적용하며 기존 데이터는 삭제하지 않는다. 최신 적용 순서는 [학습법 운영 적용](../study/operations.md)을 따른다.

학습법 문제 상황 템플릿 활성화: `20261010072805_study_problem_templates.sql` 로컬 적용. `problemSource=template` 저장을 허용하며 16개 대표 문장을 선택하면 문제 상황 본문에 입력하고 수정할 수 있다. 앞선 학습법 migration 이후 적용하며 운영 절차는 [학습법 운영 적용](../study/operations.md)을 따른다.

학습법 선택 제목: `20261010083351_study_optional_title.sql` 로컬 적용. 선택 제목/이름(100자)을 저장하고 없으면 기존 학습 전략을 표시한다. 운영 반영 순서는 [학습법 운영 적용](../study/operations.md)을 따른다. 운영 미적용.

## 표형 응답 제작 (2026-10-11)

`20261011143258_question_answer_layouts.sql`은 일반 표/흐름표 표시 설정과 초기 표시 행 수, 열별 필수 여부를 저장한다. 최소 작성 행/시기 수를 검사하고 빈 여분 행은 제출 필수에서 제외한다. 흐름표의 공개 제출에는 빈 시기 자리를 유지하며 비활성 답변 내용은 공개하지 않는다. 기존 권한·배포 잠금·저장 충돌·재시도와 기존 카드/진로 흐름 계약은 유지한다.

2026-10-12 사용자의 승인에 따라 에이전트가 운영에 이 migration 한 개를 영구 적용했다. 운영 함수 정의의 치환 기준 10개가 모두 일치하고 활성 트리거·이벤트 트리거에 외부 웹훅이 없음을 먼저 확인했다. 임시 migration과 신규 `question_answer_layouts.sql` 회귀를 한 트랜잭션에서 수행·롤백한 뒤, `db push`로 적용하고 적용 후에도 신규 SQL 회귀를 성공·롤백했다. 회귀 SQL의 CASE 문법을 수정한 뒤 예행 검증과 적용 후 검증을 모두 통과했다.

최신 운영 이력은 `20261011143258_question_answer_layouts`이며 적용 후 dry-run에 대기가 없다. 운영 가이드 함수 해시 `607716af71009f7941df8fef56b2e443`는 검증과 적용 전후 동일하게 유지됐다. 보안 advisor 경고는 전후 모두 기존 4개이며 새 경고는 없다. 이 해시는 이번 검증 기록이며 다음 작업에서는 사전 조회에서 읽은 값을 사용한다.

앱 타입 검사·변경 파일 린트·관련 JS 회귀 29개·Webpack 빌드는 통과했다. 로컬 Docker/Podman과 PostgreSQL이 없는 실행 환경이므로 **로컬 migration 적용과 SQL 회귀는 미실행**이다. 실제 브라우저 테스트는 하지 않았으며 앱 배포·실사용 기능 확인은 별도 단계다. 로컬 DB가 있는 개발 환경에서 재현하려면 다음을 수행한다. `supabase start`만으로 앱 환경 변수는 바뀌지 않으므로 [로컬 연결](../local-supabase.md)을 확인한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
npx supabase start
npx supabase migration list --local
npx supabase db push --local --dry-run --skip-vault
npx supabase db push --local --skip-vault
docker exec -i supabase_db_system psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/question_answer_layouts.sql
```

새 SQL 회귀는 전체 트랜잭션을 롤백하며 가상 계정과 질문지·응답만 사용한다. 기존 `distributed_response_submissions.sql`·`question_responses.sql`·`question_response_conditions.sql`도 운영에서 순차 실행·롤백하여 모두 통과했고, 매번 운영 가이드 함수 해시 원복을 확인했다. `question_responses.sql`의 배포 전 가이드 조회 검사는 현행 정책에 맞춰 RPC 거절 대신 빈 객체 반환을 검사하도록 수정했다. 로컬 DB가 없는 이번 환경에서는 이를 로컬 검증 통과로 간주하지 않는다.

일반 운영 적용 순서는 프로젝트 경로 이동 → 연결 대상·이력 확인 → dry-run/예상 파일 확인 → 실제 적용 → 대기 없음 확인 → 앱 배포 → 기능 확인이다. 이번 DB 적용은 완료됐으므로 아래 명령으로 대기 없음만 다시 확인하고 이미 적용한 파일을 재실행하지 않는다.

```bash
cd /Users/mealdm/Desktop/MEA/system
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
# 현재 예상 대기는 없음. 새로운 대기 파일이 나오면 적용 전에 이력을 검토한다.
```

위 명령은 운영 대상을 `--project-ref`로 명시하므로 연결 파일이 없어도 같은 대상을 조회한다. 예상과 다른 대기가 나오면 그 파일의 검증 결과와 선행 순서를 확인한 뒤 적용 여부를 판단한다. 대기가 없음을 확인한 뒤 기존 방식으로 앱을 배포한다. 일반 표의 최소 5행 렌더·행 추가·필수 열/선택 열·빈 여분 행 제외·저장 후 재조회와 흐름표의 시기 이름/빈 시기 위치·부분 제출·읽기 전용 제출 조회를 확인한다. 기존 2주차 질문지를 새 형식으로 자동 변경하지 않는다.

### 운영 DB 롤백 검증

사용자가 운영 DB의 롤백 검증과 테스트 성공 후 영구 적용을 승인했다. 실제 운영 답변을 시험 데이터로 쓰지 않고, 사전 catalog 조회 → 임시 migration과 신규 회귀 시험·롤백 → 영구 적용 → 적용 후 신규 회귀·롤백 → 적용 대기 없음 확인 순서로 완료했다. 과거 `limit=0` API 조회에서 열이 없었던 결과는 적용 전 상태이며 현재 상태가 아니다.

`scripts/prepare-question-grid-production-check.mjs`는 DB에 접속하지 않고 다음 파일을 생성한다.

- `preflight.sql`: 운영 이력·설정 열·활성 트리거·이벤트 트리거·관련 함수·가이드 함수 해시를 읽는 사전 조회.
- `compatibility.sql`: migration 적용 전 함수 치환 기준 10개가 일치하는지 확인하는 조회.
- `migration-trial.sql`: 미적용 DB에서 임시 migration과 신규 회귀를 한 트랜잭션으로 실행·롤백한 뒤 열·이력 부재와 원래 가이드 함수 해시 복구를 확인하는 시험.
- `regression.sql`: 영구 적용 후 신규 회귀를 한 트랜잭션으로 실행·롤백하는 검증.

먼저 사전 조회에서 운영 트리거·이벤트 트리거와 Realtime 함수 정의를 검토하여 외부 웹훅 등 트랜잭션 밖 부작용이 없는지 확인한다. `migration-trial.sql` 생성에는 그 조회의 `guideFunctionHash`를 세 번째 인수로 전달한다. 이후 가상 계정/질문지/응답과 테스트 가이드 함수 변경을 한 SQL 요청에서 수행하고 모두 롤백한다. 짧은 잠금/실행 시간 제한을 사용하며 시험 중 질문 저장이 잠시 대기할 수 있다. 적용 후에는 치환 대상 원문이 달라지므로 적용 전 compatibility 결과를 요구하거나 `migration-trial.sql`을 다시 실행하지 않는다.

```bash
cd /Users/mealdm/Desktop/MEA/system
npx supabase login
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
node scripts/prepare-question-grid-production-check.mjs
npx supabase db query --linked --project-ref epwlcallocdjkmgdmtlv --file /private/tmp/mea-question-grid-production-check/preflight.sql
# 아래 임시 시험 관련 명령과 영구 적용은 migration이 미적용일 때만 실행한다.
# 사전 조회 결과와 예상 대기 파일을 검토하고 현재 가이드 함수 해시를 전달한다.
GRID_GUIDE_FUNCTION_HASH='<preflight의 guideFunctionHash>'
node scripts/prepare-question-grid-production-check.mjs /private/tmp/mea-question-grid-production-check "$GRID_GUIDE_FUNCTION_HASH"
npx supabase db query --linked --project-ref epwlcallocdjkmgdmtlv --file /private/tmp/mea-question-grid-production-check/compatibility.sql
npx supabase db query --linked --project-ref epwlcallocdjkmgdmtlv --file /private/tmp/mea-question-grid-production-check/migration-trial.sql
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault
# 영구 적용 확인 후 신규 회귀를 실행하고 대기 없음과 가이드 함수 보존을 확인한다.
npx supabase db query --linked --project-ref epwlcallocdjkmgdmtlv --file /private/tmp/mea-question-grid-production-check/regression.sql
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
npx supabase db query --linked --project-ref epwlcallocdjkmgdmtlv --file /private/tmp/mea-question-grid-production-check/preflight.sql
```

회귀 파일은 누락된 설정 열·함수를 가상 데이터 생성 전에 차단한다. 파일 전체를 한 요청/연결에서 실행해야 하며 BEGIN/시험/ROLLBACK을 별도 API 요청으로 나누지 않는다. 실제 실행 오류가 발생하면 같은 연결의 트랜잭션을 롤백하거나 연결을 종료하고 성공 표시를 확인할 때만 통과로 기록한다. 생성기 린트·트랜잭션 경계 검사와 이번 운영 임시 시험·적용 후 신규 회귀는 통과했다. 운영 가이드 함수와 기존 운영 답변을 검증 목적으로 영구 변경하지 않았다.


## 배포본 검토 요청 조회 (2026-10-12)

`20261012011802_distributed_question_review_visibility.sql` 로컬 적용 완료, 운영 미적용. `can_read_question_reviews`는 활성 게시본뿐 아니라 배포본에 포함된 질문도 다른 리드에게 공유한다. 요청 작성은 게시 중만 허용하며 처리 권한은 원본 작성자/관리자로 유지한다. 일반 컨설턴트와 보관본만 남은 질문에 대한 무관한 리드 조회는 차단한다. 배포 응답 SQL 회귀(RPC/RLS 조회, 작성·처리 불가, 일반 컨설턴트 및 보관 후 차단), 보안 advisor 통과. 로컬 적용 대기 없음 확인. 브라우저 테스트 및 운영 적용은 수행하지 않았다.

위 운영 적용 순서대로 연결 대상 `epwlcallocdjkmgdmtlv`·이력 확인 → dry-run에서 예상 migration 확인 → 적용 → 대기 없음 재확인 → 앱 배포 → 다른 리드의 배포본 검토 요청 조회 확인을 진행한다. 이번 예상 파일 외 이전 미적용 파일이 나오면 먼저 이력을 검토한다.

## 게시 질문지 공동 편집 (2026-10-12)

`20261012050042_published_questionnaire_collaboration.sql`은 로컬 적용 완료이며 운영 적용은 수행하지 않았다. 다른 컨설턴트 리드·관리자도 활성 게시 질문지의 제목·배치와 포함된 원본 질문의 내용·답변 설정·설명을 수정한다. 원본 작성자는 유지되고 공유 원본 변경은 다른 질문지에도 반영된다. 비공개 초안·삭제·상태 변경 권한은 유지하며 다른 배포본에서 사용하는 원본은 계속 잠긴다. 독립 질문 목록은 기존 작성자 필터를 유지한다. 가이드 응답 삭제 확인도 동일하게 적용한다.

로컬 리드 테스트 계정은 `node scripts/create-local-consultant.mjs --lead`로 생성/확인한다. localhost 연결만 허용하며 자격 증명은 Git 제외 파일 `.env.local-consultant-lead.json`에 저장된다. 운영에서는 실행하지 않는다.

타입 검사·변경 파일 린트·공동 편집 SQL·가이드 필드 변경/질문 제거 SQL·로컬 security advisor 통과, 로컬 migration 대기 없음. SQL 가상 데이터는 롤백했다. 실제 브라우저 테스트는 수행하지 않았다.

운영은 다음 순서로 적용한다. 다른 컴퓨터에서는 첫 경로를 실제 프로젝트 경로로 바꾼다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

연결 대상이 `epwlcallocdjkmgdmtlv`인지 확인한다. 이번 예상 파일은 `20261012050042_published_questionnaire_collaboration.sql`이다. 다른 미적용 migration이 나오면 먼저 이력을 검토한 뒤 적용한다. 치환 대상 함수 정의가 예상과 다르면 migration이 중단되므로 강제로 이력을 맞추지 않는다.

```bash
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

대기 없음 확인 후 앱을 배포한다. 다른 리드 계정으로 게시 질문지 제목·배치·원본·설명 저장을 확인하고 비공개 초안과 배포 원본은 수정할 수 없는지 확인한다.

## 재사용 학습법 등록 안내 카드 (2026-10-12)

예상 migration은 `20261012050319_study_registration_cards.sql` 한 개다. 현재 운영에는 이미 적용했으므로 남은 작업은 앱 배포와 화면 확인이다. 적용 전 `prepare-study-registration-check.mjs`가 만든 임시 migration+회귀를 한 트랜잭션에서 실행하고 모두 롤백했다. 기존 질문/응답/세션/제출/학습법 데이터 hash, 변경 함수 ACL과 가이드 함수 hash 보존을 확인했다. 적용 후 신규 등록 카드 SQL와 조건 해제 SQL도 가상 데이터만으로 통과·롤백했고, 보안 진단은 기존 경고 4개로 동일했다. 타입·변경 파일 린트·등록/응답/학습법 JS 회귀 78개·Webpack 빌드 통과, 로컬 DB 전용 migration 검증은 Docker가 없어 미실행이다. 실제 브라우저 검증과 앱 배포는 아직 하지 않았다.

변경 대상은 `questions.purpose`·`button_label`, 목적별 빈 답변 설정, 원본 저장/조회와 게시·배포 답변 저장의 안내 metadata 처리다. 기존 RLS·권한·배포 잠금·GUID 가이드 지정은 유지하며 학습법 저장 함수는 변경하지 않는다. 빈 응답 metadata는 표시용이고 카드에 답변을 입력할 수 없다. 안내-only 완료는 거절하며 일반 답변의 필수 검사와 제출 수는 유지한다.

적용 또는 확인 순서는 프로젝트 이동 → 운영 대상/이력 확인 → dry-run의 예상 파일 확인 → 실제 적용 → 대기 없음 재확인 → 앱 배포 → 기능 확인이다. 현재 환경에서 앞의 DB 단계는 완료됐으며 아래 명령은 재현·확인용이다. 예상 외 migration이 나오면 먼저 이력을 검토하고 `migration repair`나 재적용으로 우회하지 않는다.

```bash
cd /Users/mealdm/Desktop/MEA/system
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault --dry-run
# 최초 적용 시 예상: 20261012050319_study_registration_cards.sql 한 개
# 현재 운영은 이미 적용되어 대기 없음
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault --dry-run
```

앱 배포 후 새 카드의 종류를 `학습법 등록 안내`로 선택해 제목·본문·버튼 이름을 저장하고 질문지의 원하는 위치에 배치한다. 버튼이 본인 학습법 등록 화면을 열고, 확정한 학습법이 학습법 관리에 저장되는지 확인한다. 등록 중 질문 답변 작성 상태가 바뀌지 않는지, 일반 답변 제출이 정상인지, 제출 열람의 등록 버튼이 비활성인지 확인한다. 특정 2주차 질문지나 실제 사용자 학습법 데이터는 이 작업에서 수정·생성하지 않았다.

## 흐름표 중간 시기 추가 (2026-10-13)

`20261013033907_question_flow_insertions.sql`을 운영 `epwlcallocdjkmgdmtlv`에 적용했다. 최신 이력에 같은 번호가 있으며 적용 후 dry-run 대기는 없다. 공통 제작기의 `flowInsertAfter`/DB `flow_insert_after`에 기본 시기 뒤 추가 허용 위치를 저장한다. 응답 행의 `flowIndex`/`flowAfter`/`label`로 기본·추가 시기 위치와 이름을 보존하고, 기본 시기와 추가 시기를 합쳐 20개로 제한한다. 기존 저장 ID·원본 작성자·RLS·배포 잠금·가이드 계정은 유지한다. 저장 metadata가 있는 원본은 기본 시기 수/표 형식 변경을 막고, 추가 허용 위치를 해제해도 이미 저장된 추가 시기를 편집·삭제할 수 있다.

적용 전 함수 치환 기준 13개와 질문 테이블 직접 UPDATE 권한 부재·외부 호출 함수 부재를 확인했다. 임시 migration+신규 `question_flow_insertions.sql` 회귀를 한 트랜잭션으로 실행·롤백했고, 적용 후에도 회귀를 다시 실행·롤백했다. 두 검사 모두 기존 질문/응답/세션/제출/학습법 데이터 hash와 여섯 변경 함수의 소유자·ACL 보존을 확인했다. 운영 가이드 함수 해시 `607716af71009f7941df8fef56b2e443`는 전후 동일하다. 검증용으로 가이드 함수나 실제 사용자 프로필을 바꾸지 않았다. 보안 advisor는 기존 경고 4개로 같고 새 경고가 없다.

타입 검사·변경 파일 린트·관련 JS 회귀 115개·Webpack 빌드가 통과했다. 실제 Preview/Grid 버튼·이름 입력·삭제 확인 콜백은 브라우저 없는 회귀로 검증했다. 아직 저장하지 않은 흐름표와 원격 기본 시기 수/표 형식 변경이 충돌하면 기존 화면과 입력을 유지하고 복사 후 다시 열도록 안내한다. main의 공동 편집 정책과 불일치하던 기존 로더 테스트 기대도 현행 정책으로 갱신했다. 로컬 DB 엔진 부재로 로컬 migration/SQL 검증은 미실행이며, **실제 브라우저 검증과 앱 배포는 수행하지 않았다.**

`node scripts/prepare-flow-insertion-check.mjs`는 DB에 접속하지 않고 `/private/tmp/mea-flow-insertion-check`에 `preflight.sql`, `migration-trial.sql`, `regression.sql`, 파일 hash manifest를 만든다. 임시 migration은 미적용 환경에서만 실행하고, 적용 후에는 `regression.sql`만 실행한다. 회귀는 가상 계정·질문지·답변만 사용하며 모든 fixture를 롤백한다. 전체 SQL 파일을 한 요청/연결에서 실행해야 한다.

적용 순서는 프로젝트 이동 → 운영 대상·이력 확인 → dry-run에서 예상 파일 확인 → 실제 적용 → 대기 없음 재확인 → 앱 배포 → 기능 확인이다. **이번 운영 DB 단계는 완료됐으므로 재적용할 필요가 없다.** 아래 적용 명령은 아직 적용하지 않은 별도 환경에서만 사용한다. 예상과 다른 migration이 나오면 실제 적용 전에 이력을 검토한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
# 최초 적용 예상: 20261013033907_question_flow_insertions.sql 한 개
# 현재 운영 예상: 대기 없음
# 미적용 환경에서만 실제 적용
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
```

이후 앱을 배포하고 제작 화면에서 기본 시기 다음의 `시기 추가 허용`을 설정한다. 응답 화면의 해당 +에서 이름 있는 시기를 추가한 뒤 저장·재열기·제출 시 기존 시기와 답변이 유지되는지 확인한다. 추가 시기 삭제 확인, 빈 이름의 작성 시기 제출 안내, 최소 작성 시기 수와 20개 제한도 확인한다. 이번 작업에서 실제 2주차 질문지의 내용이나 배포 상태를 바꾸지는 않았다.


## 배포본 작성자 이름 (2026-10-14)

`20261014064007_distributed_questionnaire_authors.sql` 로컬 적용 완료. `supabase/tests/questionnaire_author_names.sql`은 관리자/리드 조회, 게시·배포 포함, 초안·보관 제외, 컨설턴트/미인증 거절을 검증하고 가상 데이터를 롤백한다. 운영 미적용. 전체 개선 완료 후 아래 순서로 진행한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

이번 작업의 추가 파일은 `20261014064007_distributed_questionnaire_authors.sql` 하나다. 다른 대기 파일이 있으면 기존 개선 작업의 적용 계획과 이력을 먼저 검토하고, 예상 목록을 확인한 뒤 진행한다.

```bash
npx supabase db push --linked
npx supabase db push --linked --dry-run
```

적용 대기 없음 확인 후 기존 앱 배포 절차로 배포하고 다른 작성자의 배포 질문지 이름이 표시되는지 확인한다. 지금은 운영 적용·앱 배포를 실행하지 않는다.

## 진로 흐름·제출 항목 이름 보존 (2026-10-14)

`20261014075610_submitted_named_row_labels.sql` 로컬 적용 완료. 제출 함수의 투영만 좁게 교체하고 소유자·ACL·RLS·작성 요청 검증을 유지한다. 이름 있는 비흐름표의 제출 label을 보존하며 안전 조건을 충족하는 기존 제출본만 이름을 보정한다. 운영 적용·앱 배포·실제 브라우저 테스트는 수행하지 않았다.

검증: 타입 검사, 변경 파일 린트, `verify-question-row-labels.mjs`(중복 이름/추가 이름/음수 ID/압축된 구형 행/읽기 조작), `verify-submitted-response-export.mjs`(PDF 이름), 기존 흐름표 관련 JS. SQL은 `submitted_named_row_labels.sql`, `distributed_response_submissions.sql`, `question_answer_layouts.sql`, `question_flow_insertions.sql` 4개를 로컬에서 통과했으며 가상 테스트 데이터는 전부 롤백했다. 새 회귀는 제출 이름·빈 행 제외·작성 행 격리·기존 제출 시각 보존·후속 비공개 수정이 있는 제출본의 미보정을 검사한다.

### 로컬 가이드 참조 비교 예시

질문지 ID `083b8553-9dff-4479-90f4-c22859d5c70b`, 제목 `[로컬 UI 확인] 모든 답변 유형`의 첫 번째 서술형/일곱 번째 탐구활동 참조형에 가이드 답변 두 개를 추가했다. 같은 `[로컬 예시] 교실 환기 방식에 따른 이산화탄소 농도 변화` 활동을 참조한다. 일반 컨설턴트 또는 리드의 미리보기에서 가이드 답변을 펼쳐 본문 링크는 상세를 열 수 있지만 참조형은 문구만 표시하는 문제를 비교한다. 실제 UI 클릭 확인은 사용자가 진행한다. DB 가이드 조회에서 두 답변과 참조 ID가 반환되는 것은 확인했다.

위 비교 예시는 당시 로컬에서 생성했다. 이후 사용자 확인에 따라 두 독립 첨부형을 제거하고 기존 예시 질문/가이드/제출본도 본문 참조로 전환했다. 폐기 유형을 다시 만드는 일회성 예시 스크립트는 제거했다.

### 전체 개선 완료 후 운영 적용 순서

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 이번 관련 예상 파일:
# 20261014064007_distributed_questionnaire_authors.sql
# 20261014075610_submitted_named_row_labels.sql
# 다른 대기 파일이 보이면 적용 전에 전체 개선 계획 및 이력과 대조한다.
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

연결 대상이 운영 `epwlcallocdjkmgdmtlv`인지 먼저 확인하고 예상과 다른 이력이면 중단하여 검토한다. 대기 없음 확인 후 기존 절차로 앱 배포 → 진로 흐름 작성·새로 열기·제출 → 중간 빈 항목의 이름과 PDF 일치 → 같은 이름의 가이드 두 행이 다른 내용을 유지하는지 확인한다. 안전하게 보정할 수 없는 옛 제출본은 이름 미확인 표시가 남을 수 있다. 전체 개선 완료 전에는 운영 적용하지 않는다.

## 독립 첨부형 제거와 본문 참조 전환 (2026-10-14)

- `20261014081939_retire_question_attachment_types.sql`: 새 첨부형 생성 금지의 중간 단계.
- `20261014082243_convert_question_attachments_to_mentions.sql`: 기존 필드·답변을 text/본문 mark로 전환하고 중간 호환 트리거를 제거, 검증기를 네 유형으로 제한한다. 두 파일 모두 로컬 적용 완료. 운영 적용·앱 배포·실제 브라우저 검증은 미수행이다.
- 운영/로컬 `2주차: 학습전략`에 첨부형 없음 확인. 로컬 전환 대상 질문 3개, 작성/가이드 응답 3개, 제출 사본 1개, 재시도 payload 1개. 각 원본 UUID·행 이름/ID·다른 내용·제출 시각 보존을 롤백 시험으로 확인했다. 실제 전환 뒤 폐기 필드 0개다. 운영에는 미배치 탐구활동 첨부형 원본 1개를 읽기 전용으로 확인했으며 쓰지 않았다.
- 전환 회귀는 **전환 직전 스키마**에서만 실행한다. `node scripts/question-attachment-conversion-test-sql.mjs`가 migration의 begin/commit을 제거하여 `supabase/tests/question_attachment_conversion.sql`의 rollback-only 트랜잭션에 삽입한 SQL을 출력한다. 출력 SQL을 로컬 psql에서 실행한다. 이미 적용된 환경에서 재적용하지 않는다. 잘못된 UUID는 중단하며 원본을 임의 삭제하지 않는다.
- 적용 후 SQL: `question_attachment_retirement.sql`, `study_guide_reference.sql`, `question_exploration_type.sql`, `question_study_type.sql`, `distributed_response_submissions.sql`, `question_answer_layouts.sql`, `question_flow_insertions.sql` 로컬 통과. 가상 데이터 전부 롤백. 기존 type 회귀 두 개는 참조 권장 text의 저장/재시도 회귀로 갱신했다. 본문 학습법 가이드 접근·삭제 후 권한 회수·익명 차단을 확인했다. 보안 advisor 경고/오류 없음.

전체 개선 완료 후 실행 순서:

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 이번 관련 예상 파일 4개:
# 20261014064007_distributed_questionnaire_authors.sql
# 20261014075610_submitted_named_row_labels.sql
# 20261014081939_retire_question_attachment_types.sql
# 20261014082243_convert_question_attachments_to_mentions.sql
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

운영 대상 `epwlcallocdjkmgdmtlv` 및 이전 이력을 확인한다. 예상과 다른 대기가 있으면 적용 전에 검토하며 include-all/reset/repair로 우회하지 않는다. 변환 실패 시 트랜잭션 전체 롤백 후 원인을 확인한다. DB 적용 완료·대기 없음 확인 → 앱 배포 → 기존 가이드/제출의 참조 링크 및 권한, 새 질문의 네 유형, 진로 흐름 필수 입력 배경 확인 순서다. 이전 앱을 계속 사용하지 않도록 전환 시 작성 화면을 닫고 배포 후 새로 고침한다.

최종 앱 검증: 타입 검사·변경 파일 린트·관련 JS 31개·Webpack 프로덕션 빌드 통과. 브라우저 테스트는 요청에 따라 실행하지 않았다.

## 질문지 시작 안내 분리 (2026-10-15, 로컬 적용)

- Migration: `20261015034458_questionnaire_start_notice.sql`.
- 로컬의 2주차 학습전략 안내 1개를 `questionnaires.start_notice`로 이전했다. 기존 source `096d2cd2-66f5-47f8-9faf-2f3e63ee4059`는 보관, placement `03fd9674-fd4c-4f6d-a7a1-78ed7bf6a933`와 안내만 있던 섹션은 제거했다. 실제 질문 15개는 동일 ID로 유지한다.
- 원문/버튼/질문지 ID·배포 상태·배포 시각 유지. 등록 강제 없음. 시작 안내는 현재 일반 UI에서 수정하지 않는 질문지 설정이다.
- 사전 시험: `node scripts/prepare-questionnaire-start-notice-check.mjs > /tmp/start-notice-check.sql`이 만드는 SQL은 **이 migration 적용 전 DB** 전용이다. 이전+보존 회귀를 실행하고 전체 롤백한다. 이미 적용된 DB에서 다시 실행하지 않는다.
- 실제 로컬 데이터 기준 다른 질문 44개, 작업 응답 72개, 최종 제출본 3개가 이전 전후 완전히 같음을 확인했다. 안내 원문 일치·기존 보호 트리거 복구 확인 후 `supabase migration up --local`로 해당 파일 하나를 적용했다.
- 적용 후 `supabase/tests/questionnaire_start_notice_access.sql`은 가상 컨설턴트의 안내 조회/응답 시작/15개 질문 보존, 일반 컨설턴트 작성 거부와 리드의 폐기 유형 생성 거부를 확인하고 롤백한다. `distributed_response_submissions.sql` 회귀 통과. 로컬 security advisor 경고·오류 없음.
- 최초 버전은 세션/응답/제출 이력 자체를 차단했다. 이후 최종 사전 점검에서 기존 이력을 보존하는 이전으로 보완했으며 위 최신 절을 따른다. 실제 안내 답변·설명·중복 안내·예상 밖 연결은 계속 중단한다. 검사를 우회하지 않는다.
- 운영 조회·쓰기 및 실제 브라우저 테스트·앱 배포는 이번 작업에서 하지 않았다. 기존 운영 적용 대기 목록에 이번 파일을 추가한다. 이전 기록 기준 예상 대기는 `20261014064007`, `20261014075610`, `20261014081939`, `20261014082243`, `20261015034458`이며 실제 이력을 반드시 우선 확인한다.

전체 UI 개선 완료 후 운영 반영 순서:

1. `cd /Users/mealdm/Desktop/MEA/system`
2. `cat supabase/.temp/project-ref`, `npx supabase migration list --linked`로 운영 대상·이력 확인.
3. `npx supabase db push --linked --dry-run`으로 위 예상 대기 파일 확인. 다르면 적용 전 이력 검토.
4. `npx supabase db push --linked` 실행. 시작 안내 검사 실패 시 중단하고 별도 검토.
5. `npx supabase migration list --linked`, `npx supabase db push --linked --dry-run`으로 대기 없음 확인.
6. 앱 배포 후 질문 제작에 카드 종류가 없는지, 2주차 상단 안내/학습법 등록/일반 응답 저장·제출/제출본 조회 확인.

검증 완료: 타입 검사·변경 파일 린트·관련 JS 44개 통과. 새 시작 안내 조회 schema 보존 및 일반 저장 payload 제외, 번호 없는 렌더링과 기존 학습법 등록 액션을 검증했다. 실제 브라우저 테스트는 수행하지 않았다.

## 질문 조회 집계·편집기 책임 분리 (2026-10-15)

- Migration: `20261015051602_question_read_models.sql`.
- 로컬 Postgres에 조회 RPC 두 개와 조건 GIN 인덱스를 적용하고 `db pull --local`로 migration을 생성했다. CLI 출력의 `remoteHistoryUpdated`는 이 명령에서 선택한 **로컬 DB** 이력 기록이다. 운영 DB는 조회·수정하지 않았다.
- 로컬 `migration list --local`과 `db push --local --dry-run`으로 적용 이력·대기 없음 확인. 기존 질문·설명·응답 데이터 변경 없음.
- SQL `supabase/tests/question_read_models.sql`: 가상 계정/질문/요청을 만들고 1,005건 정확한 집계·읽음 제외·처리 완료 제외·역참조 중복 제거·비공개 질문 차단·관리자/리드/컨설턴트/anon·잘못된 배열 검사를 수행하고 전부 롤백한다.
- JS: `verify-question-drawer`, `verify-question-pagination-api`, `verify-question-save-errors`, `verify-question-usage`, `verify-question-review-counts`, `verify-questionnaire-question-types`, `verify-questionnaire-drawer` 총 68개 통과. 테스트는 분리된 실제 모듈을 로드하고 네트워크/인증 경계만 대체한다.
- 타입 검사·변경 파일 린트·Webpack 프로덕션 빌드 통과. 로컬 security advisor 경고·오류 없음. 실제 브라우저 테스트와 운영 앱 배포는 미수행. 제출 검증은 변경하지 않았다.

전체 UI 개선 완료 후 운영 반영 시 다음 순서를 사용한다. 현재 작업에서 실행하지 않는다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 예상 migration 목록을 확인한 뒤에만 실행
npx supabase db push --linked
npx supabase db push --linked --dry-run
```

이번에 추가한 예상 파일은 `20261015051602_question_read_models.sql`이다. 앞선 로컬 전용 migration이 아직 운영에 없다면 함께 표시되므로 이 문서의 이전 절과 적용 이력을 먼저 대조한다. 예상하지 않은 파일이 있으면 적용 전에 이력을 검토하고 임의 repair/reset하지 않는다. 마지막 dry-run에서 대기가 없음을 확인한 뒤 앱을 배포한다. 배포 후 질문 목록의 검토 요청 수/참조 관계·질문 생성/수정/설명 저장·가이드 확인·자동 저장·닫기/재열기·권한별 목록을 확인한다. DB 함수가 먼저 준비되어야 앱의 새 집계 경로가 동작한다.

### 설명 항목 정리 검증 (2026-10-15)

- 설명 표시/현재 공통 schema/구형 로컬 초안 호환을 정리했다. 신규 migration이나 운영 데이터 변경은 없다.
- `scripts/verify-question-details.mjs`: 빈 일반/서식 본문 숨김, 제목만/본문만 있는 설명 유지, 현재 길이 제한과 구형 초안 읽기 호환 검증.
- `supabase/tests/question_details.sql`: 공개 설정·순서 변경·동일 저장 재시도·오래된 revision 저장 거절 후 원본/설명 보존 검사 추가.
- `supabase/tests/questionnaire_locked_distribution.sql`: 배포 후 설명 공개 설정·표시 순서 변경 차단 검사 추가. 기존 공개 설명 조회/비공개 제외 검사도 함께 통과.
- 두 SQL 파일은 로컬에서 가상 데이터로 실행하고 전체 롤백했다. 관련 JS 회귀 54개 통과. 실제 브라우저 테스트·운영 적용은 수행하지 않았다.

- 이번 설명 항목 정리의 타입 검사·변경 파일 린트도 통과했다.

### 검토 요청 조회·갱신 분리 (2026-10-15)

- 신규 migration: `20261015054101_question_review_paged_reads.sql`. 로컬 적용·이력 생성 완료. 요청/읽음 데이터 변경 없음. 새 조회 함수·완료 이력 partial index 및 기존 집계 함수 2개의 anon 실행 권한 명시적 회수를 포함한다.
- `supabase/tests/question_review_pages.sql`: 실제 역할별 등록, 23개 완료/2개 미처리 분리, 10/10/3 페이지·동률 정렬 중복 방지, 출처 권한, 일괄 읽음, 잘못된 페이지, consultant/anon 거절 검증.
- 기존 `question_review_requests.sql`과 함께 로컬 실행·가상 데이터 전체 롤백 완료. DB security advisor 경고/오류 없음. 기존 요청/처리 함수의 권한·출처 삭제 보존 계약은 유지한다.
- JS 검증: `scripts/verify-question-reviews.mjs`의 API/훅/재시도/읽음/이력 10개와 기존 집계·질문지 저장·질문 편집 회귀를 함께 실행한다. 브라우저 테스트·운영 DB 조회/반영·앱 배포는 수행하지 않았다.

운영은 전체 개선 작업 종료 시 다음 순서로 적용한다. 이번에 추가한 파일은 위 1개이며, 이전 작업의 운영 미적용 migration이 함께 표시될 수 있으므로 기존 운영 절차·이력과 대조한다. 예상과 다른 파일은 적용 전에 검토한다. `docs/local-supabase.md`의 이력 차이를 먼저 확인하고 무조건 push/reset/repair하지 않는다.

```sh
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 연결 대상·대기 파일 확인 후에만 실행
npx supabase db push --linked
npx supabase db push --linked --dry-run
```

적용 대기 없음 확인 → 앱 배포 → 요청 등록/처리/읽음, 완료 이력 더 보기, 출처별 권한 및 갱신 실패 안내를 확인한다. 새 앱은 새 페이지 RPC가 필요하므로 DB 적용 후 배포한다.

- 최종 검증: 관련 JS 47개·타입 검사·변경 파일 린트·Webpack 빌드 통과. 로컬 migration dry-run은 적용 대기 없음으로 확인했다.


### 질문 내용 불러오기·질문 귀속 검토 (2026-10-15)

- 신규 migration: `20261015055947_question_owned_reviews.sql`. 로컬 DB에 함수 변경을 적용한 뒤 `db pull question_owned_reviews --local --yes`로 생성·이력 기록했다. CLI의 remoteHistoryUpdated 문구는 이 명령의 로컬 DB 이력이다. 운영 조회/변경 없음.
- 기존 요청·읽음·처리·질문·응답 데이터는 수정하지 않았다. 기존 출처 ID는 보존한다. 신규 요청은 출처 없이 생성하고 출처 인자는 권한/재시도에서 제외한다. 이전 단계 페이지 조회 RPC의 anon 실행 권한 명시적 회수도 생성 파일에 포함하여 현재 로컬 ACL과 재생 결과를 일치시킨다.
- `question_review_requests.sql`: 질문지 작성자가 타인의 질문에 요청 가능, 원본 작성자/일반 컨설턴트 요청 차단, 출처가 다른 재시도 중복 방지, 새 출처 NULL, 과거 출처 보존·질문지 삭제 후 요청 보존 검증. `question_review_pages.sql`: 출처와 무관한 권한 및 완료 이력 페이지 검증. 로컬 가상 데이터 전체 롤백.
- `verify-question-copy.mjs`: 열/선택지/설명 새 ID, 설정 보존, 원본 불변, 외부 연결 해제, 답변/이력 제외 검증. 편집기 회귀에 선택 중 자동 저장 중지·초안 ID 보존·새 질문 저장 재개를 추가했다.
- 질문지 구조·기수별 배포·제출 검증은 변경하지 않았다. 실제 브라우저 테스트는 수행하지 않았다.

운영 적용은 전체 개선 완료 후 진행한다. 이번 예상 추가 파일은 `20261015055947_question_owned_reviews.sql`, 직전 작업의 `20261015054101_question_review_paged_reads.sql`도 먼저 필요하다. 그 이전의 로컬 전용 migration은 기존 운영 기록과 함께 대조한다. **예상과 다른 migration이 나오면 적용 전에 이력을 검토한다.**

```sh
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 대상과 전체 대기 파일 검토 후
npx supabase db push --linked
npx supabase db push --linked --dry-run
```

대기 없음 확인 → 앱 배포 → 새 질문 불러오기/원본 보존, 질문 귀속 검토 권한, 새·구형 API, 읽음/처리, 완료 이력, 편집기 로딩과 중첩 팝업 동작을 확인한다.

- 최종 검증: 관련 JS 51개, 타입 검사·변경 파일 린트·Webpack 빌드 통과. 로컬 SQL 2개 전체 롤백·security advisor 경고/오류 없음·로컬 migration dry-run 적용 대기 없음 확인. 실제 브라우저 테스트 및 운영 적용은 미수행.

## 질문지 시작 안내 편집 (2026-10-15)

`20261015064129_questionnaire_editable_notice.sql`: 기존 저장 함수의 최종 UPDATE에 안내를 포함하며 권한/원자성/충돌/재시도는 유지한다. 기존 데이터를 변경하지 않는다. 로컬 적용 완료, `supabase/tests/questionnaire_editable_notice.sql` 가상 데이터 전체 롤백 검증 통과. 운영은 전체 개선 마지막에 적용한다.

운영 적용 시 순서:
```sh
cd /Users/mealdm/Desktop/MEA/system
npx supabase projects list
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 예상 migration과 이전 개선 작업의 대기 파일 목록을 대조한 뒤에만 진행
npx supabase db push --linked
npx supabase db push --linked --dry-run
```
연결된 프로젝트를 확인하고 예상 밖 migration/이력 차이가 있으면 적용 전 검토한다. 적용 대기 없음 확인 후 앱을 배포하고 시작 안내 추가/수정/삭제·새로고침 복원·기존 2주차 안내·배포본 수정 차단을 확인한다. 운영 적용과 앱 배포는 이번 작업에서 수행하지 않았다.

### 2주차 첫 등록 카드 전환 재확인 (2026-10-15)

로컬 `2주차: 학습전략` (`6e67447a-1c1b-4e09-aab9-7c3dd1e702cf`)의 `학습법 블록 등록`은 이미 `start_notice`로 이전되었다. 실제 첫 응답 질문은 `학습 도구`이며, 이번 재확인에서는 데이터 변경이나 중복 migration을 만들지 않았다.

운영도 기존 `20261015034458_questionnaire_start_notice.sql`로 전환한다. 원본 제목/서식 본문/버튼 문구를 그대로 옮기고 등록 카드는 보관하며, 일반 첫 질문을 제목/순서만으로 안내로 바꾸지 않는다. 최종 사전 점검 보완본은 기존 세션·응답·최종 제출을 보존하며 빈 안내 자리만 정리한다. 실제 안내 답변·설명/중복 안내·예상 밖 연결이 있으면 전체가 중단된다. 검사를 우회하거나 실제 답변을 삭제하여 적용하지 않는다.

위 운영 적용 순서에 따라 대상·이력을 확인하고 dry-run의 기존 전환 파일 및 후속 편집 파일을 검토한다. 적용 후 `supabase/tests/questionnaire_week2_notice.sql`을 운영 SQL 편집기에서 읽기 전용으로 실행하여 안내와 보관 원문의 동일성·질문 배치 제외·응답 질문 잔존을 확인한다. 앱 배포 뒤 번호 없는 안내와 학습법 등록 버튼, 첫 실제 질문의 번호를 확인한다. 운영 조회/적용은 이번 재확인에서 수행하지 않았다.

## 질문지 초안 작성자·관리자 접근 (2026-10-15)

`20261015074005_questionnaire_private_draft_access.sql` 로컬 적용. 기존 데이터 수정 없이 SELECT RLS 및 초안 조회/저장/안내 guard를 조정한다. `supabase/tests/questionnaire_private_draft_access.sql`은 소유자·타 리드·관리자 조회/저장을 가상 데이터로 검증 후 롤백한다. 게시 공동 편집 회귀도 유지한다. 운영은 아직 미적용이다.

전체 개선 완료 시 프로젝트 루트에서 연결된 운영 대상 확인 → 이력 비교 → dry-run(이번 파일 및 앞선 대기 migration 검토) → 적용 → 대기 없음 확인 → 앱 배포 → 역할별 기능 확인 순서다.
```sh
cd /Users/mealdm/Desktop/MEA/system
npx supabase projects list
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase db push --linked --dry-run
```
예상 밖 파일/이력 차이는 적용 전에 검토한다. 앱 배포 뒤 작성자·관리자의 초안 조회/수정, 타 리드의 목록·직접 URL·Data API 차단을 확인한다.


## 검토·배포 명칭 전환 (2026-10-15)

`20261015075725_questionnaire_review_publication_workflow.sql`을 로컬 DB에 적용했다. 기존 published(게시)는 in_review(검토 중), 기존 distributed(배포)는 published(배포)로 이전한다. 과거 migration을 수정하거나 재적용하지 않는다.

### 보존과 중단 조건

- 질문지·원본·섹션·배치·작성 답변·최종 제출·검토 요청·읽음·상태 요청 영수증의 행 수와 정렬 체크섬을 전후 비교한다. 지정한 상태/열 명칭 외의 ID·revision·본문·작성/수정/제출 시각 변화는 전체 롤백한다. 2주차 안내도 그대로 유지한다.
- 검토/배포 시각은 열 rename으로 옮기므로 다시 생성하지 않는다. 이전 JSON 본문과 응답 값에 포함된 단어는 치환하지 않는다. 원본 질문의 잠금 시각도 보존한다.
- 선행 함수 75개의 정의 지문이 예상과 다르거나 기존 응답 단계가 published/distributed 이외이면 중단한다. 지문 검사를 지우거나 데이터 삭제·원격 reset/migration repair로 우회하지 않는다. 선행 migration 적용 여부와 실제 정의 차이를 먼저 검토한다.
- 함수 rename은 OID와 기존 ACL·보안 모드를 유지한다. 변경된 public 상태 RPC 두 개만 필수 workflow version 인자를 추가하고 authenticated/service_role 실행 권한을 명시한다. 환경별 guide_consultant_id는 수정하지 않는다.
- 5초 lock_timeout, 120초 statement_timeout 및 한 트랜잭션을 사용한다. 잠금 중 대상 표의 트리거 enabled 상태를 저장하고 같은 트랜잭션에서 복구한다. 실패하면 DB는 이전 계약을 유지한다.

### 구형 클라이언트와 배포 순서

같은 `published` 문자열의 의미가 달라지므로 구형 앱과 새 DB를 섞어 서비스하지 않는다. 질문지 및 원본 질문 관련 요청을 막을 수 있는 점검 시간을 확보한다. 사용자는 저장을 마친 뒤 새로고침하도록 안내한다. 새 앱은 API header `X-Questionnaire-Workflow: 2`, public 상태 RPC는 `p_workflow_version=2`를 사용하며 구형 브라우저 요청은 426으로 차단한다. 같은 이름의 구형 RPC 시그니처는 제거한다. 새 앱의 SWR 캐시 범위도 workflow-2로 분리한다. 로컬 질문 초안·답변은 일괄 삭제하지 않는다.

1. 아래 경로에서 연결된 운영 프로젝트와 현재 migration 이력을 확인한다.
2. dry-run의 전체 대기 목록을 기존 운영 기록과 대조한다. 이번 새 파일은 `20261015075725_questionnaire_review_publication_workflow.sql` 하나이며, 아직 운영에 적용하지 않은 앞선 로컬 migration도 순서대로 필요하다. 예상 밖 파일이나 이력 차이가 나오면 적용 전에 검토한다.
3. 위 최신 사전 점검 절차에 따라 저장 완료·편집 종료를 먼저 확인한 점검 시간에 DB를 적용한다. 시작 안내 migration의 빈 자리 검사와 실제 답변 보존 조건을 우회하지 않는다.
4. 적용 대기 없음 확인 후 같은 계약의 앱을 배포한다. 구형 앱 인스턴스/오래된 캐시를 더 이상 서비스하지 않는지 확인한다.
5. 새로고침하고 역할별 기능을 확인한 뒤 요청 차단을 해제한다.

```sh
cd /Users/mealdm/Desktop/MEA/system
npx supabase projects list
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 대상/대기 목록을 확인하고 점검 상태로 전환한 뒤에만 실행
npx supabase db push --linked
npx supabase db push --linked --dry-run
# 적용 대기 없음 → 새 앱 배포 → 새로고침·역할별 확인 → 서비스 재개
```

앱 배포 실패 시 점검 상태를 유지하고 수정된 앱을 배포한다. 새 DB에서 이전 앱만 되돌려 서비스하지 않는다. DB까지 되돌려야 한다면 점검 중 확보한 복원 지점과 상태·답변 보존을 포함한 별도 역이전 계획이 필요하며 운영 답변을 임의 삭제하지 않는다.

### 검증 결과

- 로컬 전환 시험은 전체 롤백으로 검증한 뒤 영구 적용했다. 질문지 6개와 응답 세션 12개의 상태/시각 이전 및 모든 관련 데이터 보존 검사를 통과했다. 적용 뒤 질문지 draft 1 / in_review 1 / published 4, 세션 in_review 4 / published 8이다.
- 현재 스키마용 SQL 25개에서 초안 작성자/관리자 접근, 검토 공동 편집, 요청 권한, 미처리 요청 배포 차단, 원본 잠금, 저장 응답이 있는 배포 취소 차단, 가이드 동기화, 질문 필드/참조, 시작 안내, 배포 응답/제출과 집계를 검증했다. 가상 데이터는 모두 롤백했다.
- 신규 `questionnaire_workflow_v2.sql`은 구형/누락 workflow version 거절, 검토/배포 시각 분리, 질문 공유, 타 리드 배포 거부, consultant의 검토본 차단/배포본 허용, 제출 세션 단계, Realtime 배포 채널, 멱등 재시도, 익명 실행 거부를 검사한다.
- 관련 JS 회귀 164개·타입 검사·변경 파일 린트·Webpack 빌드 통과. DB lint(public/private)와 security advisor에서 오류/경고 없음. 로컬 dry-run 적용 대기 없음.
- 전체 verify 스크립트 묶음에는 이전 리팩터링을 반영하지 않은 질문 schema/preview mock과 외부 실행 환경이 필요한 항목이 있어 전체 묶음 성공으로 간주하지 않는다. 이번 검증은 위 현재 스키마/관련 코드 회귀를 기준으로 한다. 과거 스키마 전용 SQL·migration 재실행 테스트는 그 시점 그대로 보존하며 최신 DB에 일괄 실행하지 않는다.
- 운영 DB 조회/적용, 운영 앱 배포, 실제 브라우저 검증은 수행하지 않았다.

## 응답 무결성·제출 조회 분리 (2026-10-15)

신규 `20261015090145_response_integrity_and_submission_reads.sql`은 로컬에서 롤백 시험 후 적용했다. 운영 DB 조회·적용이나 앱 배포는 하지 않았다. 앞선 검토/배포 명칭 전환 및 기타 미적용 migration을 포함한 전체 적용 순서를 유지한다.

- `questions.response_requirements`를 추가하고 기존 진로 흐름 원본에만 필수 시기 ID를 기록한다. 해당 원본이 없는 환경은 backfill을 건너뛰며, 있는데 필드 구성이 다르면 중단한다. 다른 질문, 과거 제출본, 응답 값, 제출 시각, 세션 revision은 수정하지 않는다.
- 한 트랜잭션, 5초 lock_timeout, 60초 statement_timeout을 사용한다. 교체 함수 4개의 정의 지문이 선행 migration 이후 예상값과 달라지면 중단한다. backfill 동안 질문 테이블 독점 잠금 아래 기존 잠금/검증/가이드 정리 트리거 3개의 정상 상태를 확인하고 잠시 중지·복원하며 새 속성 외 질문 열이 동일한지 검사한다. 실패하면 전체 롤백된다. 사용자 계정별 가이드 함수·배포 권한은 변경하지 않는다.
- 새 필수 조건은 이후 제출/재제출에 적용한다. 이전에 서버의 한 칸 예외로 제출된 응답을 삭제·취소하지 않는다. 일반 임시 저장은 부분 입력을 계속 허용한다.
- 기존 전체 제출 조회 RPC와 page 없는 API를 유지해 새 조회 경로로의 전환을 지원한다. 다만 선행 상태명 전환의 점검/동시 배포 요구는 여전히 유효하다. nullable 속성이 정의 토큰에 포함되므로 적용 전에 저장을 마치고 앱 배포 후 새로고침한다.

전체 개선 마지막 운영 반영 시:

```sh
cd /Users/mealdm/Desktop/MEA/system
npx supabase projects list
npx supabase migration list --linked
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault --dry-run
# 운영 대상·전체 대기 파일 확인 및 앞 절의 점검 전환 후에만 실행
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault --dry-run
# 적용 대기 없음 확인 → 현재 앱 배포 → 새로고침 및 기능 확인 → 점검 해제
```

이번 추가 파일은 위 090145 파일 한 개이며 이전 운영 대기 migration은 함께 검토해야 한다. 예상 밖 파일·이력 불일치·함수 지문 오류가 나오면 적용 전에 실제 정의와 선행 이력을 비교한다. 지문 검사 삭제, 원격 reset, migration repair로 우회하지 않는다. DB 적용 뒤 앱 배포가 실패하면 점검 상태에서 새 앱을 수정하며 이전 앱만 되돌려 서비스하지 않는다.

검증: 타입 검사·변경 파일 린트·Webpack 빌드, 관련 JS 회귀, 기존 응답 SQL 6개 및 신규 `response_integrity_and_submission_reads.sql` 통과. 신규 SQL은 가상 사용자·질문지를 만들고 전체 롤백하며 필수 그룹/부분 저장, 다른 질문지의 세션 차단, 10명 페이지, 내보내기 revision 충돌, 미제출 수정 비공개, 리드/관리자 조회·일반 컨설턴트 차단·익명 ACL을 확인한다. DB lint(public/private)와 security advisor 오류/경고 없음. 실제 브라우저 테스트는 사용자 요청이 없어 수행하지 않았다.

운영 앱 반영 뒤에는 가이드 다른 탭 동시 수정 시 입력 보존, 진로 흐름 필수 두 그룹 입력/부분 저장, 새 복제 질문의 필수 시기 매핑, 제출 목록 페이지/상세/목록 복귀, 개별 PDF·전체 ZIP 및 배포 역할별 접근을 확인한다.


## 제출 오류 안내·이동 UI (2026-10-15)

기존 응답 무결성 마이그레이션 이후 앱 변경만 추가한다. 새 DB migration/API 변경은 없다. 기존 운영 대기 migration을 생략해도 된다는 뜻은 아니며 전체 운영 적용 시 위 순서를 따른다. 이번 로컬 검증은 타입/변경 파일 린트·Webpack 빌드 및 질문별 검증·조건/참조·제출 차단/수정 후 재제출·범위 내 스크롤/포커스 JS 33개다. 실제 브라우저 테스트와 운영 배포는 미수행이다.

앱 배포 후에는 필수 칸을 비운 제출, 첫 오류로의 이동, 오류 목록에서 다른 질문 이동, 답변 수정 후 안내 해제, 조건부 질문·표의 빈 여분 행·진로 흐름 필수 시기, 모든 답변을 채운 뒤 정상 제출을 확인한다.

## 답변 판정 통일·질문지 서버 목록 (2026-10-15)

이번 추가 migration은 `20261015105318_questionnaire_paged_list_reads.sql` 한 개다. `list_questionnaires`, 제한된 ID 메타데이터 조회 및 내부 역할/범위 함수를 추가한다. 기존 테이블·열·정책·저장 함수·데이터를 변경하지 않는다. 현재 `in_review/published` 상태 명칭을 전제로 하므로 앞선 상태 전환과 응답 구조 migration 이후 적용한다.

로컬에서 migration+가상 데이터 1,043개 회귀를 같은 트랜잭션으로 먼저 시험/롤백하고, 대기 파일이 이번 한 개임을 확인한 뒤 영구 적용했다. 적용 후 동일 회귀를 다시 실행해 전체 롤백했다. 1,000개 이후 페이지/직접 조회, 전체 2·2·10 제한, 검색·작성자·보관 범위, 마지막 페이지 보정, 배포 순서·작성자·제출 수, 관리자 표시 역할 제한, 컨설턴트 제출 탭, 학생/비로그인 접근 차단을 검사한다. 로컬 보안 advisor 적용 전후 문제 없음. 실제 브라우저·운영 DB 조회/적용·앱 배포는 수행하지 않았다.

관련 검증:

- `supabase/tests/questionnaire_paged_lists.sql`: 조회·집계·권한·ACL, 가상 데이터 전체 롤백.
- `scripts/verify-questionnaire-list-model.mjs`: URL 정규화와 목록 캐시/상세 복귀 조건.
- `scripts/verify-questionnaire-storage.mjs`: 상세를 전체 목록과 분리해 조회, 기존 편집/표시 권한.
- `scripts/verify-response-submission-validation.mjs`: 구형 추가 서술 응답을 미리보기 완료 보고·후속 조건·제출 검사에서 동일 판정.
- 타입 검사·변경 파일 린트·관련 JS 35개·Webpack 빌드가 통과했다. 기존 초안 권한/검토 중 공동 편집/배포 제출 SQL 3개도 가상 데이터 전체 롤백으로 통과했다. 실제 브라우저 검증은 사용자 요청 시에만 수행한다.

운영 적용은 전체 개선 작업 마지막에 진행한다. 기존 미적용 파일도 함께 검토해야 하며 이번 파일만 임의로 순서를 건너뛰어 적용하지 않는다. 앞선 상태 전환의 점검 시간·구형 앱 차단 요건도 유지한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
# 전체 대기 이력과 이번 예상 파일 20261015105318_questionnaire_paged_list_reads.sql 확인
# 예상과 다르면 적용 전에 중단하고 이력을 검토
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
# 적용 대기 없음 확인 → 현재 앱 배포 → 열린 탭 새로고침 → 기능 확인
```

기능 확인은 관리자/리드의 검색·상태·작성자·페이지, 목록 외 ID 상세, 컨설턴트 제출 전/완료, 기존 추가 서술 응답 뒤의 조건 질문 표시를 포함한다. 실제 운영 데이터를 삭제하거나 가상 답변을 제출해 검증하지 않는다. 1번(가이드 답변과 설정 축소), 2번(공유 질문 의존 관계의 배치 영향)은 [남은 개선 과제](data-api.md#남은-개선-과제-이번-작업-제외)로 유지한다.

## 업무 충돌 무한 재시도 긴급 수정 (2026-10-16)

### 원인과 운영 조치

PostgREST 14.5에서 업무 충돌을 SQLSTATE `40001`로 발생시키면 내부에서 같은 트랜잭션을 무한 재시도할 수 있다. 운영 로그의 `private.save_question` revision 충돌과 PID 1929655에서 이를 확인했다. 로그 표시 시각은 소수점이 생략돼 있으므로 연결 종료 대상을 찾을 때 실제 `pg_stat_activity.backend_start`를 읽어야 한다. 이번 연결의 실제 시작 시각은 `2026-10-11 16:18:48.424906+00`이었다. PID·사용자·application_name·실제 시작 시각을 함께 확인하여 해당 연결만 종료했다.

`20261016012233_prevent_business_conflict_retries.sql`을 로컬 migration으로 적용하고 운영 `epwlcallocdjkmgdmtlv`에는 같은 SQL을 **단독 긴급 적용**했다. 운영 함수 15개에서 실제 SQLSTATE를 `PGRST`로 바꿨다. 응답 본문 code는 구형 앱과 호환되는 `40001`, HTTP 상태는 409다. 기존 앱 재배포·브라우저 새로고침은 필요 없다. 테이블 DML/데이터 삭제/권한 변경은 없다. 이미 실패 중이던 요청의 미저장 내용을 DB가 복구했다는 의미는 아니다.

운영 2026-10-16 10:27:38~10:28:17 KST 관찰: 문제 PID 없음, 업무 SQLSTATE40001 함수 0개, set_config 계열 누적 호출 195964418→195964421(약 39초간 3회). 이전 약 522회/초에서 급감했다. 누적 사용량은 되돌아가지 않으므로 대시보드 총량보다 이후 증가율을 확인한다. 이후 장시간 모니터링은 별도 수행해야 한다.

### 검증

- `supabase/tests/business_conflict_transport.sql`: 로컬 가상 계정·질문을 트랜잭션 롤백. 최초 저장, stale revision 거절, 기존 내용 보존, 정상 revision 수정, SQLSTATE PGRST/JSON40001/HTTP409 계약 확인.
- 실제 로컬 PostgREST 임시 RPC: HTTP409/code40001, 16ms 반환 확인 후 함수 제거. 실제 브라우저 테스트는 하지 않았다.
- 로컬 16개와 운영 15개 함수 정의를 수정 전 스냅샷과 비교하여 오류 처리 구문 외 동일함을 확인했다. migration 자체에서 소유자·ACL·security definer·설정 보존을 검사한다.
- `20261015075725_questionnaire_review_publication_workflow.sql`의 정의 지문 검사는 긴급 수정 구문에 포함된 원래 RAISE(base64)를 비교 시에만 복원한다. 실행할 정의는 수정본을 유지한다. 일반 드리프트 검사는 유지하며 전체 후속 migration 체인은 운영 반영 전에 별도로 검증한다.

### 다음 전체 배포와 이력

운영 긴급 적용은 `db query --file`로 실행했으므로 **20261016012233의 migration 이력은 아직 미기록**이다. 순서를 앞당겨 이력을 repair하지 않았다. 다른 대기 migration도 적용하지 않았다. 이후 정상 체인의 마지막에서 이 파일이 실행되어, 앞선 migration이 재생성한 구형 오류 처리도 함께 보완하고 이력을 기록한다. 이미 수정된 함수에는 재적용하지 않는 멱등 구조다.

현재 즉시 전체 `db push`를 실행하지 않는다. 예정된 전체 배포 때 구형 앱 차단·작성 중 데이터 보호 조건과 전체 대기 목록을 검토한 뒤 아래 순서를 따른다.

```bash
cd /Users/mealdm/Desktop/MEA/system
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
# 기존 대기 파일 전체 + 20261016010233_service_announcements.sql
# + 20261016012233_prevent_business_conflict_retries.sql 확인
# 예상과 다른 파일/이력이 있으면 적용 전에 중단하고 검토
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
# 적용 대기 없음 확인 → 앱 배포 → 저장/충돌/임시저장 복구 기능 확인
```

긴급 수정만 별도 적용한 상태와 전체 체인 적용을 혼동하지 않는다. 전체 상태 전환 migration의 점검 시간·구형 앱 차단 요건은 유지한다.

## 응답 조회 Egress 절감 — 로컬만 적용 (2026-10-16)

추가 파일: `20261016014123_response_poll_versions.sql`. 기존 테이블/답변/세션/revision/권한 정책을 변경하지 않고 private/public 버전 조회 함수만 추가한다. 질문지 상태 전환·응답 무결성·긴급 충돌 수정 이후 적용한다. 로컬 적용 완료, **이번 변경의 운영 migration 및 앱 배포는 미실행**이다.

검증: 타입 검사·변경 파일 린트, `scripts/verify-response-polling.mjs` 6개(변경 없음/동일 revision 정의 변경/저장 또는 숨김 경쟁/오래된 결과/제출·안내 변경), SQL `response_integrity_and_submission_reads.sql`과 `review_live_layout.sql`(가상 데이터 전체 롤백), 로컬 security advisor 통과. 기존 SQL 테스트의 serialization_failure 기대값은 앞선 긴급 수정의 PGRST/code40001 계약에 맞췄다. 브라우저 검증은 수행하지 않았다.

향후 승인된 전체 배포 때만 실행한다. 지금은 아래 명령을 운영에 실행하지 않는다.

```bash
cd /Users/mealdm/Desktop/MEA/system
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
# 기존 대기 파일 전체와 20261016014123_response_poll_versions.sql 확인
# 예상과 다른 목록이면 적용 전 이력 검토; 긴급 단독 적용 및 지문 정규화 주의
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
# 대기 없음 확인 → 앱 배포 → 정상 작성/임시저장/제출/다른 탭 충돌/복귀/쿠키 갱신 확인
```

migration을 먼저 적용한 뒤 앱을 배포한다. 이전 앱은 새 함수를 사용하지 않아 기존 조회 동작을 계속하며 데이터 마이그레이션은 없다. 새 앱을 DB 함수 없이 먼저 배포하면 정기 변경 확인이 실패하므로 순서를 지킨다. 전체 대기 체인에 포함된 기존 상태 전환의 점검 시간·구형 앱 차단 요건은 그대로 유지한다.

## 사용량 재발 방지 기준

이번 로그/Egress 사고의 원인·조치 범위·검증 규칙·운영 점검은 [사용량 사고와 재발 방지](usage-reliability.md)에 정리했다. AGENTS.md에서 관련 작업 전에 읽도록 연결한다. 자동 경보 및 장기 관측은 아직 미구현이며, Egress 개선은 운영 배포 전이다.


## 2026-10-16 운영 시작 안내 이전 중단 보완

운영은 `20261014082243`까지 6개가 적용됐고 `20261015034458`은 안전 검사 실패로 전체 롤백됐다. 배치된 2주차 안내 외에 미배치 `학습법 블록 등록` 원본(`20215760-eca5-41a1-86d0-0a3c8fb5b4b0`)이 존재했다. 읽기 전용 점검에서 해당 원본의 응답·세션·제출·질문 의존 참조는 모두 없었다.

아직 운영에 적용되지 않은 시작 안내 migration을 보완했다. 미배치 원본은 참조 없음 검사 후 archived_at만 바꾸고 원문/설명은 보존한다. 참조가 있으면 중단하며 기존 빈 안내 자리 검사와 답변/제출/재시도 메타데이터 보존 지문은 유지한다. 이력 repair/reset 또는 보호 조건 제거는 하지 않는다.

운영 기준 스키마를 별도 로컬 DB에 복원하여 15개 체인(시작 안내 앞 6개부터 `20261015105318`까지)과 기존 답변 보존·후속 저장/제출 회귀를 롤백 검증했다. 미배치 원문 보존 및 비정상 응답/행/과거 답변/제출/재시도/layout/응답 참조/미배치 참조 차단도 검증 대상에 추가했다. `scripts/prepare-questionnaire-notice-session-check.mjs`의 preserve와 8개 거절 사례를 사용한다. 실제 운영 데이터 쓰기는 하지 않았다.

재개: 프로젝트 이동 → 연결 대상 `epwlcallocdjkmgdmtlv` 및 `migration list --linked` 확인 → `db push --linked --dry-run`에서 시작 안내부터 `20261016014123_response_poll_versions.sql`까지 12개 확인 → `db push --linked` → 이력 및 dry-run 대기 없음 확인 → 앱 배포 → 안내/임시저장/제출 기능 확인. 예상 밖 파일이 보이면 중단하고 이력을 검토한다. 구형 앱과 새 상태 계약이 섞이지 않도록 기존 점검 절차를 유지한다.


### 같은 migration의 수정 시각 보존 오류 보완

운영 재시도에서 `Start notice migration changed preserved data in questions`로 롤백됐다. 운영 `validate_question` BEFORE UPDATE 트리거가 archived_at만 변경할 때도 updated_at을 now()로 갱신했다. 앞선 합성 테스트는 같은 트랜잭션에서 생성/이전하여 now()가 동일했으므로 이 차이를 놓쳤다.

아직 미적용인 시작 안내 migration에 잠금/트랜잭션 내부의 임시 AFTER-validation 순서 BEFORE 트리거를 추가했다. 안내 보관 대상과 archive-only 변경을 확인하고 updated_at을 OLD 값으로 복원한다. validate_question의 내용/참조 검사는 계속 실행한다. 생성 열 search_text는 BEFORE 단계에서 비교하지 않되 기존 최종 전체 지문 검사에 포함한다. 임시 트리거/함수는 UPDATE 직후 제거한다. 최종 보존 검사에서 updated_at을 제외하지 않는다.

격리 테스트 fixture는 안내의 updated_at을 7일 전으로 설정하도록 강화했다. 수정 전 운영 오류 재현, 수정 후 15개 체인 및 답변/제출/후속 저장 보존 통과, 8가지 위험 입력 거절을 확인했다. 운영에는 읽기 전용 트리거 정의 조회만 수행했으며 실제 적용은 사용자가 기존 12개 재개 절차로 진행한다. 향후 보존 migration 테스트는 과거 생성/수정 시각을 가진 행을 반드시 포함한다.


### 응답 계약 migration의 긴급 수정 호환 (2026-10-16)

운영은 `20261015075725`까지 적용됐고 `20261015090145`의 save_question 함수 지문 검사에서 중단됐다. 읽기 전용으로 4개 대상 함수 정의를 확인했다. save_question/save_review_response_session/save_published_question_response_session은 긴급 PGRST HTTP409 전송 수정만 존재하며, 원래 RAISE 구문으로 비교하면 기존 예상 지문과 정확히 일치했다. read_shared_question_sources는 원본 그대로였다.

미적용 `20261015090145`의 3개 검사에 검증된 긴급 수정본 전체 MD5를 추가 허용했다. 임의 수정/함수 누락은 계속 거절한다. 새 함수에서 다시 생성되는 충돌 구문은 뒤의 `20261016012233`에서 수정되므로 전체 DB 적용이 끝나기 전에 서비스를 재개하지 않는다.

`node scripts/prepare-questionnaire-notice-session-check.mjs preserve --emergency-patched`는 기준 스키마에 긴급 수정을 먼저 적용한 뒤 후속 18개 파일 전체(공지·최종 충돌 패치·폴링 버전 포함)를 롤백 검증한다. 답변/제출 보존과 후속 저장 회귀, 최종 retryable 40001 부재를 통과했다. 원본 상태의 15개 체인도 통과했고, 의도적으로 함수 내용을 다르게 변경하면 drift 검사에서 중단되는 것도 확인했다. 운영 적용은 수행하지 않았다.

현재 dry-run 대기는 `20261015090145`, `20261015105318`, `20261016010233`, `20261016012233`, `20261016014123`의 5개다. 프로젝트 이동 → 연결 대상/이력 확인 → dry-run 예상 5개 확인 → push → 이력/대기 없음 확인 → 앱 배포 → 기존 답변/임시저장/제출 확인 순서를 따른다. 예상 외 파일은 적용 전 검토한다. 이전 성공 파일의 재실행이나 repair/reset은 하지 않는다.


## 2026-10-17 사용량 사고 재점검 (운영 읽기 전용)

11:57~11:59 KST에 `epwlcallocdjkmgdmtlv`를 확인했다. 위의 10월 16일 배포 대기 기록은 당시 상태이며, 현재 운영 이력에는 `20261016014123`까지 기록되어 있다. 긴급 충돌 수정 `20261016012233`도 포함된다. 이번 조사에서 migration/데이터/설정을 변경하거나 앱을 배포하지 않았다.

- public/private 함수의 업무용 retryable SQLSTATE40001 잔존 0개, private PGRST/JSON40001 처리 함수 16개, 과거 문제 PID 1929655 없음. 40001 문자열이 있으면서 PGRST 처리가 없는 함수도 0개다.
- 11:57:54~11:58:33 KST set_config 누적 호출은 196058364→196058418(약39초간54회, 약1.4회/초). 사고 당시 약522회/초와 달리 폭주 징후가 없다. 누적 통계는 날짜별 과금 사용량이 아니다.
- 11:00~조회 시점(11:58경) Postgres 31건, PostgREST 17건, Realtime 14건. 메시지의 error/40001/Unauthorized 검색 일치 0건. 요청한 종료 경계는 12:00이지만 조회 당시 미래 구간은 관측한 것으로 취급하지 않는다. 장기 관측이나 모든 오류의 부재를 뜻하지 않는다.
- 11:50~11:58 API 로그에서 read_published_question_response_version 11회, save_published_question_response_session 14회 모두 HTTP200. 버전 조회 함수는 public/private 모두 존재한다. 새 조회 경로의 실제 사용은 확인했으나 모든 클라이언트의 배포 버전은 확인하지 않았다.
- 같은 8분에 auth user 423회, profiles 212회, read_shared_questionnaire 77회, questionnaire_list_items 77회, read_shared_question_sources 74회, read_guide_answers 41회. 상위 집계 경로는 모두 HTTP200이었다. 바이트 집계와 사용자별 기여율은 미확인이다.
- 응답 버전 조회 로컬 회귀 6개 통과. 실제 브라우저 테스트 및 운영 데이터 쓰기 회귀는 수행하지 않았다.

**판정:** 기존 DB 무한 재시도 원인은 운영에서 제거됐고 현재 재발 징후가 없다. 응답 Egress 최적화도 운영에서 사용되고 있지만 전체 Egress 문제는 부분 해결이다. QuestionnaireView.tsx:237의 상세 5초 조회가 남아 있으며 loadQuestionnaireView가 질문지 본문과 공유 질문 원본을 다시 읽는다. 해당 GET은 응답 경로 전용 Proxy 인증 생략 대상이 아니어서 Proxy와 Route Handler 인증이 각각 실행된다. 이 경로의 변경 감지/조회량 절감은 후속 과제다. 기존 답변·배치·권한·충돌 보호를 유지해야 한다.

Log Query는 일반 DB SQL 호출 수가 아니라 로그 조회가 스캔한 바이트다. 사고로 쌓인 큰 로그를 Studio/API/MCP에서 반복 검색하면 조사 자체가 사용량을 늘릴 수 있다. 어제 조회 주체별 이력과 청구용 일별 수치는 이번 연결 도구로 확인하지 못해 정확한 기여율은 미확정이다. 이번 조사는 좁은 시간·source 조건으로 제한했고 과거 폭주 구간 전체 재스캔을 하지 않았다. LIMIT만으로 스캔량이 줄지는 않는다. [공식 사용량 설명](https://supabase.com/docs/guides/platform/manage-your-usage/logs-query), [조회 범위 지침](https://supabase.com/docs/guides/observability/advanced-log-filtering).

Advisor도 확인했다. 다중 허용 정책(study/exploration), 외래키 인덱스 등의 성능 권고가 있으나 이번 폭주의 원인으로 입증되지 않았다. SECURITY DEFINER 경고 중 rls_auto_enable의 반환형은 event_trigger여서 일반 RPC 호출 가능성을 경고 문구만으로 단정하지 않는다. 역할 변경 함수는 별도 권한 검증 계약을 따른다. [정책 성능 권고](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), [함수 실행 권고](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [암호 보호 권고](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). 자동 사용량 경보·장기 관측은 여전히 미구현이다.

## 로딩 UI 검증 (2026-10-19)

회원 관리 서버 조회 대기, 질문지 가이드 답변 조회, 학습법·탐구활동 첨부 선택 목록의 로딩 UI를 보완했다. 타입 검사·변경 파일 린트·관련 회귀 8개·Webpack 프로덕션 빌드 통과. DB migration·API·권한 변경은 없으며 실제 브라우저 테스트와 운영 배포는 수행하지 않았다.

### 첨부 로딩 보완·가이드 표시 복원 (2026-10-19)

선택기 진입 전 사용자 확인과 참조 상세 Drawer의 문구형 로딩도 스켈레톤으로 교체했다. 가이드 답변의 추가 로딩/오류 UI는 사용자 요청으로 제거하고 기존 데이터가 있을 때만 표시하도록 복원했다. 이번 보완의 타입 검사·변경 파일 린트·첨부 선택 회귀 2개 통과. 실제 브라우저 테스트·운영 배포는 수행하지 않았다.


## 탐구줄기 변경 영향 점검 (2026-10-19)

질문 편집·질문지 저장/닫기·답변·제출 화면 이동 등 64개 통과. question-exploration 시작 단계 mock 누락 1개와 questionnaire-realtime 세션 초기화 mock/대기 누락 4개는 HEAD에서도 동일 실패했다. 기존 데이터/저장 API/자동 저장 주기/이탈 정책은 변경하지 않았다. 탐구줄기 편집기의 이벤트 해제 후 공통 로그아웃·역할 전환이 원래대로 실행되는 것을 경계 어댑터로 검사했다. 사용자 브라우저/DB 변경 및 실제 브라우저 테스트 없음. 전체 범위와 미해결 기존 테스트는 [탐구활동 운영 문서](../exploration/operations.md#저장화면-이동-영향-범위-점검-2026-10-19)를 따른다.

## 다중 안내·탐구줄기 등록 (2026-10-19)

`20261019131346_questionnaire_positioned_notices.sql`은 기존 start_notice 열의 단일 객체를 보존하면서 새 notices 배열의 DB 검증·읽기·원자적 저장을 연결한다. 기존 안내는 읽을 때 처음 위치로 변환한다. 기존 행/답변/제출본을 UPDATE하지 않으며 새 테이블·인덱스·공개 RPC·SECURITY DEFINER 함수는 추가하지 않는다. 새 private 헬퍼 2개는 데이터 접근 없는 immutable invoker이며 PUBLIC/anon 실행을 회수한다. 기존 역할·소유자·배포 잠금·함수 ACL과 HTTP409/PGRST 업무 충돌 처리를 보존한다.

로컬에 직접 적용·검증한 뒤 migration 전체를 이전 정의에서 재실행하는 롤백 검사로 최종 함수 8개 및 ACL의 완전 동일성을 확인했다. 검증된 최종 파일만 로컬 migration 이력에 등록했고 `db push --local --dry-run`은 적용 대기가 없다. 운영 DB 조회·적용·앱 배포는 수행하지 않았다.

검증:
- 타입 검사 및 변경 파일 린트 통과.
- `verify-questionnaire-notices.mjs` 7개: 안내 위치/질문 이동·삭제/제출본 제외, 저장 대기/중복 클릭/실패 차단, 실제 응답 저장 훅의 최신 입력 일치와 실패 후 보존.
- `verify-response-polling.mjs`, `verify-questionnaire-storage.mjs`, `verify-published-response-form.mjs` 30개 통과. 기존 답변 저장/제출/충돌/재시도/미저장 입력 보호 포함.
- `supabase/tests/questionnaire_positioned_notices.sql`: 다중 안내·버튼 문구 왕복, 기존 객체 호환, 미전달 보존, 중복·잘못된 입력 거절, 재시도/충돌, 타인/컨설턴트 쓰기 거절, 공유/배포 응답 안내와 버전 지문 검증(전부 롤백). 과거 단일 startNotice 계약용 `questionnaire_editable_notice.sql`의 현행 대체 검사다.
- `business_conflict_transport.sql`, `review_live_layout.sql` 회귀 통과(롤백). 최종 업무 SQLSTATE40001 재도입 없음.
- 로컬 security advisor 경고·오류 없음. 실제 브라우저 검증은 요청이 없어 수행하지 않았다.

추가 polling은 없다. 안내 관련 주기 전송은 최대 50개 본문 대신 32자 noticesToken 하나다. 30초 주기·보이는 탭 기준 안내 지문 내용만의 시간당 전송 상한 예시는 100명 × 2탭 × 120회 × 32바이트 ≈ 0.77MB이며 JSON/HTTP/다른 메타데이터는 별도다. 기존 응답 읽기 내부 계산 및 상위 질문지 상세 조회 비용은 그대로 남고 전체 Egress 해결로 해석하지 않는다. 장시간 운영 관측은 미수행이다.

운영은 UI 개선 전체 완료 시 기존 합의에 따라 반영한다. 새 앱은 notices 계약을 사용하므로 DB migration 적용 후 앱을 배포한다. 구형 RPC startNotice 쓰기는 거절되어 새 안내를 덮어쓰지 않는다. 사용자에게 열린 편집 화면은 배포 후 새로고침하도록 안내한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 아래 예상 파일 및 기존 미적용 목록과 일치하는지 확인한 다음에만 실행
npx supabase db push --linked
npx supabase db push --linked --dry-run
```

이번 파일은 `20261019131346_questionnaire_positioned_notices.sql`이다. 이전 탐구줄기 작업이 운영 미반영이면 `20261019104839_exploration_links.sql`, `20261019110548_require_exploration_link_skills.sql`이 먼저 나올 수 있다. 예상과 다른 migration은 적용 전에 연결 대상·이력을 검토한다. 적용 대기 없음 확인 → 앱 배포 → 기존 안내 보존, 질문 사이/마지막 안내, 등록 버튼의 저장 성공 이동·실패 시 잔류를 확인한다. 원격 reset/임의 history repair는 하지 않는다.

## 안내 사진·캐러셀·확대 (2026-10-19)

`20261019142422_questionnaire_notice_images.sql`: 비공개 Storage 버킷(2MiB, WebP), 읽기/업로드 RLS, 사진 메타데이터 검증 및 질문지 저장 시 객체 존재 검사를 추가한다. 기존 문서·답변 행은 일괄 변경하지 않는다. 사진 원본은 브라우저와 서버에서 최대 2000px로 줄이고 서버에서 메타데이터를 제거한다. 기존 Next 간접 의존성이던 sharp 0.35.4를 정확한 버전의 직접 의존성으로 등록했다.

로컬 적용·이력 등록 완료, dry-run 적용 대기 없음. 함수 정의·ACL은 이전 함수부터 최종 migration 재실행으로 동등성을 확인했고 버킷 설정은 Storage 보호를 유지한 채 읽기 검증했다. 운영 적용·앱 배포·실제 브라우저 검증은 수행하지 않았다.

검증: 타입·변경 파일 린트, 이미지 UI/처리/API 7개와 기존 질문지/안내/응답 회귀 37개 통과. `supabase/tests/questionnaire_notice_images.sql`은 초안 비공개·공동 편집·배포 시 참조 사진만 조회·익명 거부·없는 파일/중복 참조 거절을 롤백 검증한다. `questionnaire_positioned_notices.sql`, `business_conflict_transport.sql`도 통과했다. `node scripts/verify-notice-images-local.mjs`는 로컬 URL 강제 확인 후 임시 계정/질문지/사진으로 실제 Storage HTTP 업로드·읽기·타인 거절·덮어쓰기 거절·참조 저장을 확인했고 모두 정리했다. 로컬 security advisor 경고·오류 없음.

반복 조회는 추가하지 않는다. 여러 사진은 썸네일 목록에서 지연 로드하며 각 이미지 요청은 최대 2MiB다. 별도 썸네일 파일 없이 기존 압축 이미지를 사용하므로 한 안내의 사진 10장을 모두 읽으면 최대 20MiB가 전송될 수 있다. 확대 팝업은 동일 사진을 별도 표시하므로 private,no-store 정책상 재요청할 수 있다. 사진 메타데이터만 기존 문서/지문 조회에 포함한다. 미참조 파일 자동 정리는 미구현이며, 저장 실패/다른 창 입력을 보호하기 위해 현재 제거는 참조 해제로 한정한다.

전체 UI 개선 완료 후 운영 반영 순서:

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 예상 파일·연결 대상을 확인한 다음에만
npx supabase db push --linked
npx supabase db push --linked --dry-run
```

이번 예상 파일은 `20261019142422_questionnaire_notice_images.sql`이다. 선행 `20261019131346_questionnaire_positioned_notices.sql` 및 이전 탐구줄기 2개가 미적용이면 먼저 포함되어야 한다. 예상과 다른 migration은 적용 전에 이력을 검토한다. 적용 대기 없음 확인 → 앱 배포 → 한 장/여러 장 첨부·순서 변경·썸네일 목록·확대·저장/재조회·컨설턴트 열람·권한 거부를 확인한다. 운영 reset/임의 repair는 실행하지 않는다.

### 3주차 브랜딩 재료함 모아보기 (2026-10-19)

질문지 `01832b27-3408-409d-a635-bd4a913562f2`에만 마지막 안내 아래 고등학생 때의 재료함/대학 진학 후의 신규 재료함 표를 표시한다. 섹션 3 질문 3·4의 키워드, 섹션 4 질문 1·2의 가치관, 섹션 5 질문 1·2의 역량 필드를 실제 질문·필드 UUID로 고정 연결한다. 질문 순서 변경으로 다른 답변에 연결되지 않는다. `BrandingMaterialSummary`는 브랜드 색상의 옅은 노란색(`bg-brand/15`) 제목 줄과 background 배경 답변 행을 표시하며, 수정은 원래 응답의 동일 행·필드에 전달한다. 다른 필드·행 metadata는 보존하며 별도 저장 모델/API/조회/polling은 없다. 원 질문은 표 편집 후 해당 질문만 갱신하여 두 위치의 표시를 동기화한다. 잠긴 응답은 읽기 전용이며 원 질문이 제거되거나 누락되면 편집을 막는다. 미리보기 편집은 로컬 화면 상태만 사용한다. DB migration 및 운영 반영은 없으며 실제 브라우저 검증은 수행하지 않는다.
### 3주차 가이드 응답 등록 (2026-10-20)

사용자 명시 요청으로 운영 질문지 `01832b27-3408-409d-a635-bd4a913562f2`에 지정 `guide_consultant_id()` 계정의 검토 단계 가이드 응답을 등록했다. 기존 해당 세션이 없음을 확인하고, 기존 open/save RPC의 권한·정의 token·revision·필수 입력 검사를 거쳐 13문항 39개 행을 저장했다. 세션은 `07cb7268-c960-48a5-9305-466eda9674e7`, 상태는 `submitted`, revision은 1이다. 질문지 자체는 `in_review`를 유지한다.

내용은 1주차 가이드 답변의 언어학·심리학 관심과 고교 활동을 바탕으로 AI가 재구성했다. 최초 등록 시 첫 답변에 넣었던 `[작성 안내]` 문단은 같은 날 사용자 요청으로 기존 저장 RPC를 통해 제거했다(revision 2). 후속 사용자 요청으로 개별 재구성·예시 표시와 기록 부족·추가 확인 문구도 제거하고 1주차를 언급하는 문장을 자연스럽게 조정했다(revision 3, submitted 유지). 13문항 전체에서 해당 안내 문구가 남아 있지 않음을 확인했다. 실제 대학 경험을 새로 추가하지 않았으며, 생성 경위는 이 운영 기록에 보존한다. 멘토의 직접 작성·검수 여부는 확인되지 않았다.

동일 저장의 전체 rollback 검증 후 단일 트랜잭션으로 적용했다. 저장 후 payload 완전 일치 및 실제 `private.read_guide_answers` 경로의 13문항·39행 반환을 확인했다. 스키마·RPC·권한 변경과 migration·앱 배포는 없으며 브라우저 테스트는 수행하지 않았다. 검토 단계이므로 일반 컨설턴트의 배포본 접근은 기존 공개 정책을 따른다.


### 질문지 미리보기 검토 요청 숨김 (2026-10-20)

공통 `QuestionnairePreview`에서 검토 요청 카드를 제거했다. 검토 중 질문지 미리보기와 가이드 답변 작성 화면에 적용하며, 배치 편집·원본 질문 편집의 검토 요청은 유지한다. 숨겨진 카드의 조회·읽음 처리도 실행되지 않는다. DB/API/권한 변경은 없으며 로컬 수정이다. 실제 브라우저 테스트와 운영 배포는 수행하지 않았다.

### 3주차 가이드 탐구활동 참조 등록 (2026-10-20)

사용자 요청으로 지정 가이드 계정 소유의 탐구활동 3건을 운영에 생성하고 질문지 `01832b27-3408-409d-a635-bd4a913562f2`의 섹션 3 질문 2(`59eac053-2376-4d8f-9537-f2bbcd124a42`) 활용 방식 필드에 explorationReference로 연결했다. 기존 행 ID·키워드·관련성 및 다른 질문 답변은 보존했다.

- `083eb243-f2bc-49a0-8de7-e2eb67a6152e`: 초현실주의가 고발한 언어의 자의성 — 고2 1학기 문학 세특.
- `272735bd-92f1-4ef3-852d-505c11570341`: 연설문의 은유적 언어 — 고2 2학기 동아리활동.
- `dd51f734-94f0-4155-b02f-e05e40d16165`: 기호학이 고발하는 이데올로기 — 고3 1학기 동아리활동.

주제는 기존 1주차 답변을 토대로 작성했다. 학년·학기·교과 배치는 사용자가 적절한 시기를 만들어 입력하도록 명시적으로 요청한 값이며, 상세 과정은 가이드용으로 작성한 내용이다. 본문에 모의·예시 표시는 넣지 말라는 사용자 요청을 따랐으며, 멘토의 직접 작성·검수 사실로 해석하지 않는다. 별도 보고서 파일이나 외부 참고자료는 추가하지 않았다.

기존 save_exploration 및 save_review_response_session RPC로 전체 rollback 검증 후 단일 트랜잭션 적용했다. 실제 가이드 조회 결과의 참조 3개가 활성·동일 소유자 탐구활동 3개로 연결됨을 재확인했다. 기존 제출 상태와 다른 최신 답변을 보존했으며 스키마·권한 변경, migration, 앱 배포 및 브라우저 테스트는 없다.

### 3주차 가치관·역량 가이드의 탐구활동 근거 연결 (2026-10-20)

사용자 요청으로 기존 가이드 응답의 가치관 2개(당연한 표현과 생각도 다시 질문하기, 한 가지 정답보다 논리와 열린 태도 중시하기)와 역량 1개(언어·기호를 사회문화 맥락과 연결하는 능력)의 설명에 기존 탐구활동 블록을 각각 2개·1개·3개 언급했다. 활동 개수 자체를 조건으로 삼지 않고, 활동에서의 판단 기준과 분석 행동이 가치관·역량의 근거가 되도록 설명했다. 신규 활동 생성이나 다른 답변 수정은 없다.

기존 저장 RPC로 rollback 검증 후 운영 반영하고 3개 답변의 탐구 참조 개수를 재조회했다. 최신 응답 전체를 잠금 아래 읽고 해당 행·필드만 교체하여 다른 입력과 제출 상태를 보존했다. DB/API 계약·권한 변경, migration·앱 배포·브라우저 테스트는 없다.

# 질문·질문지 운영과 검증

기능은 [질문·질문지 관리](questions.md), 데이터 구조는 [저장 구조](questionnaire-storage-design.md), 개발 환경은 [로컬 Supabase](local-supabase.md)를 참고한다.

## 현재 적용 상태

2026-10-15 로컬 최신 이력은 `20261015075725_questionnaire_review_publication_workflow.sql`이다. 상태·명칭 전환과 데이터 보존 검사를 로컬에 적용했다. 운영 조회/적용·앱 배포·실제 브라우저 검증은 수행하지 않았다. **이번 전환은 아래 최신 ‘검토·배포 명칭 전환’ 절의 점검 시간 확보·구형 앱 차단·배포 순서를 우선한다.**

운영의 마지막 확인된 선행 기록은 AGENTS.md에 기록된 `20261013033907_question_flow_insertions.sql` 적용이다. 현재 운영 상태를 다시 조회한 것은 아니므로 실제 적용 시 연결 대상·이력을 확인한다. 이전 published/distributed라는 표현은 당시 의미를 유지하며 현행 상태는 검토 중(in_review)/배포(published)다.

### 과거 운영 확인 기록

2026-10-12 운영 `epwlcallocdjkmgdmtlv`의 최신 이력은 `20261012050319_study_registration_cards`다. 다른 작업에서 이미 운영에 반영한 검토 조회·학습법 솔루션·게시 공동 편집 migration 3개는 최신 main을 합쳐 로컬 이력과 맞췄고 재적용/repair하지 않았다. 등록 카드 migration 한 개만 임시 시험·회귀·기존 데이터/권한/가이드 보존 검사 후 적용했으며, 적용 후 신규 SQL 회귀와 기존 조건 해제 회귀·dry-run 대기 없음을 확인했다. 새 보안 경고는 없고 기존 경고 4개가 유지된다. 앱 배포와 실제 브라우저 기능 확인은 별도다.

선행 표형 응답 migration `20261011143258_question_answer_layouts`도 2026-10-12 운영 적용과 회귀 검증을 완료했다. 당시 검증 내용은 아래 표형 응답 절을 따른다.

아래 날짜별 절과 이전 기록의 ‘운영 미적용/적용 대기’는 당시 상태이며 현재 운영 이력보다 우선하지 않는다. 위 과거 기록의 검증 범위는 당시 환경 기준이며 이번 로컬 검증은 최신 절에 별도로 기록한다.

과거 migration은 재현용으로 유지한다. 완료된 이전 절차를 재실행하지 않는다. 구형 질문지 import 함수는 폐기됐으며 관련 과거 SQL 스니펫은 현행 실행 안내가 아니다.

## 이후 DB 변경 적용 순서

운영 DB 적용은 원칙적으로 사용자가 수행한다. 표형 응답과 학습법 등록 안내 변경은 사용자의 검증 후 적용·커밋 승인 범위에서 에이전트가 수행했다. DB 변경이 없는 코드·문서 정리에 새 migration은 필요하지 않다.

1. 변경 내용을 저장하고 필요하면 운영 백업/복원 지점을 확인한다. 연결 대상과 이력을 점검한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
```

운영 대상은 `epwlcallocdjkmgdmtlv`다. 대기 파일이 해당 변경의 예상 migration과 다르면 적용 전에 이력을 검토한다. `--include-all`, 원격 reset, migration repair로 우회하지 않는다.

2. 확인한 변경을 적용하고 적용 대기가 없음을 재확인한다.

```bash
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --skip-vault
npx supabase migration list --linked --project-ref epwlcallocdjkmgdmtlv
npx supabase db push --linked --project-ref epwlcallocdjkmgdmtlv --dry-run --skip-vault
```

3. 앱을 기존 배포 방식으로 배포하고 열린 탭을 새로고침한다. DB migration → 앱 배포 → 기능 확인 순서다. 실제 운영 답변을 검증 목적으로 삭제하지 않는다.

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

`20261010055936_study_methods.sql` 로컬 적용·검증 완료, 운영 미적용. `study` 테이블과 저장/삭제 RPC, `study-reports` 비공개 버킷, 역할·가이드 참조 RLS, 질문의 `studyRecommended` 및 `kind: study` 검증을 추가한다. 기존 데이터는 변경하지 않는다. 기존 migration을 모두 적용했다면 예상 대기는 이 파일 하나다. 실행 명령·확인 순서는 [학습법 운영 적용](study/operations.md)을 따른다.

학습법 입력 구성 후속 수정: `20261010061957_study_problem_sources.sql` 로컬 적용. 과목 분류의 기타·선택 과목명, 필수 문제 상황 출처(self/student)를 저장한다. 이전 학습법 migration 이후 적용하며 기존 데이터는 삭제하지 않는다. 최신 적용 순서는 [학습법 운영 적용](study/operations.md)을 따른다.

학습법 문제 상황 템플릿 활성화: `20261010072805_study_problem_templates.sql` 로컬 적용. `problemSource=template` 저장을 허용하며 16개 대표 문장을 선택하면 문제 상황 본문에 입력하고 수정할 수 있다. 앞선 학습법 migration 이후 적용하며 운영 절차는 [학습법 운영 적용](study/operations.md)을 따른다.

학습법 선택 제목: `20261010083351_study_optional_title.sql` 로컬 적용. 선택 제목/이름(100자)을 저장하고 없으면 기존 학습 전략을 표시한다. 운영 반영 순서는 [학습법 운영 적용](study/operations.md)을 따른다. 운영 미적용.

## 표형 응답 제작 (2026-10-11)

`20261011143258_question_answer_layouts.sql`은 일반 표/흐름표 표시 설정과 초기 표시 행 수, 열별 필수 여부를 저장한다. 최소 작성 행/시기 수를 검사하고 빈 여분 행은 제출 필수에서 제외한다. 흐름표의 공개 제출에는 빈 시기 자리를 유지하며 비활성 답변 내용은 공개하지 않는다. 기존 권한·배포 잠금·저장 충돌·재시도와 기존 카드/진로 흐름 계약은 유지한다.

2026-10-12 사용자의 승인에 따라 에이전트가 운영에 이 migration 한 개를 영구 적용했다. 운영 함수 정의의 치환 기준 10개가 모두 일치하고 활성 트리거·이벤트 트리거에 외부 웹훅이 없음을 먼저 확인했다. 임시 migration과 신규 `question_answer_layouts.sql` 회귀를 한 트랜잭션에서 수행·롤백한 뒤, `db push`로 적용하고 적용 후에도 신규 SQL 회귀를 성공·롤백했다. 회귀 SQL의 CASE 문법을 수정한 뒤 예행 검증과 적용 후 검증을 모두 통과했다.

최신 운영 이력은 `20261011143258_question_answer_layouts`이며 적용 후 dry-run에 대기가 없다. 운영 가이드 함수 해시 `607716af71009f7941df8fef56b2e443`는 검증과 적용 전후 동일하게 유지됐다. 보안 advisor 경고는 전후 모두 기존 4개이며 새 경고는 없다. 이 해시는 이번 검증 기록이며 다음 작업에서는 사전 조회에서 읽은 값을 사용한다.

앱 타입 검사·변경 파일 린트·관련 JS 회귀 29개·Webpack 빌드는 통과했다. 로컬 Docker/Podman과 PostgreSQL이 없는 실행 환경이므로 **로컬 migration 적용과 SQL 회귀는 미실행**이다. 실제 브라우저 테스트는 하지 않았으며 앱 배포·실사용 기능 확인은 별도 단계다. 로컬 DB가 있는 개발 환경에서 재현하려면 다음을 수행한다. `supabase start`만으로 앱 환경 변수는 바뀌지 않으므로 [로컬 연결](local-supabase.md)을 확인한다.

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
- 안내가 둘 이상이거나 미배치 안내, 부가 설명, 대상 질문지의 기존 세션, 안내 연결 응답/제출 이력이 있으면 migration은 전체 롤백한다. **운영에서 이 오류가 나면 검사나 트리거를 우회하지 않는다.** 해당 이력을 보존하는 별도 이전 검토가 필요하다.
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

운영도 기존 `20261015034458_questionnaire_start_notice.sql`로 전환한다. 원본 제목/서식 본문/버튼 문구를 그대로 옮기고 등록 카드는 보관하며, 일반 첫 질문을 제목/순서만으로 안내로 바꾸지 않는다. 적용 전 기존 안내 질문에 연결된 세션·응답·최종 제출·설명/중복 안내가 있으면 migration 전체가 중단된다. 이 검사를 우회하거나 기존 답변을 삭제하여 적용하지 않는다. 실제 운영 상태가 이 조건에 맞지 않으면 별도 보존 이전을 설계한다.

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
3. 질문지/질문 관련 요청을 차단한 점검 상태에서 DB를 적용한다. 특히 이전 시작 안내 migration의 응답 존재 중단 조건도 그대로 따른다.
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

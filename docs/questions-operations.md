# 질문·질문지 운영과 검증

기능은 [질문·질문지 관리](questions.md), 데이터 구조는 [저장 구조](questionnaire-storage-design.md), 개발 환경은 [로컬 Supabase](local-supabase.md)를 참고한다.

## 현재 적용 상태

2026-10-12 운영 대상 `epwlcallocdjkmgdmtlv`의 최신 이력은 `20261011143258_question_answer_layouts`이며 적용 후 dry-run에 대기 migration이 없음을 확인했다. 사용자의 테스트 성공 후 운영 적용·커밋 승인에 따라 에이전트가 이번 표형 응답 migration 한 개를 적용했다. 적용 전 임시 migration과 신규 SQL 회귀를 단일 트랜잭션에서 시험한 뒤 롤백했고, 영구 적용 후 신규 SQL 회귀도 통과했다. 자세한 검증 결과는 아래 표형 응답 절을 따른다.

아래 날짜별 절과 이전 기록의 ‘운영 미적용/적용 대기’는 당시 상태이며 현재 운영 이력보다 우선하지 않는다. 이번 환경에서 로컬 DB 적용·SQL 회귀는 실행하지 않았고 실제 브라우저 테스트와 앱 배포 확인도 하지 않았다.

과거 migration은 재현용으로 유지한다. 완료된 이전 절차를 재실행하지 않는다. 구형 질문지 import 함수는 폐기됐으며 관련 과거 SQL 스니펫은 현행 실행 안내가 아니다.

## 이후 DB 변경 적용 순서

운영 DB 적용은 원칙적으로 사용자가 수행한다. 이번 표형 응답 변경은 사용자가 테스트 성공 후 운영 적용을 명시적으로 승인하여 에이전트가 수행한 사례다. DB 변경이 없는 코드·문서 정리에 새 migration은 필요하지 않다.

1. 변경 내용을 저장하고 필요하면 운영 백업/복원 지점을 확인한다. 연결 대상과 이력을 점검한다.

```bash
cd /Users/jwg/MEA-System
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

- `supabase/tests/guide_answer_field_changes.sql`
- `supabase/tests/guide_question_removal.sql`
- `supabase/tests/question_responses.sql`
- `supabase/tests/published_live_layout.sql`
- `supabase/tests/question_response_conditions.sql`
- `supabase/tests/question_response_types.sql`
- `supabase/tests/distributed_response_path.sql`
- `supabase/tests/questionnaire_distribution_withdrawal.sql`
- `supabase/tests/questionnaire_locked_distribution.sql`
- `supabase/tests/distributed_response_submissions.sql`

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

`20261010055936_study_methods.sql` 로컬 적용·검증 완료, 운영 미적용. `study` 테이블과 저장/삭제 RPC, `study-reports` 비공개 버킷, 역할·가이드 참조 RLS, 질문의 `studyRecommended` 및 `kind: study` 검증을 추가한다. 기존 데이터는 변경하지 않는다. 기존 migration을 모두 적용했다면 예상 대기는 이 파일 하나다. 실행 명령·확인 순서는 [학습법 운영 적용](study-methods.md#운영-적용-순서)을 따른다.

학습법 입력 구성 후속 수정: `20261010061957_study_problem_sources.sql` 로컬 적용. 과목 분류의 기타·선택 과목명, 필수 문제 상황 출처(self/student)를 저장한다. 이전 학습법 migration 이후 적용하며 기존 데이터는 삭제하지 않는다. 최신 적용 순서는 [학습법 운영 적용](study-methods.md#운영-적용-순서)을 따른다.

학습법 문제 상황 템플릿 활성화: `20261010072805_study_problem_templates.sql` 로컬 적용. `problemSource=template` 저장을 허용하며 16개 대표 문장을 선택하면 문제 상황 본문에 입력하고 수정할 수 있다. 앞선 학습법 migration 이후 적용하며 운영 절차는 [학습법 운영 적용](study-methods.md#운영-적용-순서)을 따른다.

학습법 선택 제목: `20261010083351_study_optional_title.sql` 로컬 적용. 선택 제목/이름(100자)을 저장하고 없으면 기존 학습 전략을 표시한다. 운영 반영 순서는 [학습법 운영 적용](study-methods.md#운영-적용-순서)을 따른다. 운영 미적용.

## 표형 응답 제작 (2026-10-11)

`20261011143258_question_answer_layouts.sql`은 일반 표/흐름표 표시 설정과 초기 표시 행 수, 열별 필수 여부를 저장한다. 최소 작성 행/시기 수를 검사하고 빈 여분 행은 제출 필수에서 제외한다. 흐름표의 공개 제출에는 빈 시기 자리를 유지하며 비활성 답변 내용은 공개하지 않는다. 기존 권한·배포 잠금·저장 충돌·재시도와 기존 카드/진로 흐름 계약은 유지한다.

2026-10-12 사용자의 승인에 따라 에이전트가 운영에 이 migration 한 개를 영구 적용했다. 운영 함수 정의의 치환 기준 10개가 모두 일치하고 활성 트리거·이벤트 트리거에 외부 웹훅이 없음을 먼저 확인했다. 임시 migration과 신규 `question_answer_layouts.sql` 회귀를 한 트랜잭션에서 수행·롤백한 뒤, `db push`로 적용하고 적용 후에도 신규 SQL 회귀를 성공·롤백했다. 회귀 SQL의 CASE 문법을 수정한 뒤 예행 검증과 적용 후 검증을 모두 통과했다.

최신 운영 이력은 `20261011143258_question_answer_layouts`이며 적용 후 dry-run에 대기가 없다. 운영 가이드 함수 해시 `607716af71009f7941df8fef56b2e443`는 검증과 적용 전후 동일하게 유지됐다. 보안 advisor 경고는 전후 모두 기존 4개이며 새 경고는 없다. 이 해시는 이번 검증 기록이며 다음 작업에서는 사전 조회에서 읽은 값을 사용한다.

앱 타입 검사·변경 파일 린트·관련 JS 회귀 29개·Webpack 빌드는 통과했다. 로컬 Docker/Podman과 PostgreSQL이 없는 실행 환경이므로 **로컬 migration 적용과 SQL 회귀는 미실행**이다. 실제 브라우저 테스트는 하지 않았으며 앱 배포·실사용 기능 확인은 별도 단계다. 로컬 DB가 있는 개발 환경에서 재현하려면 다음을 수행한다. `supabase start`만으로 앱 환경 변수는 바뀌지 않으므로 [로컬 연결](local-supabase.md)을 확인한다.

```bash
cd /Users/jwg/MEA-System
npx supabase start
npx supabase migration list --local
npx supabase db push --local --dry-run --skip-vault
npx supabase db push --local --skip-vault
docker exec -i supabase_db_system psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/question_answer_layouts.sql
```

새 SQL 회귀는 전체 트랜잭션을 롤백하며 가상 계정과 질문지·응답만 사용한다. 기존 `distributed_response_submissions.sql`·`question_responses.sql`·`question_response_conditions.sql`도 운영에서 순차 실행·롤백하여 모두 통과했고, 매번 운영 가이드 함수 해시 원복을 확인했다. `question_responses.sql`의 배포 전 가이드 조회 검사는 현행 정책에 맞춰 RPC 거절 대신 빈 객체 반환을 검사하도록 수정했다. 로컬 DB가 없는 이번 환경에서는 이를 로컬 검증 통과로 간주하지 않는다.

일반 운영 적용 순서는 프로젝트 경로 이동 → 연결 대상·이력 확인 → dry-run/예상 파일 확인 → 실제 적용 → 대기 없음 확인 → 앱 배포 → 기능 확인이다. 이번 DB 적용은 완료됐으므로 아래 명령으로 대기 없음만 다시 확인하고 이미 적용한 파일을 재실행하지 않는다.

```bash
cd /Users/jwg/MEA-System
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
cd /Users/jwg/MEA-System
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

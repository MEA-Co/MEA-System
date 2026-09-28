# 운영의 기존 서술형 질문지 이전

사용자가 제공한 운영 조회 결과: 버전 `dbc59647-e728-4d17-b312-b12fd2c8cd82`, published, 보관 안 됨, 일반 서술형 질문 16개, 응답 세션 0개, 답변 0개. 운영 원문은 내려받지 않았다.

## 결과와 범위

기존 질문지·섹션·질문·설명·검토 기록은 그대로 두고, 독립 질문 16개 및 새 질문지 초안 1개를 생성한다. 새 제목은 `기존 제목 · 전환본`이다. 기존 작성자를 질문 원본과 새 질문지의 작성자로 유지하므로 해당 작성자 계정의 작업 중인 질문지 목록에서 확인한다.

각 질문은 서술형 답변 열 `답변` 하나, 단일 행, 조건·참조 없음으로 변환한다. 문구가 같은 질문도 기존 질문 ID별로 분리한다. 본문은 RichText 저장 문자열과 공백까지 그대로 보존한다. 설명은 새 질문 원본의 `question_details`로 옮기고, 배치의 설명에 중복 저장하지 않는다. 섹션/질문 순서와 설명 순서·공개 여부를 유지한다. 새 배포와 답변 수집은 아직 지원하지 않는다.

`private.legacy_questionnaire_imports`에 기존 버전/섹션/질문/설명 ID와 새 질문지/섹션/질문/열/배치/설명 ID의 대응을 기록한다. 설명 작성자 ID도 이력에 보존한다. 원문·답변 본문은 이력 테이블에 복제하지 않는다. 대응 기록에는 의도적으로 FK를 두지 않아 이후 문서 삭제를 막지 않으며 기록은 삭제 후에도 남는다. 삭제된 이전 결과를 다시 실행해 몰래 복구하지 않는다.

## 준비된 파일

- 도구 설치 migration: `supabase/migrations/20260928042153_import_legacy_text_questionnaire.sql`
- 읽기 전용 사전 검사: `supabase/snippets/legacy-questionnaire-import-check.sql`
- 실행 후 전부 롤백하는 예행연습: `supabase/snippets/legacy-questionnaire-import-dry-run.sql`
- 실제 이전: `supabase/snippets/legacy-questionnaire-import-apply.sql`
- 읽기 전용 사후 비교: `supabase/snippets/legacy-questionnaire-import-verify.sql`
- 로컬 회귀: `supabase/tests/import_legacy_text_questionnaire.sql`

migration은 운영자 전용 테이블·함수만 설치한다. 운영 데이터를 자동으로 복사하지 않는다. `SECURITY INVOKER` 함수이며 PUBLIC/anon/authenticated/service_role에는 실행 권한이 없다. 앱의 실제 관리자도 앱 RPC로는 호출할 수 없고, 운영 SQL Editor의 postgres 역할에서 실행한다. 기존 인증·권한·불변성 트리거는 비활성화하지 않는다.

## 사용자가 운영에서 실행할 순서

1. SQL Editor에서 `legacy-questionnaire-import-check.sql` 전체 실행. 한 행이며 `ready_to_import=true`인지 확인한다. false거나 결과가 없으면 진행하지 않는다. 질문 10,000자, 설명 제목 200자/본문 10,000자, 질문당 설명 20개 제한을 넘으면 내용을 자르지 말고 별도 처리한다.
2. 터미널에서 `npx supabase db push --linked --dry-run --skip-vault` 실행. 새 도구 설치 migration 하나만 대기 중인지 확인한다. 다르면 운영 적용 전에 이력을 검토한다.
3. `PGOPTIONS='-c lock_timeout=5s -c statement_timeout=60s' npx supabase db push --linked --skip-vault` 실행. 이 단계는 함수 설치일 뿐 질문 복사는 아직 없다.
4. SQL Editor의 postgres 역할에서 `legacy-questionnaire-import-dry-run.sql` 전체 실행. 성공 결과는 `status=imported`, `questions=16`이며 마지막은 ROLLBACK이다. 여기서 받은 ID는 폐기된다.
5. 예행연습이 성공하면 `legacy-questionnaire-import-apply.sql` 전체 실행. 성공 시 COMMIT되며 원본 ID는 그대로, 대상 초안 ID는 결과의 `targetVersionId`다. 재실행하면 `already_imported`로 같은 ID를 반환하고 데이터는 추가하거나 덮어쓰지 않는다.
6. `legacy-questionnaire-import-verify.sql` 전체 실행. 배치 16개, 예상 설명 수, 모든 비교 결과 true인지 확인한다. 원본이 이후 수정됐거나 새 초안을 편집한 뒤에는 비교 결과가 달라질 수 있으므로 바로 검증한다.
7. 기존 작성자 계정으로 질문 관리의 새 질문 16개, 질문지 관리의 작업 중인 전환본, 섹션·질문·설명의 순서와 서식을 확인한다. 기존 게시본을 삭제하거나 보관하지 않는다.

이번 작업에는 앱 코드 변경이 없어 앱 재배포가 필요하지 않다. migration과 검사 SQL은 저장소에 함께 커밋해 보관한다. 운영 실행과 화면 확인은 사용자가 수행하며 이 문서 작성 시 운영 실행은 하지 않았다.

## 안전장치와 검증

- 원본 저장/게시와 같은 advisory lock과 원본 버전·부모·하위 행 잠금을 사용한다. 트랜잭션 안에 사용자 대기나 외부 네트워크 작업이 없다.
- 상태, 질문 수, 서술형 여부, 이미 배치된 질문 여부, 응답 유무, 작성자 역할, 길이 제한을 재검사한다. 원본의 운영 상태가 달라지면 중단한다.
- 원본의 버전/부모/섹션/질문/설명 전체 행을 메모리에서 전후 비교하며, 원본 데이터는 수정하지 않는다.
- 로컬에서는 가상 질문지 16개 질문·32개 설명·빈 섹션을 포함한 3개 섹션으로 검증한다. 동일 문구 질문 분리, 공백과 줄바꿈 보존, ID 연결, 작성자 조회·후속 저장, 재실행 시 편집 보존, 오류 시 원자적 롤백, 일반 앱 역할 접근 차단을 검증한다.
- 실제 운영 데이터의 길이·설명 수·작성자 역할은 아직 조회하지 않았으며 사전 검사와 운영 예행연습에서 확인한다.

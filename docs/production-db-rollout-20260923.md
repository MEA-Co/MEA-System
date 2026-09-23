# 2026-09-23 프로덕션 DB 반영

대상은 연결된 Supabase 프로젝트 `epwlcallocdjkmgdmtlv`다. 사용자 요청에 따라 DB만 반영했으며 Git commit/push는 실행하지 않았다.

## 반영 범위

- 기존 운영 객체와 로컬 정의·제약·인덱스·권한이 동일한 전공 검색 migration 3건(`20260915042403`, `20260915053905`, `20260915062408`)과 가치관 복구 1건(`20260918090456`)은 `migration repair --status applied --linked`로 이력만 보완했다. 해당 SQL은 재실행하지 않았다.
- `20260923042351`부터 `20260923085519`까지 새 migration 13건을 파일 순서대로 적용했다. 척도 설정, 선택지 표시/직접 입력/추가 서술, 질문 관리 독립 테이블 및 이름 변경, 선택적 관리 이름, 질문 설명, 응답·선택지·열 조건 참조를 포함한다.
- 최종 로컬·운영 이력은 47건이다. `db push --linked --dry-run --skip-vault`가 적용 대기 없음으로 종료했다.
- 운영 데이터나 로컬 seed를 덮어쓰지 않았다. 로컬에서 작성한 질문은 이전하지 않았으며 새 운영 `questions`, `question_details`는 각각 0건이다.

## 검증

1. `public`, `private` 스키마를 로컬/운영에서 추출해 비교했다. 기존 전공·가치관 구조는 동일하고 차이는 질문 기능 및 운영 전용 `public.rls_auto_enable()`에 한정됨을 확인했다.
2. 실제 데이터가 없는 별도 로컬 DB에 운영 앱 스키마와 로컬 플랫폼 스키마를 복원했다. 13개 migration을 순서대로 실행하고 질문·답변·권한 SQL 회귀를 확인했다. 검증 DB는 종료 후 삭제했다.
3. 운영에서 같은 13개 SQL을 `BEGIN`, `SET LOCAL lock_timeout='5s'`, `SET LOCAL statement_timeout='60s'` 안에서 실행한 후 `ROLLBACK`했다. 성공 후 신규 테이블과 열이 남지 않았고 기존 migration 이력 30건이 유지됨을 확인했다.
4. 기존 적용분 이력 보완 후 dry-run에서 새 13건만 대상임을 확인했다. `PGOPTIONS='-c lock_timeout=5s -c statement_timeout=60s'`와 `db push --linked --skip-vault --yes`로 적용했다. 역할·seed·Vault는 적용하지 않았다.
5. 적용 전후 기존 앱 테이블 32개의 행 수와 기존 열 내용의 정렬된 해시가 전부 일치했다. 추가된 `scale_config`, `choice_style`, `choice_allow_text`만 해시 대상에서 제외했으며 새 열의 NULL 누락은 0건이다. 원본 행 데이터는 추출하지 않았다.
6. 적용 후 앱 스키마는 로컬과 일치한다. 운영 전용 `rls_auto_enable` 함수와 해당 소유권/권한 정의만 기존 차이로 유지했다.
7. 로컬·운영 DB lint 오류 0건. 새 테이블 RLS 활성화, anon 읽기 불가, authenticated 직접 INSERT/UPDATE/DELETE 불가, anon 질문 저장·보관 RPC 실행 불가를 확인했다.
8. 저장 회귀 테스트는 읽기 응답에 추가된 기본 설정을 명시적으로 검증하도록 보완했다. 구형 요청의 저장 허용, 기본 설정 반환, 질문/설명 내용과 ID 유지 검사가 로컬과 운영 재현 DB에서 통과했다. 로컬 SQL 검증은 보완 후 20/21개가 통과하며 아래 기존 삭제 오류 1건은 남는다.

## 기존 문제와 한계

- `questionnaire_published_deletion.sql`의 미완료 답변이 있는 게시 질문지 삭제 실패는 변경 전 운영 스키마에서도 동일하게 재현된다. `private.guard_submitted_answers`의 DELETE 반환값 문제이며 이번 migration으로 변경되지 않는다. 별도 수정이 필요하다.
- 운영 보안 advisor의 기존 경고(`rls_auto_enable`의 anon/authenticated 실행 권한, `update_consultant_role`의 authenticated SECURITY DEFINER 실행, 유출 비밀번호 보호 비활성)는 전후 동일하다. 새 경고는 없으며 이번 반영에서 기존 설정을 변경하지 않았다.
- 실제 브라우저 테스트와 새 앱 코드 배포는 수행하지 않았다. 앱 배포는 별도 Git push 이후 단계다.
- 자동 승인 검토가 인증·사용자 데이터를 로컬에 저장하는 전체 데이터 백업을 거부했으므로 해당 덤프는 실행하지 않았다. 스키마 백업과 트랜잭션 검증으로 진행했으며 데이터 복구용 전체 백업을 만들었다고 간주하면 안 된다.

## 증적 및 복구 원칙

Git 제외 경로 `supabase/.temp/production-rollout-20260923/`에 변경 전후 스키마, 데이터 건수·해시 비교 결과, migration SHA-256 목록, 운영 롤백 검증 결과를 보관했다. 민감한 사용자/인증 데이터 행은 포함하지 않는다. 스키마 원본은 `production-before-schema.sql`, 적용 결과는 `production-after-schema.sql`, 검증 요약은 `verification-summary.json`이다.

기존 열과 데이터는 유지하고 추가 열·독립 테이블·함수 정의만 변경했으므로 우선 코드 호환성 확인 및 전진 수정 migration으로 복구한다. 스키마 덤프를 그대로 운영에 실행하거나 원격 reset/이력 revert만으로 되돌리지 않는다. 신규 기능 사용 후 테이블/열을 제거하면 새 데이터가 손실될 수 있으므로 복구 시점에 다시 범위를 검토한다.

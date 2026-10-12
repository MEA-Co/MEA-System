# 학습법 개편 운영 적용 절차

## 적용 대상과 데이터 보존

예상 프로젝트: `epwlcallocdjkmgdmtlv`.
예상 migration: **`20261012024650_study_solution_fields.sql` 한 개**.
2026-10-12 확인 당시 운영 최신 이력은 `20261012011802`이며 dry-run에 위 파일만 표시됐다. 운영에는 아직 적용하지 않았다.

마이그레이션은 한 트랜잭션에서 다음을 수행한다.

1. 기존 저장 함수 해시가 `712012985cb0d8e2b7321198e6967ebc`인지 검사한다. 예상 밖 수정이 있으면 중단한다.
2. 쓰기를 잠시 잠근 뒤 모든 학습법 행을 `private.study_solution_backup_20261012`에 원형 그대로 보관한다. 일반 사용자·서비스 역할은 이 백업 테이블을 읽을 수 없다.
3. 활성 행에 경험 `''`, 기간 설정 `true`를 추가하고 출처 `student`를 `self`로 통합한다. 문제·전략·기간·체크리스트·기존 진단·첨부·ID·소유자·생성 시각을 유지한다. 삭제된 행은 변경하지 않는다.
4. 활성 행의 revision을 1 올리고 save ID·수정 시각을 갱신해 배포 전 편집본이 덮어쓰지 못하게 한다.
5. 조건부 기간 필수 검사, 경험 저장, 기존 클라이언트의 새 필드 생략 호환을 제공하는 저장 함수를 교체한다. 기존 역할·RLS·Storage 정책은 변경하지 않는다.

체크리스트는 문자열/줄바꿈 형식을 그대로 사용하므로 배열로 변환하거나 원문을 다시 생성하지 않는다. 기존 서술형 문제 상황도 임의로 요약하지 않는다. 20개 템플릿은 앱 코드에 있고 기존 작성 내용을 덮어쓰지 않는다.

## 1. 작업 시간 확보와 백업

배포 동안 학습법 작성·저장을 중지하도록 사용자에게 안내하고 편집 탭을 닫는다. 새 필드가 추가되므로 **DB 적용 후 구버전 앱을 장시간 운영하지 않는다**. DB 적용과 새 앱 배포를 같은 작업 시간에 진행한다.

미저장 작성 내용은 별도로 복사한다. 브라우저 임시저장은 서버 백업 대상이 아니므로 localStorage/IndexedDB를 지우지 않는다. 특히 확정본을 수정하던 임시저장은 기존 revision이어서 적용 후 충돌할 수 있다. 최신 확정본을 다시 열고 보관한 변경분을 옮겨 저장한다. 오래된 revision을 강제로 덮어쓰지 않는다.

프로젝트와 이력 확인:

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase projects list
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

프로젝트 ID를 Dashboard와 대조한다. **예상과 다른 migration이 나오면 적용하지 말고 먼저 이력을 검토한다.** `--include-all`, 원격 reset, `migration repair`로 우회하지 않는다.

Dashboard에서 최근 백업/PITR 복구 가능 시점을 확인한다. 추가로 저장 경로를 Git 저장소 밖에 만들고 schema와 data를 내보낸다. 아래는 public/private 전체 백업이며 개인정보가 포함되므로 공유하거나 커밋하지 않는다. CLI dump는 로컬 Docker가 필요하다.

```bash
umask 077
MEA_STUDY_BACKUP_DIR="$HOME/MEA-backups/study-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$MEA_STUDY_BACKUP_DIR"
npx supabase db dump --linked --schema public,private --file "$MEA_STUDY_BACKUP_DIR/schema.sql"
npx supabase db dump --linked --schema public,private --data-only --use-copy --file "$MEA_STUDY_BACKUP_DIR/data.sql"
test -s "$MEA_STUDY_BACKUP_DIR/schema.sql" && test -s "$MEA_STUDY_BACKUP_DIR/data.sql"
```

덤프 완료 여부와 `public.study` 데이터 포함 여부를 확인한 뒤 진행한다. 이 덤프는 Storage 파일 원본이나 auth 전체 복구용 백업이 아니다. 이번 작업은 파일을 삭제하지 않으며 전체 복구는 Dashboard 백업/PITR 정책과 함께 준비한다.

SQL Editor에서 `supabase/verification/study_solution_preflight.sql`을 실행하고 집계 결과를 기록한다. 함수 해시가 위 값과 같아야 하며 `unexpected_new_fields`는 0이어야 한다. 달라졌다면 중단하고 검토한다. 현재 관측치 1건을 고정 전제로 적용하지 않는다.

## 2. 실제 DB 적용

백업·쓰기 중지·dry-run 확인이 끝났을 때만:

```bash
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

적용 파일은 위 한 개, 적용 후 대기는 없어야 한다. `--skip-vault`는 무관한 Vault 설정 동기화를 방지한다. lock timeout이 나면 트랜잭션이 롤백되므로 진행 중인 쓰기와 이력을 확인한 뒤 재시도한다. 파일 내부의 BEGIN/COMMIT을 제거하지 않는다.

아직 사용자 쓰기를 재개하지 말고 SQL Editor에서 `supabase/verification/study_solution_postflight.sql`을 실행한다.

- backup_rows: 사전 전체 행 수와 동일
- mismatched_rows: **0** (본문·파일·소유자·생성 시각 및 예상 revision 포함 비교)
- invalid_active_rows: **0**
- save_hash: **`907172de62fb8f1e438e9833d5a1921d`**
- public_backup_grants: **0**

새 쓰기가 시작된 후에는 snapshot과 달라지는 것이 정상이다. 이 전체 비교는 배포 직후 쓰기를 재개하기 전에 실행한다.

## 3. 앱 배포와 확인

```bash
npm run build -- --webpack
```

검증된 변경을 기존 운영 배포 파이프라인으로 배포한다. 이 저장소에서 위 build 명령만 실행하는 것은 운영 배포가 아니다. 서버·브라우저 모두 새 버전을 사용하도록 새로고침한다.

운영에서 작성자 계정으로 다음을 확인한 후 쓰기를 재개한다.

- 기존 학습법 1건 이상의 문제·전략·체크리스트·기간 내용과 소유자가 유지되는지
- 출처가 통합 선택지로 표시되고, 템플릿 목록이 20개이며 제외한 두 항목 및 과목 공통 4개가 없는지
- 경험 입력 저장 → 새로고침 → 상세/수정에서 유지되는지
- 기간 체크 해제·빈 기간으로 저장, 재조회 후 해제 상태 유지, 다시 체크하면 기간 필수 검사되는지
- 체크리스트 항목 추가·삭제·수정 후 재조회 시 항목이 유지되는지
- 기존 @학습법 참조가 같은 ID의 학습법을 여전히 여는지
- 타인의 학습법 수정 불가, 자신의 학습법 수정 가능
- 삭제한 UI 항목의 과거 데이터·첨부 파일이 DB/Storage에서 유지되는지

이 단계는 사용자가 수행할 실제 기능 확인이며 에이전트가 브라우저에서 확인한 것으로 간주하지 않는다.

## 4. 이상 발생 시

쓰기 재개를 멈추고 오류·대상 ID·현재 revision을 기록한다. UI 문제만이라도 구버전 앱을 무조건 배포하지 않는다. 구버전의 strict schema가 추가 필드를 거부할 수 있다.

마이그레이션 실행 실패는 동일 트랜잭션에서 롤백된다. 이력과 함수 해시를 확인하고 원인을 해결한 뒤 다시 적용한다. 이미 성공한 migration을 삭제하거나 repair로 미적용 처리하지 않는다.

성공 후 문제가 발견되면 **수정 migration으로 전진 복구하는 것을 우선**한다. 원본은 private 백업에 있으며 SQL Editor 관리자만 특정 ID의 `row_data`를 조회해 비교할 수 있다. 백업에서 일괄 UPDATE하거나 전체 dump를 운영에 바로 복원하면 배포 후 작성한 데이터를 잃을 수 있다.

되돌리기가 꼭 필요하면 먼저 현재 데이터·경험·기간 설정과 신규 작성 행도 별도로 백업한다. 수정 여부를 revision으로 비교하고, 변경된 행은 기존 snapshot으로 덮어쓰지 않는다. DB 함수와 앱의 읽기/쓰기 형식을 함께 맞추는 별도 rollback migration을 리뷰한 후 적용한다. PITR은 전체 서비스의 이후 변경까지 되돌리므로 학습법 단건 문제의 기본 복구 수단으로 사용하지 않는다.

private 백업 테이블은 기능 확인과 보존 기간 합의가 끝날 때까지 유지한다. 자동 삭제 작업은 만들지 않았다.

## 로컬 회귀 재실행

migration 적용 전의 로컬 DB에서는 `node scripts/verify-study-migration.mjs`로 가상 기존 데이터의 이전 보존을 시험하고 전부 롤백한다. 이미 적용된 로컬 DB에서는 기존 함수 해시 검사로 중단하는 것이 정상이며 재시험 목적으로 운영/로컬 데이터를 reset하지 않는다.

```bash
node --test scripts/verify-study-templates.mjs
MEA_TEST_BLOCK=study node --test scripts/verify-exploration-storage.mjs scripts/verify-question-study.mjs
docker exec -i supabase_db_system psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/study_solution_fields.sql
docker exec -i supabase_db_system psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/study_storage.sql
docker exec -i supabase_db_system psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/study_guide_reference.sql
```

공식 참고: [Supabase migration 관리](https://supabase.com/docs/guides/deployment/database-migrations).

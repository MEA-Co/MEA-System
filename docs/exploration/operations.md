# 탐구활동 운영·검증

[현재 계약](data-api.md)과 [UI](ui.md)를 함께 참고한다. 디자인과 DB 변경의 운영 배포는 전체 작업 마지막에 진행한다.

## 운영 사전 점검 (2026-10-15)

운영 이력·dry-run에서 `20261013094552_exploration_query_contract.sql`이 대기 중임을 확인했다. 조회 함수 추가로 기존 탐구활동 확정 데이터와 파일을 수정하지 않는다. 비교 기준 `203e7ee`의 임시저장 코드로 만든 가상 초안을 현재 코드로 읽어 본문·참고자료·ID·revision·localVersion·첨부 메타데이터/원문 보존을 확인했다. 임시저장·편집 복구·저장 후 갱신 검사를 다시 통과했으며 실제 사용자 브라우저 저장소는 조회하지 않았다. **질문지 시작 안내의 보존 이전은 수정·로컬 검증했고, 열린 구형 응답 화면 문제는 코드 수정 없이 작성자가 없는 새벽 전환으로 대응하기로 했다.** [최종 사전 점검](../questions/operations.md#최종-사전-점검-2026-10-15)을 먼저 따르며 아래 과거 실제 적용 명령을 바로 실행하지 않는다. 운영 DB 변경·앱 배포는 하지 않았다.

## 서버 조회 함수 적용 상태 (2026-10-13)

Migration: `20261013094552_exploration_query_contract.sql`. 함수 2개만 추가한다. 로컬 적용·검증 완료, 운영 미적용이며 다른 디자인 변경과 최종 배포 시 함께 적용한다.

타입 검사·변경 파일 린트·Webpack 빌드·관련 JS 31개 통과. 실제 로컬 컨설턴트/리드의 인증 PostgREST 조회도 통과했다. `supabase/tests/exploration_queries.sql`은 페이지·초안 혼합 경계·특수문자/참고자료 검색·역할별 조회·ACL, `exploration_activity_storage.sql`은 기존 저장/파일 권한 회귀를 검증했고 가상 데이터는 모두 롤백했다. 로컬 security advisor 경고 없음, 로컬 dry-run 대기 없음. 실제 브라우저 테스트·운영 조회/변경·앱 배포는 수행하지 않았다.

공식 근거: [Supabase 함수와 실행 권한](https://supabase.com/docs/guides/database/functions).

## 최종 배포 순서

아래는 **최종 배포 때** 실행한다. 이번 작업에서는 운영에 실행하지 않았다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

의도한 운영 대상 `epwlcallocdjkmgdmtlv`인지 확인한다. 이번 신규 파일은 `20261013094552_exploration_query_contract.sql`이다. 앞서 학습법 조회 `20261013085231_study_query_contract.sql`도 아직 미적용이면 함께 대기한다. **예상과 다른 migration이 나오면 적용 전에 이력과 해당 변경을 검토한다.** `--include-all`/remote reset/repair로 우회하지 않는다.

```bash
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
npm run build -- --webpack
```

적용 대기가 없음을 확인한 뒤 기존 배포 절차로 앱을 배포한다(위 build 명령만으로 배포되지는 않는다). DB 함수를 먼저 적용해야 새 앱의 조회가 동작한다. 배포 후 10개 초과 목록·검색/작성자 필터·삭제 후 마지막 페이지 보정·초안/확정본 병합·질문 첨부 검색과 기존 선택 유지·일반 컨설턴트의 타인 목록 차단을 확인한다.

아래 최초 저장/역할별 확대 기록은 과거 구현 시점의 기록이며 이번 신규 함수의 적용 절차로 재실행하지 않는다.


## 로컬 검증

```bash
node --test scripts/verify-exploration-storage.mjs scripts/verify-exploration-pagination.mjs scripts/verify-exploration-list-cache.mjs scripts/verify-exploration-selection.mjs scripts/verify-exploration-list.mjs scripts/verify-exploration-save-refresh.mjs
MEA_TEST_BLOCK=study node --test scripts/verify-exploration-storage.mjs
npm run typecheck
npm run build -- --webpack
```

로컬 DB가 실행 중일 때 가상 데이터 롤백 회귀:

```bash
docker exec -i supabase_db_system psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/exploration_activity_storage.sql
docker exec -i supabase_db_system psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/exploration_queries.sql
```

실제 로컬 Storage 통합 검증은 `scripts/verify-exploration-storage-local.mjs`, 인증 조회는 `node scripts/verify-exploration-pagination.mjs --local`을 사용한다. 생성하는 테스트 사용자/파일의 정리를 확인한다. 브라우저 테스트는 명시적 요청이 있을 때만 수행한다.

## 2026-10-14 수정·구조 정리

전체 크기 제한을 업로드 전/API에 추가하고 임시 첨부 정리를 수정했다. 타입/내부 이름/파일 경로 변경이며 DB 스키마·RPC·RLS·기존 저장 키는 변경하지 않았다. **새 migration은 없다.** 운영 반영/브라우저 테스트는 수행하지 않았다. 타입 검사·변경 파일 린트·Webpack 빌드 통과. 탐구활동 JS 33개와 같은 검증 도구의 학습법 JS 20개(총 53개), 로컬 저장/조회 SQL 2개 통과·가상 데이터 전체 롤백. 크기 경계/업로드 전 차단/파일 정리/저장 실패와 탭 충돌의 보존을 검증했다. 실제 IndexedDB 브라우저 조작 검증은 수행하지 않았다.

## 기존 운영·복구 주의점

- 최초 저장: `20260928100109_exploration_activity_storage.sql`, 이름 변경: `20260928101208_rename_exploration_activity_storage.sql`, 리드·관리자 공유: `20260929050548_exploration_staff_read.sql`, 가이드 참조: `20261006031716_guide_exploration_reference_read.sql`. 과거 미적용 기록을 현재 운영 이력으로 간주하지 않는다. 이번 작업은 운영 이력을 재조회하지 않았다.
- 비공개 exploration-reports 버킷과 파일당 20MiB 제한, 앱의 Supabase 환경 변수, 전역 업로드 한도를 확인한다. 임의로 버킷을 공개하거나 서비스 키를 브라우저에 전달하지 않는다.
- 로컬 이력 복구의 과거 repair 명령은 재실행하지 않는다. [로컬 환경](../local-supabase.md)과 실제 이력을 먼저 확인한다.
- 실패한 확정에서 남은 원격 파일은 비공개일 수 있다. 활성 reports에 없는 오래된 객체를 검토한 후 Storage API로만 정리한다. storage.objects 직접 DELETE/일괄 브라우저 초기화는 하지 않는다.
- 배포 후 큰 본문 거절/입력 유지, 첨부 임시저장 후 제거·삭제, 타 탭 충돌, 기존 초안 복원, 파일 다운로드, 권한별 목록/수정·삭제 차단을 확인한다.

## 신규 작성 새로고침 복원 (2026-10-14)

앱 코드와 브라우저 저장만 변경했다. DB/API/migration 변경 및 운영 반영 없음. `scripts/verify-exploration-editor-session.mjs`는 URL 유지/해제, 신규 창 복원, dirty 기준 보존, 첨부 복구, 계정/환경 분리, 저장 공간 실패, 손상 정보 보존, 늦은 파일 쓰기/닫기 순서, 질문 첨부 선택 제외를 검증한다.

```bash
node --test scripts/verify-exploration-editor-session.mjs scripts/verify-exploration-save-refresh.mjs scripts/verify-exploration-storage.mjs
npm run typecheck
```

새로고침 복원·기존 저장/파일 회귀 32개, 타입 검사·변경 파일 린트 통과. 실제 브라우저 테스트와 운영 반영은 수행하지 않았다.

## 질문 독립 첨부형 제거 (2026-10-14)

질문 유형 폐기 및 기존 답변의 본문 참조 전환 migration 두 개를 로컬에 적용했다. 도메인 원본·파일은 삭제하지 않는다. 운영 미적용이며 전체 개선 완료 후 [질문 운영 문서](../questions/operations.md#독립-첨부형-제거와-본문-참조-전환-2026-10-14)의 사전 점검·적용·앱 배포 순서를 따른다.

## 업무 충돌 무한 재시도 수정 (2026-10-16)

저장·삭제 함수의 업무 충돌을 SQLSTATE `PGRST` / HTTP 409 / JSON code `40001`로 전달하도록 로컬과 운영에 적용했다. 데이터·권한·revision 검사는 유지한다. 운영에는 공통 긴급 수정 SQL만 실행했고 다른 대기 migration·앱 배포는 진행하지 않았다. 정확한 적용 이력과 다음 배포 순서는 [질문 운영 문서](../questions/operations.md#업무-충돌-무한-재시도-긴급-수정-2026-10-16)에 모은다.

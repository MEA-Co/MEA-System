# 서비스 공지 검증·운영

## 변경과 상태 (2026-10-16)

`20261016010233_service_announcements.sql`은 공지 singleton 테이블/RLS/갱신 트리거/Realtime publication만 추가한다. 기존 질문·질문지·응답·임시저장 데이터와 migration 파일은 변경하지 않는다. 초기 공지는 비활성이다. SQL 적용은 트랜잭션, lock_timeout 5초/statement_timeout 30초다.

로컬에 적용했다. 운영 적용·실제 브라우저 테스트는 수행하지 않았다. 공지를 올려서 사용자에게 전달하는 행위도 수행하지 않았다.

## 검증

```bash
npm run typecheck
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-announcements.mjs scripts/verify-dashboard-access.mjs
docker exec -i supabase_db_system psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/service_announcements.sql
npx supabase db advisors --local --type security --level warn
```

SQL은 가상 회원 4역할로 조회/수정 권한, 관리자 변경, stale revision 거절, 기간·빈 내용 제약, 종료, Realtime publication 등록을 검증하고 전체 롤백한다. 실제 Realtime 전송/화면 조작은 브라우저 검증을 별도로 요청받을 때 수행한다.

검증 결과: 타입 검사·변경 파일 린트·JS 5개·로컬 SQL 권한 회귀 통과. 로컬 security advisor 경고/오류 없음. SQL 테스트는 CLI 다중 명령 제한 때문에 위 psql 방식으로 실행했다.

## 운영 적용 순서

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 예상 파일과 이력을 검토한 뒤에만 실행
npx supabase db push --linked
npx supabase db push --linked --dry-run
```

연결된 운영 대상은 `epwlcallocdjkmgdmtlv`인지 확인한다. 공지 신규 파일은 `20261016010233_service_announcements.sql`이다. 기존 미적용 migration 15개가 아직 남아 있다면 함께 표시되므로 [질문 운영 문서](../questions/operations.md)의 전체 배포 절차·예상 목록과 대조한다. 이번 작업에서 운영 이력을 재조회하지 않았으므로 적용 시 최신 이력을 기준으로 한다. 예상과 다른 파일/이력이 나오면 적용 전에 검토하며 remote reset/임의 repair를 하지 않는다.

대기 없음 확인 후 앱을 배포하고, 관리자 메뉴·일반 회원 수정 차단·공지 표시/변경/종료·예약·열린 Drawer와 응답 입력 보존·연결 복구를 확인한다. 이후 공지 문구 변경에는 재배포가 필요 없다.

**최초 도입 시 주의:** 이미 열린 구버전 앱에는 공지 수신 코드가 없다. 첫 배포 직전에 이 기능으로 기존 사용자에게 공지할 수 있다고 가정하지 않는다. 기존 배포 전 활동 확인은 계속 필요하다. 이후에도 공지 수신이 사용자 열람/저장을 보장하지는 않는다.

## 색상 선택 (2026-10-16)

`20261016063000_service_announcement_color.sql`은 color 열/3색 CHECK/관리자 RLS 아래 UPDATE 열 권한만 추가한다. 기존 내용·기간·revision은 수정하지 않는다. 로컬 적용 및 타입·린트·공지 JS/SQL 회귀 통과. 운영 미적용. 프로젝트 이동 → 연결 대상/이력 확인 → dry-run에서 이 파일만 확인 → db push → 대기 없음 확인 → 앱 배포 → 색상 저장/표시/종료 확인. 예상 밖 migration은 적용 전 검토한다.

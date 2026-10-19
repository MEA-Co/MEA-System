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

## 탐구줄기 탭 (2026-10-19)

질문/질문지와 같은 상위 링크 탐색으로 탐구활동/탐구줄기를 분리하고 준비 안내를 추가했다. URL 선택과 기존 목록 권한을 유지한다. 타입 검사·변경 파일 린트 통과. DB migration은 없으며 실제 브라우저 테스트·운영 배포는 수행하지 않았다.

## 로딩 UI 검증 (2026-10-19)

회원 관리 서버 조회 대기, 질문지 가이드 답변 조회, 학습법·탐구활동 첨부 선택 목록의 로딩 UI를 보완했다. 타입 검사·변경 파일 린트·관련 회귀 8개·Webpack 프로덕션 빌드 통과. DB migration·API·권한 변경은 없으며 실제 브라우저 테스트와 운영 배포는 수행하지 않았다.

### 첨부 로딩 보완·가이드 표시 복원 (2026-10-19)

선택기 진입 전 사용자 확인과 참조 상세 Drawer의 문구형 로딩도 스켈레톤으로 교체했다. 가이드 답변의 추가 로딩/오류 UI는 사용자 요청으로 제거하고 기존 데이터가 있을 때만 표시하도록 복원했다. 이번 보완의 타입 검사·변경 파일 린트·첨부 선택 회귀 2개 통과. 실제 브라우저 테스트·운영 배포는 수행하지 않았다.

## 탐구줄기 작성 화면 (2026-10-19)

전체 페이지 작성·탐구활동 선택/중복 방지/순서 변경/연결 해제 UI를 로컬 구현했다. DB/API 변경·migration은 없고 저장 기능은 미연결이다. 타입 검사·변경 파일 린트로 검증하며 실제 브라우저 테스트 및 운영 배포는 수행하지 않는다.

탐구줄기 주차 강조 툴팁·표 형태 빈 목록·본인/타인 목록 탭을 추가했다. 변경 파일 린트·타입 검사·diff 공백 검사를 통과했다. 저장/조회 API 추가, DB 변경, 실제 브라우저 테스트, 운영 배포는 수행하지 않았다.

탐구줄기 다열 그래프 UI로 변경: 이름 카드·좌우 추가·기존 옆 열 카드 연결·분기/합류·카드/간선 제거. 타입 검사·변경 파일 린트 통과. DB/API 변경·운영 반영·실제 브라우저 검증 없음.

참조 연결 확장 검증: 타입 검사·변경 파일 린트·그래프 연결 규칙 회귀 3개 통과. 스킬셋 팝업만 구현하며 선택/저장·DB 변경·운영 반영은 없음. 실제 브라우저 검증은 수행하지 않았다.

## 탐구줄기 캔버스 검증 (2026-10-19)

@xyflow/react 의존성과 잠금 파일을 추가했다. 확대/축소·이동·맞춤 보기·커스텀 카드/간선 UI를 로컬 구현하고 타입 검사·변경 파일 린트·연결 규칙 회귀 3개·Webpack 프로덕션 빌드를 통과했다. 이후 카드 선택 상태 및 키보드 이동 연결 보완은 타입/린트로 재확인했다. 실제 브라우저 검증·운영 배포는 수행하지 않았다. DB migration은 없고 좌표/줄기 저장 및 스킬셋 선택은 후속 범위다.

스킬셋 이름·설명 입력과 연결별 화면 상태 반영을 추가하고 타입 검사·변경 파일 린트를 통과했다. DB/API 변경·운영 배포·브라우저 검증은 수행하지 않았다.

## 탐구줄기 브라우저 임시저장 검증 (2026-10-19)

브라우저 명시적 저장·목록·검색/10개 페이지·재열기·삭제까지 로컬 구현했다. `Link` 명칭으로 정리했으며 좌표는 저장하지 않고 관계 기반으로 재배치한다. 이전 절의 저장 미연결 상태는 이 범위에서 대체되며 DB 확정은 여전히 후속 작업이다.

검증 완료:

- `npm run typecheck`
- `npx eslint 'app/(private)/dashboard/_views/exploration'`
- `node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-exploration-link-graph.mjs scripts/verify-exploration-link-drafts.mjs` — 10개 통과. 복원·좌표 제외·계정/환경 분리·오래된 저장/삭제·손상 데이터·저장 공간 실패·순환/잘못된 참조를 검증한다.
- `npm run test:exploration` — 12개 통과.
- `npx next build --webpack` — 프로덕션 빌드 통과.
- `git diff --check` — 통과.

실제 브라우저 테스트·운영 배포는 수행하지 않았다. 테스트는 메모리 Storage를 이용한 계약 검증이며 실제 브라우저 Web Locks/탭 전환의 상호작용 검증은 수행하지 않았다. 안전한 쓰기는 Web Locks와 AbortSignal.timeout을 제공하는 브라우저에서 동작한다. 자동 저장이 아니므로 이탈 전에 임시저장이 필요하다. 이번 변경에 DB migration은 없으며 DB에 적용할 명령도 없다. 별도 보관한 삭제 차단 작업은 변경하지 않았다.

### 임시저장 배치 초기화 수정 (2026-10-19)

최초 저장 시 new→초안 ID URL 전환에서 편집 컴포넌트의 key를 유지하고 스크롤 초기화를 막았다. 반복 저장은 라우터 전환을 생략한다. 타입 검사·변경 파일 린트·diff 공백 검사 통과. 실제 브라우저 테스트·운영 배포는 수행하지 않았다. 저장 형식·DB 변경은 없다.


### 브라우저 뒤로가기 확인 보완 (2026-10-19)

`lib/link-history-guard.ts`가 capture popstate에서 라우터 처리를 멈추고 현재 진입점을 pushState로 복원한다. 계속 작성 시 편집 인스턴스를 유지하고 확인 시 복원된 항목 바로 전의 이동 대상에 back한다. 이 복원은 브라우저 앞으로가기 분기를 대체할 수 있다. 다른 문서로의 이동은 기존 beforeunload 경고를 따른다.

타입 검사·변경 파일 린트·`node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-exploration-link-history.mjs` 회귀 2개 통과. 히스토리 어댑터로 반복 취소·확인·저장 중 이탈 방지·정리를 검증했다. 실제 브라우저 테스트와 운영 배포는 수행하지 않았다. DB·저장 형식 변경 없음.

### 이탈 경로 종합 점검 (2026-10-19)

뒤로/앞으로/다단계 이동은 Navigation API가 있으면 cancellable same-document traverse를 이동 전에 취소하고, 확인 시 정확한 destination.key로 이동한다. 이 경로는 방문 기록을 추가/삭제하지 않는다. 구형 브라우저의 popstate fallback은 앞 절의 앞으로가기 분기 대체 한계가 남는다. 참고: [NavigateEvent](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent), [traverseTo](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/traverseTo).

로그아웃 제출·역할 전환은 UI에서 서버 실행 전에 이탈 확인을 거친다. 실패 시 보호를 다시 활성화하며 로그아웃의 Next.js redirect 예외는 unstable_rethrow로 전달한다. 인증·쿠키·서버 액션 구현·DB는 변경하지 않았다. 스킬 미적용 입력도 이탈 보호 대상이며 팝업 취소와 선택 전환을 보완했다.

검증: 변경 파일 린트, 타입 검사, link-history/link-drafts/link-graph 회귀 총 18개, Webpack 프로덕션 빌드 통과. 회귀는 History/Navigation 어댑터로 반복 취소·정확한 앞으로/다단계 목적지·저장 중 차단·보호 정리, 링크 정책, 세션 변경 요청 승인 전 실행 차단을 확인한다. React Dialog 실제 이벤트 순서·스킬 팝업 겹침·실제 로그아웃/역할 전환·브라우저별 히스토리 조작은 실제 브라우저 검증을 수행하지 않았다. 브라우저 강제 종료 시 경고는 보장할 수 없다. 운영 배포·DB migration 없음.


### 저장·화면 이동 영향 범위 점검 (2026-10-19)

탐구줄기에서 숨은 활동 저장 훅이 실행되는 회귀를 수정했다. `node --test scripts/verify-navigation-isolation.mjs`의 첫 항목이 수정 전 실패하고 수정 후 7개 전체 통과했다. 이 검사는 컴포넌트/훅과 전역 이벤트를 경계 어댑터로 실행하며 실제 브라우저는 사용하지 않는다. 저장소 검사에는 기존 학습법/탐구활동 실제 readDrafts와 새 탐구줄기 저장/삭제 함수를 함께 사용했다. 사용자 브라우저 데이터를 읽거나 삭제하지 않았다.

확대 검사 결과(총 178개):

| 묶음 | 결과 |
| --- | --- |
| 탐구활동 storage/editor-session/save-refresh/list/selection/list-cache + link-drafts/history/graph | 55/55 통과 |
| MEA_TEST_BLOCK=study storage + study-editor-recovery/selection/list + question-study | 29 통과, 기존 스크립트 실패 1 |
| question-drawer + questionnaire-drawer/storage/answers/realtime + question-save-errors/submitted-navigation/question-exploration | 64 통과, 기존 스크립트 실패 5 |
| verify-major-values | 17/17 통과 |
| verify-navigation-isolation | 7/7 통과 |

question-study/exploration은 questionDetailSchema 의존성 mock 누락으로 시작 단계에서 실패하며, questionnaire-realtime 4개는 신규 세션 초기화(getSession/setAuth) 모의 구현/비동기 대기가 빠져 채널을 얻지 못한다. 해당 실패 6개는 별도 임시 디렉터리에 추출한 HEAD 코드에서도 동일 재현했다. 이번 작업에서 기존 테스트를 수정하거나 성공으로 처리하지 않았다. 상세 실행 대상은 UI UX 기록의 같은 날짜 영향 점검을 따른다.

타입 검사·변경 파일 린트·Webpack 프로덕션 빌드·diff 공백 검사 통과. 실제 브라우저·실제 사용자 초안·운영 DB는 검증하지 않았다. 새 DB migration 및 운영 적용 없음.


### 캔버스 커서 보완 (2026-10-19)

커서가 손가락/일반 모양으로 바뀐다는 제보에 따라 소스를 확인했다. React Flow의 선택 가능한 간선과 BaseEdge의 기본 20px 투명 상호작용 영역을 제거하고 카드 커서를 dragging 상태에 맞춰 명시했다. 변경 파일 린트·타입 검사·diff 공백 검사 통과. 실제 브라우저 재현/증상 해소 확인은 수행하지 않았으며 이탈 보호나 저장 경로는 변경하지 않았다.

## 탐구줄기 DB 확정 저장 (2026-10-19)

Migration: `supabase/migrations/20261019104839_exploration_links.sql`.

### 로컬 적용 상태

로컬 DB에 새 테이블 2개·RLS·인덱스·저장/삭제/페이지 함수를 적용했다. 기존 탐구활동·학습법·질문·답변 테이블과 삭제 함수는 변경하지 않았다. CLI `migration new`로 파일을 만들고 로컬 SQL로 반복 검증한 뒤 최종 파일의 함수 6개 본문/definer 속성이 실제 DB와 일치함을 확인했다. 신규 DDL 적용과 최종 함수 동등성 확인 후 해당 **로컬 이력만** 등록했다. `migration list --local`, `db push --local --dry-run --skip-vault`에서 적용 대기 없음 확인. 기존 이력/운영 이력 수정·DB reset은 수행하지 않았다.

### 검증

- 타입 검사·변경 파일 ESLint·Webpack 프로덕션 빌드·diff 공백 검사 통과.
- link-api(6), link-drafts(7), link-graph(3), link-history(8), navigation-isolation(10): **총 34개 통과**. 실제 편집 컴포넌트를 경계 어댑터로 실행해 확정 후 초안 정리/고립 노드 제외/남은 카드 위치 유지, 실패 시 보존과 동일 saveId 재시도, 다른 탭 초안 충돌 시 DB 성공 유지까지 검증한다.
- `supabase/tests/exploration_links.sql`: SQL 트랜잭션 롤백 회귀. 역할별 RLS·직접 쓰기 차단·정규화·공유 스킬 재사용·줄기/스킬 충돌·원자성·중복 요청·삭제 후 부활 차단·요약 목록·로컬 초안 병합 검증 통과.
- `supabase/tests/exploration_links_limits.sql`: 활동 300개/간선 1,000개, 최대 깊이 연결의 저장·복원 크기 확인. 단건 로컬 실행 약 **0.21초**. 운영 동시 부하 또는 장시간 관찰 결과는 아니다.
- `node scripts/verify-exploration-links-local.mjs`: 주소가 정확히 `http://127.0.0.1:54321`일 때만 실행하는 실제 로컬 Auth/PostgREST 검증. 전용 임시 계정/자료를 만들고 finally에서 해당 계정을 제거한다. 저장·동일 요청 재시도·10개 요약 조회·기존 활동 삭제 정책 유지 통과. 충돌이 **HTTP409 / JSON code40001로 4ms** 내 반환됨을 확인했다. 초기 확인에서 PGRST detail의 필수 headers 누락을 발견해 수정 후 재검증했다. 실제 SQLSTATE40001이나 자동 재시도 루프는 사용하지 않는다.
- `supabase db advisors --local --type security --level warn`: 경고 없음. performance에는 기존 exploration 등 복수 permissive policy 경고가 남아 있으나 신규 두 테이블 관련 경고는 없었다.
- 실제 브라우저 테스트·운영 DB 적용·앱 배포는 수행하지 않았다. 이 작업의 회귀는 이전 절의 질문 관련 기존 스크립트 6개 실패를 수정하거나 성공으로 대체한 것이 아니다.

재검증:

```bash
npm run typecheck
npx eslint 'app/api/exploration-links' lib/exploration-links 'app/(private)/dashboard/_views/exploration'
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-exploration-link-api.mjs scripts/verify-exploration-link-drafts.mjs scripts/verify-exploration-link-graph.mjs scripts/verify-exploration-link-history.mjs scripts/verify-navigation-isolation.mjs
docker exec -i supabase_db_system psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/exploration_links.sql
docker exec -i supabase_db_system psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/exploration_links_limits.sql
node scripts/verify-exploration-links-local.mjs
npx next build --webpack
```

### 부하 범위

화면 진입/조건 변경마다 필요한 페이지 1회, 상세 열기 1회(줄기 1행 + 사용 스킬만), 스킬 팝업 검색 300ms debounce/10개 페이지다. 목록 본문·질문지·답변을 전체 로드하지 않으며 주기 요청은 0회다. 따라서 유지 시간에 비례하는 polling 전송은 없고, 사용자 수 × 탭 수 × 실제 목록/검색/상세 열기 횟수 × 응답 크기로 증가한다. 목록은 10행 요약이며 최대 길이 이름 기준 약 수~10KB 수준(실측 보장은 아님), 스킬 페이지는 설명 길이에 따라 최대 약 150KB 수준이다. 로컬 초안 제외 ID 10,000개를 전달하는 최악 요청은 약 390KB로 제한한다. 상세는 선택한 그래프만 가져온다. 검색/정확한 count의 DB 계산량은 자료 수에 따라 늘어날 수 있다. 운영 실행 계획·동시 부하·장시간 알림은 별도 검토 대상이며 구현 완료로 간주하지 않는다.

### 운영 반영 순서 — 현재 미적용

전체 UI 개선 작업 마지막의 운영 반영 시 실행한다. 연결 대상과 운영 이력은 이번 작업에서 조회/변경하지 않았다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
# 이 작업의 예상 파일: 20261019104839_exploration_links.sql
# 예상하지 않은 파일이 있으면 적용 전에 이력과 객체 정의를 먼저 검토한다.
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

적용 대기 없음 확인 → 앱 배포 → 본인 신규 확정/수정/임시저장 재개, 리드·관리자 타인 읽기 전용, 스킬 재사용·충돌, 고립 노드 제외·실패 보존을 확인한다. 운영 reset/임의 migration repair는 실행하지 않는다. migration을 먼저 적용해야 새 API에서 테이블/함수를 찾을 수 있다. 되돌릴 때는 먼저 앱의 새 저장 경로를 비활성화하고 새 테이블 데이터를 보존한다. 운영 저장본이 생긴 테이블을 자동 삭제하는 down migration은 제공하지 않는다.

참고 문서 확인: Supabase 공식 [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)와 changelog. 최근 TLS cipher 변경은 이번 Next/Supabase 저장 API나 로컬 연결 설계를 바꾸는 사항이 아니며 패키지 업그레이드는 수행하지 않았다.


### 연결별 스킬 필수 검증 (2026-10-19)

후속 migration: `20261019110548_require_exploration_link_skills.sql`. 기존 파일/이력은 수정하지 않고 private 저장 함수의 간선 검사에 skillId 필수를 추가한다. 기존 행을 일괄 수정하지 않으며 다음 확정부터 적용한다. 새로운 조회·트리거·전체 데이터 검사는 없다. 권한·잠금·업무 충돌 전달은 유지하며 누락은 SQLSTATE22023으로 즉시 거절한다.

로컬 SQL 적용 후 최종 함수 본문 일치를 확인하고 해당 로컬 이력을 등록했다. 타입/변경 파일 린트, API·초안·편집 컴포넌트 회귀 24개 통과. SQL 회귀와 실제 로컬 HTTP 요청에서 미할당 저장 거부(400), 할당 후 정상 저장·재시도·충돌409를 확인했다. 300노드/1,000간선(공유 스킬 할당) 저장은 로컬 약 0.19초. 실제 브라우저 테스트와 운영 적용은 수행하지 않았다.

운영 반영은 위 절의 순서를 따른다. 이번 작업까지의 예상 파일은 기존 `20261019104839_exploration_links.sql`(운영 미적용인 경우) 다음 `20261019110548_require_exploration_link_skills.sql`이다. 프로젝트 경로 이동 → 연결 대상/이력 확인 → dry-run에서 예상 파일 확인 → 적용 → 대기 없음 확인 → 앱 배포 → 스킬 없는 연결의 토스트/저장 차단 및 할당 후 성공 확인. 예상 밖 migration은 적용 전에 검토한다.

### 확정 버튼 클릭 안내 (2026-10-19)

확정 버튼의 입력 상태별 disabled를 제거하고 클릭 시 이름·연결·스킬 미적용·스킬 미할당 사유를 토스트로 안내한다. 저장 중에만 비활성화한다. 타입 검사·해당 파일 ESLint·기존 편집/이탈 회귀 11개·diff 공백 검사 통과. DB/API 변경·새 migration·실제 브라우저 검증·운영 배포 없음.

확정본 변경 없음 처리: UI에 DB 확정 지문을 별도로 유지하여 임시저장 기준과 분리했다. 동일 확정 내용의 버튼 비활성화·호출 방어를 추가했다. 타입 검사·변경 파일 린트·기존 편집/이탈 회귀 11개·diff 검사 통과. DB/API/migration 변경 및 브라우저 테스트 없음.


### 확정 후 불필요한 이탈 경고 수정 (2026-10-19)

DB JSONB 속성 순서와 화면 직렬화 순서 차이 및 표시 제목 trim 차이를 동일 편집 내용 변환으로 통일했다. DB/API/저장 계약 변경 없음. JSONB 순서·공백을 포함한 저장 응답으로 확정 직후 경고 없음/확정 버튼 비활성화/다시 수정 시 경고 복귀를 검증했다. 타입·린트·편집/이탈 회귀 12개·diff 검사 통과. 실제 브라우저 테스트·운영 반영 없음.


### 스킬 검색/목록 UI 일치 (2026-10-19)

스킬 이름만 표시·고정 목록 높이·후속 조회 결과 유지·모드 전환 높이 애니메이션, 탐구줄기 행 클릭과 관리 아이콘을 적용했다. 타입 검사·변경 파일 ESLint·diff 검사 통과. 기존 motion 의존성을 사용한다. DB/API/migration 변경과 실제 브라우저 테스트·운영 반영은 없다.


기존 스킬 선택 표 전환: 공통 표/페이지네이션, 범위별 10개 페이지, 행/아이콘 선택을 적용했다. 타입 검사·변경 파일 ESLint·diff 검사 통과. DB/API/migration 변경·실제 브라우저 테스트 없음.

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

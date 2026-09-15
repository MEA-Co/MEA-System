# 대표 전공 검색 · 확인

## 적용 범위와 구조

생활기록부 브랜딩의 1·2·3순위 전공에 적용한다. 공통 Consulting Agent는 변경하지 않는다.

- `features/keywords/major-search/`: 입력 정규화·검색·카탈로그 조회·서버 검증·확정 저장.
- 브랜딩 `_hooks/useBrandingMajorSearch.ts`: 입력 디바운스, 후보 선택 및 확인 상태, Flow draft.
- 브랜딩 `_context/BrandingMajorSearchContext.tsx`: 세 순위의 카탈로그·검색 세션 공유.
- 브랜딩 `_components/BrandingMajorSearchInput.tsx`: 후보·확인 화면, 키보드 탐색, 로딩 안내.
- Server Actions: 카탈로그 조회 및 최종 확정만 제공한다.

## DB 기록 기준

**“네, 이 학과예요”로 확정하거나 “찾는 학과가 없어요”를 눌렀을 때 기록한다.**

검색, 후보 클릭, “아니요, 다시 찾을게요”는 기록하지 않는다. 후보 클릭 시 입력 원문과 결과는 화면 메모리에 보존한다. 입력이 바뀌면 선택·확인 상태를 해제하고 늦은 응답을 무시한다.

확정 시 서버는 카탈로그 버전과 후보 소속을 검증하고 `confirm_major_search` 함수로 아래 두 행을 한 트랜잭션에 저장한다.

- `major_search_requests`: 선택 당시 입력 원문, 정규화 입력, 세션·인증 사용자, completed 상태, 후보 순서·별칭·연결 방식의 스냅샷, 카탈로그 해시, DB 출처.
- `major_search_feedback`: confirmed 행동, 최종 `majors.id`, unreviewed 검토 상태.

일부만 저장되면 전체를 롤백한다. 연속 클릭·재시도는 동일 요청 UUID를 사용하여 중복 기록을 막는다. 학생의 확인은 검수된 정답이 아니다. 이전 구현으로 이미 저장된 기록은 삭제하거나 변경하지 않는다. 기존 스키마의 다른 상태·행동 값은 유지하지만 현재 흐름에서는 confirmed와 no_match만 생성한다.

“찾는 학과가 없어요”는 `record_major_no_match` 함수로 클릭 당시 입력 원문·정규화 입력·실제 제시 후보(없으면 빈 배열)를 저장하고, `major_id = null`, `action = no_match`, `review_status = unreviewed` 피드백을 함께 생성한다. 자동 검색 실패는 기록하지 않는다. 후보가 있어도 이 버튼을 누르면 기록한다. 저장 성공 후에만 완료 안내를 표시하며 실패 후 재시도는 같은 UUID를 사용한다. 입력 변경 시 이전 응답은 현재 화면에 반영하지 않는다.

## 검색 순서

1. 진입 시 대표 전공·별칭·계열·설명·내용 해시를 한 번 내려받아 세 순위가 공유한다.
2. 입력 즉시 보라색 애니메이션을 표시하고 300ms 후 브라우저에서 검색한다. NFKC, 공백 제거, 영문 소문자 정규화를 적용하며 대표명 정확 일치 → 별칭 정확 일치 → 앞부분 → 일부 일치 순으로 최대 5개를 표시한다. 포커스 해제를 기다리지 않는다.
3. 결과가 없으면 다른 명칭으로 검색하도록 안내한다. 대기 시간이 지나도 추가 서버 요청이나 LLM 호출을 하지 않는다. 매칭 보완은 DB 별칭으로 관리한다.
4. 최종 확정 시 서버가 현재 카탈로그로 후보를 다시 계산하고 목록 버전·선택 ID를 검증한다.

전공 검색용 모델 공급자, 추천 서명, 임시 추천 캐시 및 `/api/llm`의 전공 추천 분기는 제거했다. 다른 기능의 공통 LLM 경로는 유지한다. 기존 DB 모델 관련 컬럼은 유지하지만 새 확정 기록의 출처는 db이고 모델·프롬프트 정보는 null이다.

## DB 및 서버 설정

`20260915062408_record_major_no_match.sql`을 추가로 적용해야 no_match 기록이 작동한다. 기존 테이블을 재사용하며 no_match 함수 및 같은 요청에 confirmed/no_match가 함께 남지 않도록 확인 함수를 갱신한다. 이 추가 마이그레이션은 로컬 검증만 완료했으며 원격 DB 적용은 아직 하지 않았다.

2026-09-15 서버 전용 키 설정과 두 기록 테이블의 Data API 접근을 확인했다. 초기 마이그레이션 `20260915042403_create_major_search.sql`은 기존 구조이며, **추가 마이그레이션 `20260915053905_confirm_major_search_only.sql`은 원격 DB에 아직 적용하지 않았다.** 관리자 연결이 이 작업 환경에 설정되어 있지 않아 로컬 Postgres 호환 엔진에서 검증했다.

추가 마이그레이션을 Supabase SQL Editor 또는 프로젝트 마이그레이션 절차로 적용해야 확정 저장이 작동한다. 이 파일은 기존 테이블의 데이터를 변경하지 않고 원자적 확정 함수를 추가한다. 함수 실행은 service_role만 허용하고 anon/authenticated에는 차단한다. 신규 환경에서는 `docs/major-search-preflight.sql`로 기존 구조·권한을 먼저 확인하고 두 마이그레이션을 순서대로 적용한다.

필요 환경 변수는 기존 공개 Supabase URL·키, 서버 전용 `SUPABASE_SECRET_KEY`(또는 `SUPABASE_SERVICE_ROLE_KEY`)다. 서버 전용 키에는 `NEXT_PUBLIC_` 접두사를 붙이지 않는다. 현재 컨설팅은 로그인 사용자만 허용하며 사용자 ID·검토 상태는 서버가 관리한다.


## 검증

- `node --test scripts/verify-major-search.mjs scripts/verify-major-search-handlers.mjs`: 검색 규칙, 확정 전 기록 없음, 후보·카탈로그 검증, 원문 보존.
- `scripts/verify-major-search-db.mjs`: PGlite에서 두 마이그레이션을 실행해 원자적 저장·롤백·중복 방지·소유권·권한을 검증한다. `PGLITE_MODULE`로 패키지 경로를 지정한다. 운영 DB 검증은 아니다.
- `scripts/verify-major-search-browser.mjs`: 실제 컴포넌트와 모의 API로 확정 전 기록 없음, 확정·재시도, 입력 유지, 매칭 실패 시 추가 요청 없음, 늦은 응답 차단을 검증한다. `TEST_TOOLS`로 임시 esbuild/Playwright 설치 위치를 지정한다.
- TypeScript, 변경 파일 ESLint 및 webpack 프로덕션 빌드.

# Keywords 기능 로직

전공 검색과 이후 추가할 키워드 관련 기능의 도메인·데이터 접근을 이 폴더에 둔다.

- `major-search/domain.ts`: 타입, 입력 정규화, 대표명·별칭 검색 우선순위
- `major-search/catalog.ts`: 서버 DB 카탈로그 읽기 및 내용 해시
- `major-search/client.ts`: 공통 데이터 호출 계약
- `major-search/actions.ts`: 목록 조회·최종 확정·명시적 no_match 저장용 서버 함수 (모델 실행 불가)
- `major-search/handlers.ts`: 인증·서버 검증·기록 조정
- `major-search/server.ts`: 서버 전용 Supabase 클라이언트

브랜딩 전용 구성은 `app/(private)/consulting/branding/`에 둔다.

- `_components/BrandingMajorSearchInput.tsx`: 화면·스타일·키보드 탐색
- `_hooks/useBrandingMajorSearch.ts`: Flow draft, 선택·확인 상태, 입력 디바운스 및 조합 관리
- `_context/BrandingMajorSearchContext.tsx`: 1·2·3순위의 카탈로그·검색 세션 공유

다른 화면에서는 이 폴더의 정규화·검색·데이터 함수를 재사용하고 화면별 훅과 Context를 따로 구성할 수 있다. 전공 검색에는 LLM을 사용하지 않는다. 별도 검색 API 라우트는 없다. Supabase 마이그레이션은 기존 프로젝트 위치를 유지한다.

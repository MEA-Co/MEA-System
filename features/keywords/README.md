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

## 전공 키워드 안내

`major-overview/actions.ts`는 인증된 사용자의 요청으로 대표 전공 ID 최대 3개에 연결된 대표 키워드·보조 키워드·학과 참고 사이트를 읽는다. `types.ts`는 화면 데이터 계약이다. DB 스키마 변경이나 LLM 호출은 없다. 브랜딩 화면의 MajorOverviews·MajorKeywordCloud에서 표시한다. 보조 키워드에는 개별 설명 컬럼이 없으므로 부모 대표 키워드의 설명을 표시한다.

워드클라우드는 브랜딩의 `useMajorCloudLayout` 훅이 d3-cloud로 좌표를 계산하고 SVG로 표시한다. 같은 대표 키워드에 속한 단어의 강조 연결은 groupId로 유지한다.

학과 사이트에는 대학 전체 학과/전공 목록 안내 자료를 제외하고 학과별 교육과정·소개·연구분야 등 세부 페이지를 표시한다. DB에 학과별 major_info 링크가 보강되어 이를 교육과정·연구분야 참고 페이지보다 먼저 표시한다. 링크가 없는 경우에만 미등록 안내를 표시한다. DB 링크 자체는 변경하지 않는다.

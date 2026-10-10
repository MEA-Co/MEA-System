# 공부법 관리와 질문 참조

공부법 관리는 `/dashboard?view=study`, API는 `/api/study`, 확정 저장은 `public.study`다. 탐구활동과 같은 컨설턴트·리드·관리자 역할에서 사용할 수 있다.

## 입력과 관리

첨부 자료의 항목을 다음과 같이 구성한다.

- 시험 구분: 내신 / 모의고사(수능) / 기타 중 하나.
- 과목: 국어 / 영어 / 수학 / 사회 / 과학 / 기타 중 하나. 선택 옆에 과목명(예: 확률과 통계)을 선택 입력한다. 어떤 과목이든 입력 가능하며 과목 선택을 바꿔도 과목명을 유지한다.
- 문제 상황 유형: 자신이 겪은 문제 상황 / 지도한 학생이 겪었던 문제 상황 중 하나를 필수 선택한다. 공통 문제 상황 템플릿은 데이터 등록 전까지 준비 중인 비활성 항목이다. 저장 키는 `problemSource`의 `self` / `student`다.
- 문제 상황, 대응 방안(학습 전략), 실천 가이드, 실천 기간, 목표 달성 여부 진단 체크리스트, 후속 대응 전략은 확정 시 필수다.
- 성적 결과 후속 진단은 시험 후에도 추가할 수 있도록 선택이다. 기간과 체크리스트는 자유롭게 작성하는 텍스트다. 학생별 자동 리마인드 발송이나 성적 자동 집계는 포함하지 않는다.
- 관련 자료 첨부는 선택이다. 학습지·오답 기록 예시 등 PDF/HWP/HWPX/DOC/DOCX/PPT/PPTX 파일을 파일당 20MB·최대 10개 첨부한다. 예시 공부법 채우기와 별도 참고자료 입력·상세 영역은 제거했다. 플레이스홀더는 답변 예시 대신 각 항목에 작성할 내용과 구체화할 기준을 안내한다.
- 기존 확정본·임시저장은 과거 `직접 입력` 과목을 `기타`로 읽고 과목명을 보존한다. 기존 문제 내용은 유지하며 다음 확정 전에 문제 상황 유형을 직접 선택한다. 과거 참고자료 데이터는 보존용으로만 남고 화면·검색에서는 제외한다.

입력 하나 또는 첨부만 있어도 임시저장할 수 있다. 임시저장은 계정·Supabase URL로 분리한 localStorage와 IndexedDB에 보관하며 서버에 전송하지 않는다. 확정본 수정 중 임시저장해도 기존 확정본은 유지한다. 다른 탭의 변경, 저장 용량 오류, DB revision 충돌과 저장 요청 재시도를 보호한다. 미저장 상태에서 닫으면 확인하며, 삭제한 확정본은 늦은 저장 요청으로 되살릴 수 없다.

목록에서 전체 내용 검색, 본인/다른 작성자 구분, 전체/사람별 조회를 제공한다. 컨설턴트는 본인 목록만 보며 리드·관리자는 전체 확정본을 읽는다. 수정·삭제는 관리자도 본인만 가능하다. 관리자 컨설턴트 미리보기의 목록·첨부도 본인으로 제한한다.

## 질문과 답변

서술형 열에서 `공부법 참조 권장`을 설정한다. 기본 해제, `studyRecommended` boolean으로 저장하며 다른 유형으로 변경하면 제거한다. 기존 탐구활동 권장 옵션과 동시에 설정할 수 있다. 탐구활동은 파란색·나침반 아이콘, 공부법은 보라색·책 아이콘으로 안내한다. 둘 다 권장하면 하나의 말풍선에 두 안내를 나란한 구역으로 모두 표시하며, 입력란은 파란 테두리와 보라색 링을 함께 표시한다. 질문 카드에도 같은 안내 구분을 사용한다. 권장 옵션은 첨부를 필수로 만들지 않는다.

서술형에서 `@`는 탐구활동·공부법 메뉴를 함께 표시하며 `@공부법`으로 좁힐 수 있다. 키보드 방향키·Enter·Escape를 지원한다. 선택기에서 검색, 상세 조회, 새 공부법 추가·임시저장·확정을 수행할 수 있고 확정본만 첨부한다. 공부법의 학습 전략을 짧게 줄인 표시 이름과 UUID를 `studyReference` mark에 저장한다. 하이라이트·저장·재조회에서 참조가 유지되고 Backspace/Delete는 참조 전체를 삭제한다. 참조 이름은 삽입 당시 값이며 상세는 최신 확정본을 읽는다.

별도 `공부법 참조형` 답변 열(`kind: study`)도 지원한다. 본인 확정 공부법 하나의 UUID를 저장하고, 가이드와 읽기 전용 응답에서 상세를 열 수 있다.

일반 컨설턴트는 자신이 열람할 수 있는 가이드 답변에 실제 연결된 공부법과 등록 첨부만 읽는다. rich text 참조와 공부법 참조형 모두 지원한다. 가이드 연결 제거·공부법 삭제 시 새 열람은 차단하며, 미첨부 파일과 무관한 공부법은 공개하지 않는다. 다운로드는 60초 서명 URL이다.

## 검증

로컬 적용 migration: `20261010055936_study_methods.sql` → `20261010061957_study_problem_sources.sql`. 운영 DB 조회·적용은 하지 않았다. 환경 변수는 변경하지 않았다.

검증 항목:

- 공부법 저장·API·질문 설정 19개, rich text·혼합 참조 14개, 기존 탐구활동 저장·질문 17개 회귀 통과.
- SQL `study_storage`, `question_study_type`, `question_study_recommendation`, `study_guide_reference`, 기존 배포·가이드 참조를 포함한 `distributed_response_submissions` 통과.
- 실제 로컬 Storage 업로드·20MB 제한·타 계정/익명 거절·확정/재시도·서명 다운로드·첨부 삭제 보호 통과. 테스트 계정·파일은 정리했다.
- `npm run build -- --webpack` 배포 빌드 통과. 기본 Turbopack은 이 실행 환경의 포트 생성 제한으로 실패했다.
- 타입 검사와 변경 범위 lint 통과. 전체 lint는 기존 미수정 검증 스크립트 6개의 import 정렬 오류가 남아 있다.
- 전체 migration shadow 재생 후 public/private/storage 스키마 차이 없음, 로컬 migration 이력 일치, 보안 advisor 문제 없음.
- 프로젝트 지침에 따라 실제 브라우저 테스트는 실행하지 않았다.

```bash
MEA_TEST_BLOCK=study node --test scripts/verify-exploration-storage.mjs scripts/verify-question-study.mjs
node --test scripts/verify-questionnaire-rich-text.mjs scripts/verify-exploration-storage.mjs scripts/verify-question-exploration.mjs
MEA_TEST_BLOCK=study node scripts/verify-exploration-storage-local.mjs
```

## 운영 적용 순서

1. 프로젝트 이동 후 연결 대상·이력을 확인한다. 예상 운영 대상은 `epwlcallocdjkmgdmtlv`이며 실제 Dashboard 프로젝트 ID와 대조한다.

   ```bash
   cd /Users/mealdm/Desktop/MEA/system
   cat supabase/.temp/project-ref
   npx supabase projects list
   npx supabase migration list --linked
   ```

2. dry-run 결과를 확인한다. 첫 공부법 migration까지 적용했다면 이번 예상 파일은 `20261010061957_study_problem_sources.sql` 하나다. 공부법 기능을 아직 적용하지 않았다면 `20261010055936_study_methods.sql` → `20261010061957_study_problem_sources.sql` 순서로 두 파일이 예상된다. 다른 migration이나 이력 차이가 나오면 적용 전에 [로컬 DB 안내](local-supabase.md)와 [운영 안내](questions-operations.md)를 기준으로 정의·권한·이력을 검토한다. `--include-all`, 원격 reset/repair로 우회하지 않는다.

   ```bash
   npx supabase db push --linked --dry-run --skip-vault
   ```

3. 예상과 일치할 때 적용하고 대기 migration이 없는지 다시 확인한다.

   ```bash
   npx supabase db push --linked --skip-vault
   npx supabase migration list --linked
   npx supabase db push --linked --dry-run --skip-vault
   ```

4. `study-reports` 버킷이 Private·20MB인지 확인하고 기존 절차로 앱을 배포한다.
5. 기능을 확인한다: 공부법 추가 → 임시저장/새로고침 복원 → 확정 → 수정·파일 다운로드 → 질문의 공부법 권장 설정 → `@공부법`/참조형 첨부 → 저장 후 재조회 → 다른 컨설턴트의 가이드 첨부 열람 → 소유자만 수정·삭제 가능 여부.

2026-10-10 입력 구성 수정 검증: 문제 상황 출처·과목명·기존 데이터 호환을 포함한 JS 19개, 로컬 `study_storage`·`study_guide_reference`, 타입 검사·변경 범위 lint 통과. 새 함수 migration은 로컬 DB에서 생성하고 이력 일치를 확인했다. 이번 수정의 브라우저 검증·운영 적용은 수행하지 않았다.

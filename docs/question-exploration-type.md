# 탐구활동 참조형

이번 구현 범위는 독립 질문 제작·저장·질문/질문지 미리보기다. 배치형 질문지 배포 차단과 실제 답변 저장은 변경하지 않는다.

- 답변 유형 Select의 기본 4개 유형과 특수 유형을 SelectGroup/SelectSeparator로 구분한다.
- `fields[].kind = exploration`. 전환 시 기본 열 제목은 `탐구활동`이고 다른 열과 함께 사용하거나 기존 행 설정으로 반복할 수 있다.
- 각 행의 탐구활동 열은 본인의 활성 확정 활동 하나를 UUID로 선택한다. 미리보기의 선택값은 메모리에만 유지한다. 첨부 버튼의 메뉴에서 선택하고 내용 확인·교체·첨부 해제를 제공한다. 검색 입력은 제공하지 않는다.
- `/api/exploration?scope=own`은 리드·관리자도 서버에서 `owner_id = 본인`으로 제한한다. 임시저장·삭제 활동은 제외한다. 기존 관리 목록의 전체 조회 정책은 유지한다.
- DB 변경은 `private.validate_question()`의 허용 유형 추가뿐이다. 권한, 테이블, 배포/답변 RPC는 변경하지 않는다.

## 검증

타입 검사, 변경 파일 ESLint, JavaScript 회귀 15개, SQL `question_exploration_type`, `question_response_references`, `question_row_settings`, `question_choice_conditions` 통과. 로컬 보안 advisor 통과. 실제 브라우저 테스트는 실행하지 않았다.

로컬 변경을 검증한 뒤 `db pull --local --schema public,private --yes`로 `20260929053605_question_exploration_type.sql`을 생성하고 로컬 이력에 등록했다. 운영 DB에는 적용하지 않았다.

## 운영 적용 순서

1. 프로젝트로 이동하고 연결 대상·운영 이력을 확인한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
```

2. `docs/local-supabase.md`의 기존 운영 이력 차이를 검토한 뒤 예행 실행한다.

```bash
npx supabase db push --linked --dry-run
```

직전 migration까지 운영에 적용되어 있다면 예상 파일은 `20260929053605_question_exploration_type.sql` 하나다. 다른 migration이 나오거나 이력이 다르면 **적용 전에** 운영 객체와 이력을 검토한다. 자동으로 `--include-all`이나 `migration repair`를 실행하지 않는다.

3. 대상과 예상 파일을 확인한 다음 실제 적용하고 적용 대기가 없는지 재확인한다.

```bash
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

4. 기존 앱 배포 절차로 앱을 배포한다. 새 유형 선택·저장·재조회, 미리보기에서 첨부 메뉴에 본인 활동만 표시되고 첨부되는지 확인한다. 배치형 질문지의 배포·답변 저장은 이번 확인 범위에 포함되지 않는다.

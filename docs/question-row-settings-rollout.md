# 질문 최소 행 수 · 행 이름 운영 적용

신규 migration: `20260928102529_question_row_settings.sql`.
기존 질문은 최소 1행, 이름 미지정(숫자)으로 유지된다. 반복형은 최소~최대 범위를 설정하며, 참조형의 행 수는 앞선 질문의 응답을 따른다. 이름은 각 행의 순서별 표시명이고 답변 식별자로 사용하지 않는다. 게시·배포 응답 기능 확장은 이번 범위에 포함하지 않는다.

운영에는 DB를 먼저 적용하고 앱을 배포한다. 연결된 프로젝트가 운영인지 확인한 상태에서:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

기존 이력이 일치하고 적용 대기가 이번 migration 하나인지 확인한다. 다른 migration도 표시되면 먼저 해당 변경의 운영 반영 여부를 검토한다. 이력을 맞추려고 `--include-all`, reset, repair를 실행하지 않는다. `docs/local-supabase.md` 참고.

```bash
npx supabase db push --linked
npx supabase migration list --linked
```

그 다음 앱을 배포한다. 질문을 최소 2·최대 4행으로 저장하고 행 이름을 일부만 지정한 뒤 다시 열어 설정이 유지되는지 확인한다. 미리보기에는 최소 2행이 표시되고 이름 미지정 행은 숫자로 표시되어야 한다.

로컬 검증: `supabase/tests/question_row_settings.sql`, `supabase/tests/question_details.sql`, `scripts/verify-question-reference-rows.mjs`.

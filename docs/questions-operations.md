# 질문·질문지 운영과 검증

기능은 [질문·질문지 관리](questions.md), 데이터 구조는 [저장 구조](questionnaire-storage-design.md), 개발 환경은 [로컬 Supabase](local-supabase.md)를 참고한다.

## 현재 적용 상태

2026-10-02 사용자가 `20261002071428_direct_question_responses.sql`까지 운영 적용 완료를 알렸다. 앞선 가이드 응답 확인·이전 답변 정리와 질문 버전 제거가 포함된다. 새 저장·제출 기능 `20261002074415_distributed_response_submissions.sql`은 로컬 적용·회귀 검증 완료, 운영 적용 대기다. 제출 수 집계 `20261002081911_distributed_submission_counts.sql`과 검토 요청 소유자 차단 `20261002082355_question_and_questionnaire_review_owners.sql`도 로컬 적용 완료다. 운영 dry-run에는 아직 적용하지 않은 파일만 순서대로 나와야 한다.

과거 migration은 재현용으로 유지한다. 완료된 이전 절차를 재실행하지 않는다. 구형 질문지 import 함수는 폐기됐으며 관련 과거 SQL 스니펫은 현행 실행 안내가 아니다.

## 이후 DB 변경 적용 순서

운영 DB 적용은 사용자가 수행한다. DB 변경이 없는 코드·문서 정리에 새 migration은 필요하지 않다.

1. 변경 내용을 저장하고 필요하면 운영 백업/복원 지점을 확인한다. 연결 대상과 이력을 점검한다.

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

운영 대상은 `epwlcallocdjkmgdmtlv`다. 대기 파일이 해당 변경의 예상 migration과 다르면 적용 전에 이력을 검토한다. `--include-all`, 원격 reset, migration repair로 우회하지 않는다.

2. 확인한 변경을 적용하고 적용 대기가 없음을 재확인한다.

```bash
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

3. 앱을 기존 배포 방식으로 배포하고 열린 탭을 새로고침한다. DB migration → 앱 배포 → 기능 확인 순서다. 실제 운영 답변을 검증 목적으로 삭제하지 않는다.

## 환경별 가이드 계정

운영 가이드 UUID는 `4e4c12e7-6357-4803-95de-e2d603bbda3e`, 로컬은 `b338f03e-9d7f-4367-be1e-96eb1d5473be`다. `private.guide_consultant_id()`의 환경별 차이는 의도된 설정이다. 스키마 비교·배포 시 로컬 UUID로 운영 함수를 덮어쓰지 않는다.

계정 설정이 필요한 경우에만 `supabase/snippets/set-production-guide-consultant.sql`을 검토한다. 운영에서만 실행하며 계정 역할을 검사한다. 이미 설정했다면 재실행할 필요가 없다.

## 현행 검증

기본은 타입 검사·관련 파일 린트·필요한 회귀 검사다. 브라우저 검증은 사용자 요청이 있을 때만 수행한다.

```bash
npm run typecheck
npm run build
```

질문·응답 DB 회귀는 아래 파일을 사용한다. 로컬 컨테이너 `supabase_db_system`에서 각 파일을 psql로 실행하며 테스트는 롤백된다.

- `supabase/tests/guide_answer_field_changes.sql`
- `supabase/tests/guide_question_removal.sql`
- `supabase/tests/question_responses.sql`
- `supabase/tests/published_live_layout.sql`
- `supabase/tests/question_response_conditions.sql`
- `supabase/tests/question_response_types.sql`
- `supabase/tests/distributed_response_path.sql`
- `supabase/tests/questionnaire_distribution_withdrawal.sql`
- `supabase/tests/questionnaire_locked_distribution.sql`
- `supabase/tests/distributed_response_submissions.sql`

과거 스키마 전용 SQL 테스트·이전 스니펫은 현재 DB에서 일괄 실행하지 않는다. migration 삭제·재작성이나 운영 데이터 초기화로 테스트를 맞추지 않는다.

## 확인할 동작

- 질문·질문지 생성/수정과 재조회, 저장 충돌 시 입력 보존.
- 가이드 답변이 있는 항목 삭제·유형 변경, 질문·섹션 제거의 확인 및 취소.
- 질문지에서 질문을 제거하면 해당 질문지의 가이드 응답만 삭제되고 다른 질문지의 응답은 유지됨.
- 미처리 검토 요청의 배포 차단, 배포본·원본의 수정 잠금.
- 배포 응답이 없을 때 게시/수정 중으로 복귀하고 컨설턴트 목록에서 제외됨.
- 새 배치형 배포본의 입력·저장·제출. 저장은 본인 전용이고 리드·관리자는 마지막 제출 내용만 조회함.
- 제출 후 수정·저장은 기존 공개 답변을 유지하고 재제출할 때만 갱신됨.
- 단순 열람은 저장 이력이 생기지 않으며 가이드 게시 응답과 개인 배포 응답이 분리됨.
- 구형 배포 응답 저장 경로는 호환 유지.

- 진로 흐름 부분 제출(2026-10-02): 원본 `5f6064ad-1dd6-4e0d-95dd-611ccacbce92`는 활성 칸 하나의 유효 응답만으로 배포 답변 제출을 허용한다. 전체 공백은 거절하며 다른 질문의 모든 필드/최소 행 검사는 유지한다. `20261002083415_career_flow_partial_submission.sql` 로컬 적용·한 칸/빈 답변 롤백 검증·기존 배포 응답 회귀·보안 검사 통과. 운영은 사용자 적용 대기. 실제 브라우저 제출은 수행하지 않았다.

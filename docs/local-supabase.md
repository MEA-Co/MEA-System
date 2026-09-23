# 로컬 Supabase

개발 앱은 로컬 Supabase, 배포 앱은 기존 운영 Supabase를 사용한다. CLI의 `link`는 배포 대상을 지정할 뿐 앱의 연결 주소를 바꾸지 않는다.

## 초기 구조 복구 (2026-09-18)

운영 `db dump`와 `migration list --linked`를 비교했다. 전공 기준 테이블 7개와 가치관 메타데이터 테이블 11개, 뷰 3개, 관련 함수·인덱스·트리거·RLS·권한이 저장소에서 누락되어 있었다.

- `20260915042403_create_major_search.sql`에 전공 기준 구조를 선행 생성하도록 복구했다. 이 파일이 `majors`를 참조하므로 최신 migration에 기준 테이블만 추가하면 빈 DB 재생이 먼저 실패한다. 기존 검색 테이블·함수 본문은 유지했다.
- `restore_major_value_metadata` migration에는 운영에서 추출한 가치관 구조를 보관했다. 데이터 행은 포함하지 않는다.
- 기본 권한의 차이로 쓰기 권한이 생기지 않도록 복원 테이블·뷰의 anon/authenticated 권한을 회수한 후 운영의 명시적 권한을 적용한다.
- 비교용 `supabase/remote-schema.sql`은 Git에서 제외한다. 원본 dump를 migration으로 실행하지 않는다.

### 운영 배포 전 이력 정리 필요

다음 세 파일은 운영에 객체가 존재하지만 운영 migration 이력에는 없다.

```text
20260915042403_create_major_search.sql
20260915053905_confirm_major_search_only.sql
20260915062408_record_major_no_match.sql
```

새 가치관 복구 migration의 객체도 이미 운영에 있다. 따라서 현재 상태에서 `db push`, `db push --include-all`, 원격 reset을 실행하지 않는다. 로컬 복구 작업은 운영 이력을 수정하지 않았다. 배포 전 운영 객체와 파일의 동등성을 확인하고 기존 적용분을 이력에 반영하는 별도 검토가 필요하다. 다른 개발 DB에서 위 파일이 이미 적용되어 있었다면 파일 수정만으로 기준 구조가 복구되지는 않는다.

## 시작과 재검증

Docker Desktop 등 Docker 호환 엔진을 실행한 뒤 프로젝트 루트에서:

```bash
npx supabase start
```

로컬 데이터를 모두 지우고 처음부터 구조를 검증할 때만:

```bash
npx supabase db reset --local --no-seed
```

일반 종료는 `npx supabase stop`이다. 주소와 키는 `npx supabase status`에서 확인한다. 초기 구조 복구만으로는 앱 연결 환경 변수, Google OAuth, 테스트 계정, 전공 기준 데이터가 준비되지 않는다.

## 앱 연결 (별도 설정)

`.env.development.local`에 다음 세 항목을 로컬 실행 결과로 설정한다. 운영 서버의 환경 변수는 유지한다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable or anon key>
SUPABASE_SECRET_KEY=<local secret or service_role key>
```

Next.js 밖의 스크립트는 이 파일을 자동으로 읽는다고 가정하지 않는다. 실행 전 URL이 로컬인지 확인한다. 로컬 DB를 실행했더라도 위 설정을 바꾸기 전 앱은 기존 `.env`의 운영 DB를 계속 사용한다.

## 인증과 데이터 (별도 설정)

Google OAuth는 `config.toml`에 provider, site URL, 앱 callback 허용 목록을 설정해야 한다. Google 콘솔의 로컬 callback은 `http://127.0.0.1:54321/auth/v1/callback`, 앱 callback은 `http://localhost:3000/auth/callback`이다. 비밀 값은 환경 변수로 전달한다.

기준 데이터는 구조와 별도로 선별해 가져온다. 회원·학생·질문지·답변을 통째로 복사하지 않는다. 새 로컬 계정은 운영 계정과 UUID·역할이 별개다.

2026-09-18 기준 `supabase/seed.sql`에는 기준 테이블 18개의 데이터만 포함한다. 로컬에서 전공 75개·키워드 755개·전공별 가치관 관점 75개를 확인했다. CLI 2.117.0에서 `--exclude`의 `public.major_search_*`, `public.questionnaire*` 패턴은 기대한 제외를 수행하지 않았다. 다시 내보낼 때는 제외할 테이블명을 모두 명시하고, 생성 파일의 COPY 대상이 기준 테이블 허용 목록 18개와 정확히 일치하는지 반드시 검증한다. 잘못 포함됐던 검색 기록·피드백 각 18건은 seed에서 제외하고 로컬에서도 원본과 일치하는 행만 제거했다. 로컬 회원·프로필은 유지했다.

## SQL 회귀 검증

현재 기본 `project_id = "system"`일 때 로컬 DB 컨테이너는 `supabase_db_system`이다. 각 SQL 테스트는 자체 트랜잭션을 롤백한다.

```bash
for file in supabase/tests/*.sql; do
  docker exec -i supabase_db_system psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$file" || break
done
```

브라우저 테스트와 실제 로그인 검증은 별도다.

## 복구 검증 결과 (2026-09-18)

- `supabase start` 성공, 전체 32개 migration 적용 성공.
- `supabase db reset --local --no-seed`로 빈 DB 재생 성공.
- `supabase db lint --local --schema public,private --level error --fail-on error`: 오류 없음.
- `supabase db advisors --local --type security --level warn --fail-on error`: 경고·오류 없음.
- 로컬 dump와 운영 dump 비교: 앱 테이블·뷰·함수·제약·권한 정의 일치. 운영의 플랫폼 보조 함수 `public.rls_auto_enable`만 로컬에 없다. 이 함수는 이번 복구에서 옮기지 않았으며 앱 테이블의 RLS는 migration에서 명시적으로 활성화한다. Auth/Storage/Realtime 관리 스키마와 외부 인증 설정 전체의 동일성을 검증한 것은 아니다.
- SQL 테스트 14개 중 13개 통과. 새 `major_catalog_local.sql`은 실제 RPC의 키워드·예시·계열 사고 조회, 키워드 제외, 다른 계열 연결 차단, 일반 사용자 쓰기 차단, anon 메타데이터 접근 차단을 검증하고 롤백한다.
- `questionnaire_published_deletion.sql` 실패는 운영 dump에도 존재하는 기존 문제다. `private.guard_submitted_answers`가 DELETE에도 `NEW`(NULL)를 반환해 미완료 답변 삭제를 건너뛰며, 이어지는 응답 삭제가 외래 키에 막힌다. 로컬 구조 재현 작업에서는 운영과 다른 동작을 추가하지 않았다. 별도 수정 migration과 회귀 검증이 필요하다.

## 질문 유형 추가 (2026-09-21)

`20260921083603_questionnaire_question_types.sql`을 롤백 테스트 후 `migration up --local`로 적용했다. 새 질문 유형·선택지, 선택 값과 읽을 수 있는 답변 텍스트 저장을 추가한다. 운영에는 적용하지 않았다. 로컬 적용 대기 파일이 이 파일 하나뿐임을 확인했으며 기존 운영 이력은 변경하지 않았다. 관련 SQL 회귀와 로컬 보안 advisor는 통과했다.

## 직접 입력 선택지 (2026-09-22)

`20260922044351_questionnaire_other_choices.sql`은 `isOther` 선택지 설정 검증과 답변 텍스트 변환을 확장한다. 로컬에만 적용하며 운영 DB는 변경하지 않았다. 관련 SQL은 `supabase/tests/questionnaire_other_choices.sql`이다.

## 척도 설정 (2026-09-23)

`20260923042351_questionnaire_scale_settings.sql`은 척도 2~9점, 양끝·홀수 가운데 라벨, 선택적 서술 답변을 저장한다. 로컬에만 적용했으며 운영 DB는 변경하지 않았다. `supabase/tests/questionnaire_scale_settings.sql`과 기존 질문 유형·답변 SQL 회귀 테스트, 로컬 DB lint·보안 advisor가 통과했다.

## 선택형 칩 스타일 (2026-09-23)

`20260923044758_questionnaire_choice_style.sql`은 선택형 질문의 `list`(기본)·`chip` 표시 방식을 저장한다. 두 방식 모두 `isOther` 직접 입력 답변 형식을 사용한다. 로컬에만 적용하며 운영 DB는 변경하지 않는다. 관련 SQL 회귀는 `supabase/tests/questionnaire_other_choices.sql`이다.

`20260923045543_questionnaire_direct_input_label.sql`은 기존 `isOther` 선택지 이름과 무관하게 새 답변의 body를 `직접 입력: 내용`으로 기록한다. 화면에서도 두 표시 방식 모두 `+ 직접 입력`을 사용한다. 로컬에 적용하고 관련 SQL 회귀·DB lint·보안 advisor를 통과했으며 운영 DB는 변경하지 않았다.

`20260923051135_questionnaire_choice_written_answer.sql`은 단일·다수선택형의 선택적 추가 서술 설정과 답변 저장을 추가한다. 기존 선택형 답변 형식을 허용하며 `직접 입력`과 별도 추가 서술을 함께 보존한다. 로컬에만 적용했고 관련 SQL 회귀·DB lint·보안 advisor가 통과했으며 운영 DB는 변경하지 않았다. 관련 회귀는 `supabase/tests/questionnaire_other_choices.sql`이다.

`20260923052741_questionnaire_multiple_direct_input.sql`은 다수선택형에 여러 `isOther` 항목을 허용하고, 단일선택형은 하나로 제한한다. 선택된 직접 입력 답변이 여러 개면 본문에 번호를 매기고 일반 선택지 뒤에 둔다. 로컬에만 적용했고 관련 SQL 회귀·DB lint·보안 advisor를 통과했으며 운영 DB는 변경하지 않았다. 관련 회귀는 `supabase/tests/questionnaire_other_choices.sql`이다.

# 로컬 Supabase

개발 앱은 로컬 Supabase, 운영 앱은 운영 Supabase를 사용한다. CLI의 link는 배포 대상을 지정할 뿐 앱의 연결 주소를 바꾸지 않는다.

2026-10-02 사용자가 `20261002071428_direct_question_responses.sql`까지 운영 적용 완료를 알렸다. 이번 문서 정리에서 운영 DB를 재조회하지 않았다. 실제 적용 상태는 migration 이력으로 확인한다. 운영 절차는 [운영 안내](questions-operations.md)를 따른다.

이전 전공 검색·가치관 구조의 운영 이력 보완은 완료된 작업이다. 이후 예상 밖 이력 차이가 생기면 객체 정의와 이력의 동등성을 먼저 확인하며 원격 reset이나 migration repair로 임의 해결하지 않는다.

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

### 가상 컨설턴트 계정 (2026-10-02)

`node scripts/create-local-consultant.mjs`로 일반 컨설턴트 `codex-consultant@example.test`를 생성하고 비밀번호 로그인·본인 프로필 조회를 검증한다. 이름은 `로컬 테스트 컨설턴트`다. 개발 환경 변수를 읽되 Supabase 주소가 정확히 `http://127.0.0.1:54321`인 경우에만 실행한다. 기존 계정은 다시 사용하며 다른 계정의 비밀번호나 역할은 변경하지 않는다.

임의 생성 비밀번호는 Git에서 제외된 `.env.local-consultant.json`에 소유자 전용 파일 권한으로 저장한다. 로컬 앱 `/auth/login`의 `로컬 테스트 계정` 입력란에 이 파일의 이메일·비밀번호를 입력한다. 입력란은 development 모드와 위 로컬 DB 주소가 모두 일치할 때만 표시한다. 실제 Supabase 인증과 기존 회원 권한을 그대로 사용한다. 운영 계정·스키마·migration 변경은 없다. 일반 컨설턴트이므로 리드 전용 질문 제작·게시본 검토 권한은 없다.

Google OAuth는 `config.toml`에 provider, site URL, 앱 callback 허용 목록을 설정해야 한다. Google 콘솔의 로컬 callback은 `http://127.0.0.1:54321/auth/v1/callback`, 앱 callback은 `http://localhost:3000/auth/callback`이다. 비밀 값은 환경 변수로 전달한다.

기준 데이터는 구조와 별도로 선별해 가져온다. 회원·학생·질문지·답변을 통째로 복사하지 않는다. 새 로컬 계정은 운영 계정과 UUID·역할이 별개다.

2026-09-18 기준 `supabase/seed.sql`에는 기준 테이블 18개의 데이터만 포함한다. 로컬에서 전공 75개·키워드 755개·전공별 가치관 관점 75개를 확인했다. CLI 2.117.0에서 `--exclude`의 `public.major_search_*`, `public.questionnaire*` 패턴은 기대한 제외를 수행하지 않았다. 다시 내보낼 때는 제외할 테이블명을 모두 명시하고, 생성 파일의 COPY 대상이 기준 테이블 허용 목록 18개와 정확히 일치하는지 반드시 검증한다. 잘못 포함됐던 검색 기록·피드백 각 18건은 seed에서 제외하고 로컬에서도 원본과 일치하는 행만 제거했다. 로컬 회원·프로필은 유지했다.

## 검증

현재 스키마용 SQL 회귀 목록은 [운영 안내](questions-operations.md)를 따른다. 과거 테스트에는 이미 제거된 테이블을 사용하는 파일이 있으므로 `supabase/tests/*.sql` 전체를 무조건 실행하지 않는다. 각 현행 SQL 테스트는 트랜잭션을 롤백한다. 브라우저 검증은 사용자 요청이 있을 때만 수행한다.

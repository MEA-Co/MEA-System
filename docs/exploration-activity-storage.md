# 탐구활동 임시저장·확정

API 이름은 탐구활동 저장 `/api/exploration`, 기존 AI 탐구 코치 `/api/exploration-coach`로 구분한다. 기존 코치는 독립 DB 테이블을 사용하지 않는다. 확정 데이터 테이블은 `public.exploration`, RPC는 `save_exploration` / `delete_exploration`이다. `20260928101208_rename_exploration_activity_storage.sql`이 최초 저장 migration 뒤에 테이블·제약·인덱스·RPC를 이름 변경한다. 기존 행, RLS, 파일 경로, 브라우저 임시저장 키는 유지한다.

## 저장 정책

- **임시저장**: 제목을 포함해 어떤 필드도 필수로 요구하지 않는다. 공백을 제외한 입력 하나, 참고자료 내용 하나 또는 첨부 파일 하나가 있으면 가능하다. 자동 저장은 하지 않는다.
- 입력값·참고자료·첨부 메타데이터는 계정과 Supabase URL로 분리한 `localStorage`에 저장한다. 20MB 파일 원문은 문자열 저장소 용량을 초과할 수 있어 브라우저 **IndexedDB**에 저장한다. 임시저장 과정에서 서버 DB/Storage로 전송하지 않는다. 같은 브라우저·사이트·계정에서 새로고침 후 복원되며, 브라우저 데이터 삭제나 다른 기기로의 이동에는 복원되지 않는다.
- 저장 공간 부족·접근 차단·손상된 데이터는 오류로 안내하며 기존 임시저장을 덮어쓰지 않는다. 첨부 파일 저장 트랜잭션 완료 후 localStorage를 갱신한다. 로컬 버전과 Web Locks(지원 브라우저)로 다른 탭의 저장을 보호한다.
- **확정**: 학년, 학기, 기재 유형, 활동 영역/교과명, 교내/과목 맥락, 탐구 주제, 탐구 내용, 탐구의 주안점, 기획, 수행, 결과가 모두 필요하다. 성장·참고자료·보고서는 선택이다. 공백만 있는 값은 인정하지 않는다. 클라이언트/API/DB에서 검증한다.
- 확정본은 `public.exploration`에 저장한다. 실제 컨설턴트·리드·관리자가 **본인 데이터만** 조회·수정·삭제한다. 관리자 체험 역할도 소유권을 바꾸지 않는다. 공유·다른 멘토의 활동 조회는 이번 구현에 포함하지 않는다.
- 확정 후 편집은 가능하다. 편집 중 `임시저장`은 DB 확정본을 유지하고 로컬 수정본을 생성한다. 목록에서는 같은 항목을 하나로 표시하며 `수정 중 · 임시저장` 배지를 붙인다. `수정 내용 확정` 시 필수 입력을 재검증하고 원본을 갱신한다.
- DB revision과 저장 요청 UUID로 충돌/중복 재시도를 보호한다. 충돌 시 입력은 그대로 남기며 강제 덮어쓰지 않는다. 최신 확정본을 보려면 목록 새로고침 후 수정 임시저장을 삭제하고 확정본을 연다. 필요한 수정 문구는 먼저 보존한다.
- 임시저장 삭제는 로컬 수정본만 지우며 기존 확정본은 유지한다. 확정본 삭제는 내용과 첨부 목록을 제거하고 ID·소유자·revision·삭제 시각을 남겨 늦은 저장 재시도의 재생성을 차단한다. 파일 삭제는 Storage API로 수행한다.

## 파일 저장

`20260928100109_exploration_activity_storage.sql`이 비공개 `exploration-reports` 버킷과 소유자별 RLS를 생성한다. 파일당 최대 20MB, 활동당 최대 10개, PDF/HWP/HWPX/DOC/DOCX/PPT/PPTX를 지원한다. 경로는 `<user UUID>/<activity UUID>/<file UUID>.<extension>`이며 덮어쓰기를 허용하지 않는다.

확정 버튼을 눌렀을 때 브라우저에서 Supabase Storage로 직접 업로드하고, 성공한 파일 목록과 활동 본문을 DB에서 함께 확정한다. 앱 서버의 요청 본문 크기 제한 때문에 파일을 Next.js API로 중계하지 않는다. 업로드 실패 시 DB에 확정하지 않으며, 이미 업로드된 동일 UUID 경로는 재시도할 때 재사용한다. DB는 파일 경로의 소유자·활동 ID·파일 ID, 실제 객체 존재와 크기를 검증한다. 다운로드는 본인 확정본의 첨부에 대해서만 60초 서명 URL을 발급한다.

확정본에서 사용 중인 파일은 Storage 삭제 정책으로 보호한다. 첨부를 제거하고 수정 확정하면 이전 파일을 정리한다. 확정 실패 후 버려진 업로드나 파일 삭제 시 네트워크 오류로 남은 객체는 비공개 상태로 남을 수 있다. 운영자가 `storage.objects`에서 이 버킷의 오래된 객체 중 활성 `exploration.reports`에서 참조하지 않는 경로를 검토한 뒤 **Storage API**로 정리한다. `storage.objects` SQL DELETE로 파일을 지우지 않는다. 자동 정리 스케줄은 설정하지 않았다.

Storage 업로드/RLS 근거: [Supabase Access Control](https://supabase.com/docs/guides/storage/security/access-control), [Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads). 현재는 최대 20MB 표준 업로드와 재시도를 사용한다. 향후 파일 크기를 늘리거나 불안정한 연결을 지원할 때 TUS 재개 업로드를 검토한다.

## 운영 적용 순서

이번 작업은 **로컬 DB에 적용·검증 완료, 운영에는 미적용**이다. 기존 앱 환경 변수의 연결 대상을 바꾸지 않았다.

1. 프로젝트로 이동한다.

   ```bash
   cd /Users/mealdm/Desktop/MEA/system
   ```

2. 연결된 프로젝트와 운영 migration 이력을 확인한다. `supabase/.temp/project-ref`가 의도한 운영 대상인지 Dashboard의 프로젝트 ID와 대조한다. 로컬과 운영의 기존 이력 차이는 먼저 `docs/local-supabase.md`를 검토한다.

   ```bash
   cat supabase/.temp/project-ref
   npx supabase projects list
   npx supabase migration list --linked
   ```

3. dry-run으로 적용 예정 파일을 검토한다. 최초 저장 기능도 아직 운영에 적용하지 않았다면 예상 파일은 `20260928100109_exploration_activity_storage.sql` → `20260928101208_rename_exploration_activity_storage.sql` 두 개이며 순서대로 적용한다. 최초 migration이 이미 적용된 운영이라면 이름 변경 migration 한 개만 예상한다. **다른 migration이 나오거나 이력이 불일치하면 적용 전에 정의·권한·이력의 동등성을 검토한다.** `--include-all`, remote reset, 원격 `migration repair`로 우회하지 않는다.

   ```bash
   npx supabase db push --linked --dry-run --skip-vault
   ```

4. 대상·이력·파일이 예상대로임을 확인한 뒤 적용한다.

   ```bash
   npx supabase db push --linked --skip-vault
   ```

5. 적용 대기가 없는지 확인한다.

   ```bash
   npx supabase migration list --linked
   npx supabase db push --linked --dry-run --skip-vault
   ```

6. 파일 업로드 설정을 확인하고 앱을 기존 배포 절차로 배포한다.
   - Supabase Dashboard → Storage에서 `exploration-reports` 버킷이 생성되었고 **Private**, 파일 크기 제한 **20MB**인지 확인한다. 직접 버킷을 만들거나 Public으로 바꾸지 않는다.
   - 프로젝트의 Storage 전역 업로드 제한이 20MB 이상이어야 한다. 저장 공간/사용량 여유도 확인한다.
   - 앱 배포 환경의 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 위 운영 프로젝트와 일치해야 한다. 이번 기능을 위해 서비스 키를 브라우저에 전달하거나 새 공개 키를 추가할 필요가 없다.
   - 자체 CSP를 쓰는 배포라면 해당 Supabase URL을 `connect-src`에 허용한다. 기본 앱에는 별도 설정이 필요하지 않다.

7. 기능을 확인한다: 주제 없는 임시저장 → 새로고침 복원 → 필수 입력 누락 시 확정 차단 → 파일 첨부 후 확정 → 재접속/다른 기기에서 본인 확정본 조회·다운로드 → 수정 임시저장 상태에서 원본 유지 → 수정 확정 → 다른 계정 접근 차단.

## 검증과 로컬 이력 주의점

```bash
node --test scripts/verify-exploration-storage.mjs
node scripts/verify-exploration-storage-local.mjs
# 로컬 Supabase가 실행 중이어야 한다. 테스트 사용자/파일은 정리한다.
docker exec -i supabase_db_system psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/exploration_activity_storage.sql
npx tsc --noEmit
npx supabase db advisors --local --type security --level warn --fail-on error
```

- 로컬 SQL 권한·유효성·충돌·재시도 테스트와 실제 Storage 업로드/서명 다운로드/20MB 제한/타 계정 접근 거절 검증 완료.
- 전체 migration을 shadow DB에 재생한 후 `public,private,storage` 스키마 차이 없음 확인. 버킷은 스키마 비교 대상 데이터가 아니므로 실제 Storage 테스트로 별도 확인.
- `db pull --local`은 기존 `20260928055251_question_page_size_ten.sql`의 로컬 이력 누락 때문에 중단되었다. 이 기존 이력은 수정하지 않았다. CLI `migration new`로 이번 파일을 만든 뒤 검증한 SQL을 기록하고, 전체 재생 동등성 확인 후 **이번 migration 하나만** `migration repair --local --status applied 20260928100109`로 등록했다.
- 실제 브라우저 조작 테스트는 프로젝트 지침에 따라 실행하지 않았다.

이름 변경 검증: 기존 행의 내용·UUID·소유자·revision을 migration 전후 비교하는 롤백 테스트를 통과했다. 새 API 경로와 테이블/RPC 이름으로 저장 회귀, 실제 파일 업로드·다운로드·권한 검증, 기존 코치 테스트 및 빌드도 통과했다. 전체 migration shadow 재생 후 public/private/storage 스키마 차이가 없음을 확인하고 이름 변경 migration 한 건만 로컬 이력에 등록했다.


## 역할별 조회 범위 (2026-09-29)

`20260929050548_exploration_staff_read.sql`은 컨설턴트 리드·관리자에게 전체 확정 활동의 조회를 허용한다. 컨설턴트는 본인 활동만 조회한다. 관리자 사이드바에도 탐구활동 관리를 표시하며, 관리자 컨설턴트 미리보기에서는 API가 본인 목록·파일만 반환한다. 실제 DB 권한은 계정 역할을 따른다.

타인 활동은 읽기 전용 상세 화면에서 확인하고, 수정·삭제 RPC는 작성자만 허용한다. 임시저장은 기존처럼 본인 브라우저에만 남는다. 타인 첨부파일은 삭제되지 않은 확정 활동의 reports에 실제로 참조된 객체만 읽을 수 있으며 확정 전 업로드·연결 해제된 파일은 공유하지 않는다.

로컬 SQL 역할 회귀, 실제 Storage 다운로드/쓰기 차단, API 테스트, 타입 검사·lint 및 전체 migration 재생을 검증했다. 운영에는 적용하지 않았다.

운영 반영 순서:

```bash
cd /Users/mealdm/Desktop/MEA/system
cat supabase/.temp/project-ref
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

운영 대상은 `epwlcallocdjkmgdmtlv`인지 확인한다. 기존 migration을 모두 적용했다면 이번 예상 파일은 `20260929050548_exploration_staff_read.sql` 한 개다. 다른 파일이 나오면 적용 전에 이력을 검토한다. `--include-all`이나 원격 reset/repair로 강제하지 않는다.

```bash
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

적용 대기가 없음을 확인한 뒤 앱을 배포한다. 컨설턴트는 본인 목록만, 리드·관리자는 전체 목록과 첨부파일을 확인할 수 있는지 검사한다. 타인 활동의 수정·삭제 버튼이 없고 본인 활동은 계속 수정 가능한지도 확인한다.

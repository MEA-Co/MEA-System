# 서비스 공지 데이터·API·권한

## 저장 모델

`public.service_announcements`의 고정 행 `id=1`에 서비스 전체 공지 한 개를 보관한다. 제목(title, 100자), 본문(body, 1,000자)은 일반 텍스트다. `enabled`, 선택적 `starts_at`/`ends_at`(timestamptz), 서버 관리 `revision`/`updated_at`을 갖는다. 최초 행은 빈 내용·비활성 상태다. 시작은 포함, 종료는 제외하며 종료는 시작보다 뒤여야 한다. 활성 공지에는 제목과 본문이 필요하다.

**비공개 초안 보관함이 아니다.** 예약·종료된 공지 원문도 로그인한 회원이 조회할 수 있다. 공개 가능한 서비스 안내만 저장한다. 이는 종료 UPDATE도 회원에게 Realtime으로 전달되도록 하는 계약이다. 비밀 운영 정보나 개인 정보는 넣지 않는다. 익명 사용자에게는 읽기를 허용하지 않는다.

## API

- `GET /api/announcements`: 인증 후 singleton 전체 반환. 401 인증 없음, 503 조회 실패. `Cache-Control: private, no-store`.
- `PUT /api/announcements`: 실제 관리자 + 가입 완료 확인. `{title, body, enabled, starts_at, ends_at, revision}`. 알 수 없는 필드와 잘못된 시간/문구를 거절한다. 성공 시 최신 singleton 반환. 400 입력 오류, 401/403 권한, 409 수정 충돌, 503 DB 실패.
- UI 표시 역할 쿠키를 관리자 권한 판단에 사용하지 않는다. 서버의 실제 계정과 DB RLS 모두 확인한다.

## DB 권한·충돌·삭제

회원은 SELECT만, 실제 관리자는 내용·표시·기간 열만 UPDATE 가능하다. INSERT/DELETE 및 revision/updated_at 직접 변경은 허용하지 않는다. `private.is_admin()`을 UPDATE의 USING/WITH CHECK에 사용한다. 트리거는 invoker로 revision을 1 증가시키고 DB 시간을 기록한다. API는 읽었던 revision과 일치할 때만 원자적으로 UPDATE하고 불일치 시 409를 반환한다. 네트워크 오류 후 재시도도 오래된 revision을 덮어쓰지 않는다.

삭제 대신 `enabled=false`로 종료한다. 별도 이력 보관, 여러 공지 동시 노출, 역할별 대상 지정, 읽음 추적은 이번 범위에 포함하지 않는다. 기존 답변·학습법·탐구활동 테이블과 FK/트리거 관계가 없다.

## 코드 책임

- `lib/announcements/schema.ts`: 입력 계약·활성 기간 판정.
- `app/api/announcements/route.ts`: 인증/관리자 검증·DB 읽기/조건부 갱신.
- `lib/announcements/client.ts`: no-store 조회.
- `components/announcements/ServiceAnnouncement.tsx`: 인증 세션·Realtime·보완 조회·독립 배너 상태.
- `app/(private)/layout.tsx`: 작성 화면과 배너를 형제로 마운트. 공지 변경으로 children 재마운트/refresh하지 않는다.
- `dashboard/_views/announcements/AnnouncementsView.tsx`: 공통 UI 기반 관리자 편집·미리보기·종료.
- 대시보드 접근 설정: 관리자에게만 `announcements` 메뉴를 제공한다.

## 검증·운영

[운영 문서](operations.md)를 따른다. 기존 저장 데이터에 접근하거나 변경하는 migration은 없다. 운영 적용은 별도 진행한다.

## 공지 색상

`color`는 red/yellow/green 중 하나이며 DB 기본값은 yellow다. PUT에서는 선택 항목으로 받아 구버전 클라이언트가 생략하면 현재 색상을 유지한다. 새 UI는 저장 및 종료 시 해당 공지의 색상을 전송한다. color UPDATE 열 권한을 추가하되 관리자 RLS는 유지한다.


## 공통 시간대 기준

**DB 저장은 UTC, 사용자 화면 표시는 한국 시간(`Asia/Seoul`)**으로 통일한다. 로컬과 프로덕션 모두 같은 규칙을 따른다. 시점은 `timestamptz`에 저장하고 API·브라우저 저장에는 시간대가 명시된 문자열을 사용한다. 표시를 위해 저장값에 9시간을 더하거나 원본 시각·충돌 토큰을 변경하지 않는다.

날짜·시각 표시는 공통 `lib/date-time.ts`를 우선 사용하고 별도 표시 형식에도 `timeZone: 'Asia/Seoul'`을 명시한다. `ko-KR`만 지정하거나 UTC 문자열의 날짜 부분만 잘라 표시하지 않는다. 날짜·시간 입력은 한국 시간으로 해석하여 UTC로 변환하며 날짜 전용 값은 제외한다. 한국 자정 전후와 해외 기기 시간대에서도 검증한다. 전체 작업 규칙은 [AGENTS.md 공통 시각 저장·표시 규칙](../../AGENTS.md#공통-시각-저장표시-규칙)을 따른다. 이 절은 필수 구현 기준이며 개별 화면의 적용·검증 상태는 해당 운영 문서와 구분한다.

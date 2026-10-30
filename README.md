# Next.js + TypeScript Starter Setup

## 🧰 macOS 초기 세팅 (Homebrew → nvm)

1. **Homebrew 설치/등록 (설치되어있으면 생략)**

```bash
brew -v || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

2. **nvm 설치 & 셸 로드(zshrc)**

```bash
brew install nvm
mkdir -p ~/.nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && . "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"' >> ~/.zshrc
source ~/.zshrc
```

3. **Node 설치**

```bash
nvm install
```

---

## 📦 포함된 설정

1. **Node 버전 고정 (.nvmrc 사용중)**

   ```bash
   nvm use
   node -v
   ```

2. **ESLint + Prettier**
   - 코드 린팅 및 자동 포맷팅
   - 스크립트:
     ```bash
     npm run lint
     npm run format
     ```

3. **환경변수 관리**
   - `.env` → 개인/비밀 값 (커밋 금지)

4. **Git 설정**
   - `.gitignore` → `node_modules`, `.next`, `dist`, `.env*` 등 제외
   - `.gitattributes` → 개행 통일(LF)
   - `.editorconfig` → 들여쓰기/줄바꿈 통일

5. **타입체크 스크립트**
   - 타입 오류 검사:
     ```bash
     npm run typecheck
     ```

---

## 🚀 사용법

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev

# 코드 포맷팅
npm run format

# 린트 검사
npm run lint

# 타입체크
npm run typecheck
```

---

## 🛠️ 환경 변수

- `.env` 파일에 비밀 값을 작성합니다. (Git에 커밋하지 않음)

## 의존성 보안 점검

의존성 변경은 `package.json`과 `package-lock.json`을 함께 커밋한다. 배포 환경은 `npm ci`로 잠금 파일의 버전을 설치한 뒤 빌드한다. `shadcn`은 빌드 시 CSS를 제공하는 개발 의존성이므로 빌드 전에는 개발 의존성도 설치해야 한다.

```bash
npm audit
npm audit --omit=dev
npm run typecheck
npm run lint
npm run build -- --webpack
```

GitHub Dependabot 경고 개수와 npm audit의 패키지별 집계는 다를 수 있다. 수정 버전과 실제 사용 경로를 확인하고, `npm audit fix --force`로 호환되지 않는 버전이나 구버전을 강제로 설치하지 않는다. 수정 후 커밋·푸시와 앱 재배포를 완료해야 운영에 반영된다. DB migration은 의존성 업데이트와 별개다.

2026-10-30 로컬 점검: Next.js/eslint-config-next 16.4.3, sharp 0.35.5, Zod 4.6.6, shadcn 4.23.0으로 업데이트하고 간접 의존성을 갱신했다. 운영 의존성 audit는 0건이며 전체 audit는 low 3건이다. 잔여 경고는 개발 도구 shadcn → @shadcn/registry → deepmerge의 같은 취약점([GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4))에서 파생된다. 당시 deepmerge 공식 수정 버전은 없으며 npm의 강제 수정 제안(shadcn 1.0.0으로 다운그레이드)은 적용하지 않았다. 개발 의존성으로 분류했다고 취약점 자체가 해결된 것은 아니다. 추후 upstream 수정 버전으로 갱신하고 재점검한다.

타입 검사, 관련 회귀 34개, Webpack 프로덕션 빌드를 통과했다. 전체 린트는 수정하지 않은 검증 스크립트·data 파일에서 오류 28개/경고 7개가 남아 통과하지 못했다. 실제 브라우저 테스트, GitHub 경고 해소 확인, 운영 배포는 수행하지 않았다.

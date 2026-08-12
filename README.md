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

# PR Convention Bridge

<div align="center">

**GitHub/GitLab의 PR/MR 리뷰 코멘트를 AI agents가 활용할 수 있는 Claude Code instruction/skills로 자동 변환하는 Chrome Extension**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF.svg)](https://vitejs.dev/)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4.svg)](https://developer.chrome.com/docs/extensions/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

---

## 📌 프로젝트 개요

팀의 코드 리뷰 과정에서 확립된 **컨벤션과 패턴**을 AI agents(특히 Claude Code)가 자동으로 학습하고 활용할 수 있도록 돕는 도구입니다.

리뷰어가 PR/MR 코멘트에 작성한 규칙이나 패턴을 감지하고, **한 번의 클릭**으로 `.claude/` 디렉토리에 instruction 또는 skill 파일로 저장합니다. 이를 통해 AI가 팀의 코딩 스타일과 규칙을 자동으로 학습하여 일관된 코드를 생성할 수 있습니다.

### ✨ 주요 기능

- **🔍 자동 코멘트 감지**: GitHub PR 및 GitLab MR 페이지에서 리뷰 코멘트를 실시간으로 감지
- **🎯 스마트 버튼 추가**: 컨벤션 관련 코멘트에만 "Convert to AI Instruction" 버튼 표시
- **🧠 키워드 추출**: 코멘트 내용에서 컨벤션 관련 키워드를 자동으로 추출 (영어/한글 지원)
- **📂 파일 매칭**: 기존 `.claude/skills/` 디렉토리의 파일과 매칭하여 업데이트 또는 신규 생성 결정
- **📝 Claude Code 형식 생성**: YAML frontmatter + Markdown 형식의 instruction/skills 파일 자동 생성
- **🚀 자동 PR/MR 생성**: 새로운 브랜치를 생성하고 명료한 커밋 메시지와 함께 PR/MR 자동 생성
- **🎨 다크 모드 지원**: GitHub/GitLab 다크 테마에 자동 적응
- **⚡ 사용자 친화적 UI**: 로딩 애니메이션, 성공/에러 메시지, PR URL 링크 제공

## 기술 스택

- **언어**: TypeScript
- **빌드 도구**: Vite + @crxjs/vite-plugin
- **플랫폼**: Chrome Extension (Manifest V3)
- **API**: GitHub REST API, GitLab REST API

## 개발 환경 설정

### 필수 요구사항

- Node.js 18+
- npm 또는 yarn

### 설치

```bash
npm install
```

### 개발 모드

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

빌드된 파일은 `dist/` 디렉토리에 생성됩니다.

### Chrome에 로드

1. Chrome에서 `chrome://extensions` 접속
2. "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `dist/` 폴더 선택

## 프로젝트 구조

```
pr-convention-bridge/
├── src/
│   ├── content/          # Content scripts (GitHub/GitLab 페이지 주입)
│   ├── background/       # Background service worker
│   ├── popup/            # Extension 설정 팝업
│   ├── core/             # 핵심 비즈니스 로직
│   ├── types/            # TypeScript 타입 정의
│   └── utils/            # 유틸리티 함수
├── public/               # 정적 파일
└── dist/                 # 빌드 결과물
```

## 📖 사용 방법

### 1️⃣ Extension 설치 및 설정

#### Chrome Extension 로드

1. 이 레포지토리를 클론하고 빌드합니다:
   ```bash
   git clone https://github.com/yourusername/pr-convention-bridge.git
   cd pr-convention-bridge
   npm install
   npm run build
   ```

2. Chrome에서 `chrome://extensions` 접속
3. 우측 상단의 **"개발자 모드"** 활성화
4. **"압축해제된 확장 프로그램을 로드합니다"** 클릭
5. `dist/` 폴더 선택

#### API Token 설정

1. Extension 아이콘 클릭 (Chrome 우측 상단)
2. Personal Access Token 입력:

   **GitHub Token 생성:**
   - GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - "Generate new token (classic)" 클릭
   - 필요한 권한: `repo` (전체 레포지토리 접근)
   - Token을 복사하여 Extension 설정에 입력

   **GitLab Token 생성:**
   - GitLab Settings → Access Tokens
   - "Add new token" 클릭
   - 필요한 권한: `api` (전체 API 접근)
   - Token을 복사하여 Extension 설정에 입력

3. **"연결 테스트"** 버튼으로 인증 확인
4. **"설정 저장"** 클릭

### 2️⃣ PR/MR에서 사용하기

#### 시나리오 1: 새로운 Instruction 생성

1. GitHub PR 또는 GitLab MR 페이지 접속
2. 리뷰어가 컨벤션 관련 코멘트 작성 (예시):
   ```
   우리 팀은 컴포넌트 파일명에 PascalCase를 사용합니다.

   올바른 예시:
   ```tsx
   // ✅ UserProfile.tsx
   export function UserProfile() {
     return <div>Profile</div>;
   }
   ```

   잘못된 예시:
   ```tsx
   // ❌ userProfile.tsx
   export function userProfile() {
     return <div>Profile</div>;
   }
   ```
   ```

3. 코멘트 하단에 **"Convert to AI Instruction"** 버튼 클릭
4. 버튼 상태: "Processing..." → "Converted!"
5. 성공 메시지에서 **"PR 보기 →"** 링크 클릭
6. 생성된 PR 검토 및 병합

**결과:**
- 새 브랜치: `ai-instruction/add-naming-convention`
- 새 파일: `.claude/instructions/component-naming.md`
- PR 제목: "Add AI instruction: Component Naming"

#### 시나리오 2: 기존 Skill 업데이트

1. 이미 `.claude/skills/code-style.md` 파일이 존재하는 경우
2. 새로운 스타일 관련 코멘트 작성:
   ```
   함수는 최대 50줄을 넘지 않도록 합니다.
   ```

3. **"Convert to AI Instruction"** 버튼 클릭
4. Extension이 기존 파일을 자동으로 찾아 업데이트

**결과:**
- PR 제목: "Update AI instruction: Code Style"
- 기존 파일에 "추가 사례" 섹션 추가
- `last_updated` 날짜 자동 갱신

### 3️⃣ 생성된 파일 예시

#### Instruction 파일 (`.claude/instructions/component-naming.md`)

```markdown
---
title: "Component Naming"
keywords: ["naming", "component", "react", "convention"]
category: "naming"
created_from: "PR #123, Comment by @reviewer"
created_at: "2026-01-15"
last_updated: "2026-01-15"
---

# Component Naming

## 규칙
우리 팀은 컴포넌트 파일명에 PascalCase를 사용합니다.

## 예시

### 예시 1

\```tsx
// ✅ UserProfile.tsx
export function UserProfile() {
  return <div>Profile</div>;
}
\```

### 예시 2

\```tsx
// ❌ userProfile.tsx
export function userProfile() {
  return <div>Profile</div>;
}
\```

## 출처
이 컨벤션은 [PR #123](https://github.com/owner/repo/pull/123)의 리뷰 과정에서 확립되었습니다.
- 작성자: @reviewer
- 작성일: 2026. 1. 15.
```

## 🚧 개발 단계

- [x] **Phase 1**: 프로젝트 초기화 (TypeScript, Vite, Manifest V3)
- [x] **Phase 2**: Content Script - GitHub 통합 (코멘트 감지 및 버튼 추가)
- [x] **Phase 3**: Content Script - GitLab 통합 (코멘트 감지 및 버튼 추가)
- [x] **Phase 4**: 설정 팝업 UI (Token 입력 및 저장)
- [x] **Phase 5**: Background Service Worker (API 클라이언트)
- [x] **Phase 6**: 코멘트 파싱 로직 (키워드 추출, 카테고리 분류)
- [x] **Phase 7**: 파일 매칭 로직 (.claude/ 디렉토리 탐색, 스코어링 알고리즘)
- [x] **Phase 8**: Instruction/Skills 생성 (Claude Code 형식)
- [x] **Phase 9**: PR/MR 생성 로직 (브랜치, 커밋, PR 생성)
- [x] **Phase 10**: 통합 및 End-to-End 테스트
- [x] **Phase 11**: UI/UX 개선 (다크 모드, 애니메이션, 에러 핸들링)
- [x] **Phase 12**: 문서화 및 배포 준비

## 🔧 문제 해결 (Troubleshooting)

### 버튼이 표시되지 않아요

**원인:**
- Extension 설정에서 버튼 표시가 비활성화됨
- 코멘트가 컨벤션 관련 내용으로 감지되지 않음

**해결:**
1. Extension 아이콘 클릭 → "Show 'Convert to Instruction' buttons" 체크 확인
2. 코멘트에 "convention", "rule", "pattern" 등의 키워드 포함
3. 페이지 새로고침 (F5)

### "API Token이 설정되지 않았습니다" 에러

**해결:**
1. Extension 아이콘 클릭
2. GitHub 또는 GitLab Token 입력
3. "연결 테스트" 버튼으로 인증 확인
4. "설정 저장" 클릭

### "권한 부족: 레포지토리에 쓰기 권한이 필요합니다" 에러

**원인:**
- Personal Access Token의 권한이 부족함

**해결:**
- **GitHub**: Token 권한에 `repo` (전체) 포함 확인
- **GitLab**: Token 권한에 `api` 포함 확인
- 새 Token을 생성하여 Extension 설정에서 업데이트

### "이미 동일한 브랜치가 존재합니다" 에러

**원인:**
- 이전에 생성한 브랜치가 아직 병합되지 않음

**해결:**
1. 기존 PR을 먼저 병합하거나 닫기
2. 또는 브랜치를 삭제한 후 다시 시도

### Chrome DevTools로 디버깅하기

**Content Script 로그 확인:**
1. PR/MR 페이지에서 F12 (DevTools)
2. Console 탭에서 `[PR Convention Bridge]` 접두사가 있는 로그 확인

**Background Service Worker 로그 확인:**
1. `chrome://extensions` 접속
2. "PR Convention Bridge" 확장 프로그램 찾기
3. "service worker" 링크 클릭
4. Console 탭에서 로그 확인

## 🤝 기여하기 (Contributing)

이 프로젝트는 오픈소스이며 기여를 환영합니다!

### 기여 방법

1. 이 레포지토리를 Fork합니다
2. Feature 브랜치를 생성합니다: `git checkout -b feature/amazing-feature`
3. 변경사항을 커밋합니다: `git commit -m 'feat: add amazing feature'`
4. 브랜치에 Push합니다: `git push origin feature/amazing-feature`
5. Pull Request를 생성합니다

### 커밋 메시지 컨벤션

- `feat:` - 새로운 기능 추가
- `fix:` - 버그 수정
- `docs:` - 문서 수정
- `style:` - 코드 스타일 변경 (기능 변경 없음)
- `refactor:` - 코드 리팩토링
- `test:` - 테스트 추가 또는 수정
- `chore:` - 빌드 설정, 패키지 매니저 등

### 버그 리포트 및 기능 제안

GitHub Issues를 통해 버그 리포트 또는 기능 제안을 해주세요!

## 📚 관련 문서

- [TESTING.md](./TESTING.md) - 테스트 가이드 및 시나리오
- [Claude Code 문서](https://docs.anthropic.com/claude/docs) - Claude Code 플러그인 형식 가이드
- [Chrome Extension 개발 가이드](https://developer.chrome.com/docs/extensions/)

## ❓ FAQ

### Q1: 어떤 코멘트가 "컨벤션 관련"으로 감지되나요?

다음 키워드를 포함한 코멘트가 감지됩니다:
- "convention", "rule", "pattern", "guideline", "standard"
- "컨벤션", "규칙", "패턴", "가이드라인"
- "should", "must", "always", "never"
- 또는 코드 예시(```)가 포함된 구조적인 설명

### Q2: 생성된 파일의 카테고리는 어떻게 결정되나요?

코멘트 내용을 분석하여 다음 카테고리 중 하나로 자동 분류됩니다:
- `naming` - 변수, 함수, 클래스 네이밍
- `style` - 코드 스타일 및 포매팅
- `architecture` - 시스템 설계 및 구조
- `testing` - 테스트 패턴
- `security` - 보안 관련 규칙
- `performance` - 성능 최적화
- `error-handling` - 에러 처리 패턴
- `documentation` - 문서화 규칙

### Q3: GitLab self-hosted 인스턴스에서도 작동하나요?

현재는 `gitlab.com`만 지원합니다. Self-hosted GitLab 지원은 향후 추가될 예정입니다.

### Q4: 생성된 PR을 자동으로 병합할 수 있나요?

보안 및 품질 관리를 위해 자동 병합 기능은 제공하지 않습니다. 생성된 PR을 팀원이 검토한 후 수동으로 병합하는 것을 권장합니다.

### Q5: 여러 개의 코멘트를 한 번에 처리할 수 있나요?

현재는 각 코멘트마다 개별적으로 버튼을 클릭해야 합니다. 일괄 처리 기능은 향후 추가될 예정입니다.

## 📝 라이선스

MIT License - 자유롭게 사용, 수정, 배포할 수 있습니다.

자세한 내용은 [LICENSE](./LICENSE) 파일을 참고하세요.

## 🎯 로드맵

### v1.1 (계획)
- [ ] GitLab self-hosted 지원
- [ ] 일괄 처리 기능 (여러 코멘트 동시 처리)
- [ ] AI를 활용한 자동 카테고리 분류 개선
- [ ] 팀별 커스텀 키워드 사전 설정
- [ ] 통계 대시보드 (생성된 instruction 수, 카테고리별 분포)

### v1.2 (계획)
- [ ] Bitbucket 지원
- [ ] Azure DevOps 지원
- [ ] 코멘트 템플릿 기능
- [ ] PR 리뷰 자동 분석

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트들의 도움을 받았습니다:
- [Vite](https://vitejs.dev/) - 빠른 빌드 도구
- [TypeScript](https://www.typescriptlang.org/) - 타입 안전성
- [@crxjs/vite-plugin](https://github.com/crxjs/chrome-extension-tools) - Chrome Extension 빌드 플러그인
- [Claude Code](https://claude.com/claude-code) - AI agent 플러그인 형식

## 📧 문의

질문이나 제안사항이 있으시면 [GitHub Issues](https://github.com/yourusername/pr-convention-bridge/issues)를 통해 연락주세요!

---

<div align="center">

**Made with ❤️ by the PR Convention Bridge team**

⭐ 이 프로젝트가 도움이 되셨다면 Star를 눌러주세요!

</div>

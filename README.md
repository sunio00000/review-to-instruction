# PR Convention Bridge

GitHub/GitLab의 PR/MR 리뷰 코멘트를 AI agents가 활용할 수 있는 Claude Code instruction/skills로 변환하는 Chrome Extension입니다.

## 프로젝트 개요

팀의 코드 리뷰 과정에서 확립된 컨벤션과 패턴을 AI agents가 자동으로 학습하고 활용할 수 있도록 돕는 도구입니다.

### 주요 기능

- **코멘트 감지**: GitHub PR 및 GitLab MR 페이지에서 리뷰 코멘트 자동 감지
- **버튼 추가**: 각 코멘트에 "Convert to AI Instruction" 버튼 추가
- **키워드 추출**: 코멘트 내용에서 컨벤션 관련 키워드 자동 추출
- **파일 매칭**: 기존 `.claude/` 디렉토리의 skills/instructions와 매칭
- **자동 생성**: Claude Code 플러그인 형식의 instruction/skills 파일 생성
- **PR/MR 생성**: 새로운 브랜치와 PR/MR을 자동으로 생성

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

## 사용 방법

1. **설정**: Extension 아이콘 클릭 → GitHub/GitLab Personal Access Token 입력
2. **PR/MR 열기**: GitHub PR 또는 GitLab MR 페이지 접속
3. **버튼 클릭**: 컨벤션 관련 코멘트 하단의 "Convert to AI Instruction" 버튼 클릭
4. **검토 및 병합**: 생성된 PR을 검토하고 병합

## 개발 단계

- [x] Phase 1: 프로젝트 초기화
- [ ] Phase 2: Content Script - GitHub 통합
- [ ] Phase 3: Content Script - GitLab 통합
- [ ] Phase 4: 설정 팝업 UI
- [ ] Phase 5: Background Service Worker
- [ ] Phase 6: 코멘트 파싱 로직
- [ ] Phase 7: 파일 매칭 로직
- [ ] Phase 8: Instruction/Skills 생성
- [ ] Phase 9: PR/MR 생성 로직
- [ ] Phase 10: 통합 테스트
- [ ] Phase 11: UI/UX 개선
- [ ] Phase 12: 문서화 및 배포

## 라이선스

MIT

# Release v1.0.0

**Release Date:** 2026-01-29

## 무엇을 하나요?

GitHub/GitLab의 PR 리뷰 코멘트를 클릭 한 번으로 Claude Code, Cursor, Windsurf용 AI instruction 파일로 자동 변환합니다.

## 지원 플랫폼

### Git 플랫폼
- **GitHub** (github.com)
- **GitLab** (gitlab.com, self-hosted 지원)

### AI 도구 및 생성 위치
- **Claude Code**
  - `.claude/rules/*.md` - 코딩 규칙 및 컨벤션
  - `.claude/skills/*.md` - 반복 가능한 작업 패턴
- **Cursor**
  - `.cursor/rules/*.md` - 코딩 가이드라인
- **Windsurf**
  - `.windsurf/rules/*.md` - 개발 규칙

## 설치 및 실행

**⚠️ 현재 Chrome Web Store에 배포되지 않았습니다. 직접 빌드하여 설치해야 합니다.**

```bash
git clone https://github.com/sunio00000/review-to-instruction.git
cd review-to-instruction
npm install
npm run build
```

Chrome에서 `chrome://extensions` → 개발자 모드 활성화 → "압축해제된 확장 프로그램을 로드합니다" → `dist/` 폴더 선택

## 주요 기능

### 🔘 자동 버튼 추가
PR/MR 리뷰 코멘트를 자동으로 감지하여 "Convert to AI Instruction" 버튼을 추가합니다. 컨벤션 키워드(convention, rule, pattern 등), 코드 예시, 이모지(✅❌) 중 하나 이상이 포함된 코멘트에 활성화됩니다.

### 🧵 토론 스레드 통합 변환
2개 이상의 코멘트로 구성된 토론 스레드를 감지하고, 보라색 "Convert Thread (N comments)" 버튼을 추가합니다. 전체 토론의 진행 과정, 합의 사항, 실행 가능한 결론을 하나의 통합된 instruction으로 변환합니다.

### 🤖 LLM 기반 지능형 분석
- **요약 및 설명 생성**: 코멘트 내용을 구조화된 규칙으로 변환
- **코드 예시 분석**: Good/Bad 예시를 자동으로 분류하고 설명 추가
- **스마트 파일명**: 추상화된 범용 파일명 생성 (예: "button-naming" → "component-naming")
- **프로젝트 패턴 학습**: 기존 파일의 네이밍 패턴(kebab-case, PascalCase 등) 자동 감지
- **지원 LLM**: Claude API (Anthropic), OpenAI API (GPT-4, GPT-3.5)

### 🔒 보안 강화
- **마스터 비밀번호 암호화**: GitHub/GitLab API 토큰을 PBKDF2 (500,000 iterations) + AES-GCM으로 암호화
- **세션 유지**: chrome.storage.session을 통해 브라우저 사용 중 비밀번호 유지
- **자동 삭제**: 브라우저 종료 시 마스터 비밀번호 자동 삭제
- **동적 아이콘**: 잠금 상태를 브라우저 툴바 아이콘으로 표시 (Active/Locked/Off)

### 📝 기존 파일 보존
새로운 규칙을 추가할 때 기존 파일 내용을 완전히 보존합니다. 덮어쓰지 않고 `## Update (날짜)` 섹션으로 변경사항을 추가하여 히스토리를 추적할 수 있습니다.

### 💰 비용 최적화
- **LLM 캐싱**: 동일한 요청에 대해 캐시 활용 (TTL 24시간)
- **비용 절감**: 50-70% API 호출 비용 절감
- **토큰 추적**: 실시간 토큰 사용량 및 예상 비용 표시
- **중복 방지**: 유사한 instruction 감지 시 기존 파일 업데이트로 파일 개수 최소화

## 라이선스

MIT License

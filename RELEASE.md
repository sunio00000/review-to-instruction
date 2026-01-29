# Release v1.0.0

**Release Date:** 2026-01-29

## 무엇을 하나요?

GitHub/GitLab의 PR 리뷰 코멘트를 클릭 한 번으로 Claude Code, Cursor, Windsurf용 AI instruction 파일로 자동 변환합니다.

## 지원 플랫폼

### Git 플랫폼
- GitHub (github.com)
- GitLab (gitlab.com, self-hosted)

### AI 도구
- Claude Code (`.claude/rules/`, `.claude/skills/`)
- Cursor (`.cursor/rules/`)
- Windsurf (`.windsurf/rules/`)

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

- 🔘 리뷰 코멘트에 변환 버튼 자동 추가
- 🧵 토론 스레드(2개 이상 코멘트) 통합 변환
- 🤖 LLM 기반 요약 및 분석 (Claude API, OpenAI API)
- 🔒 마스터 비밀번호로 API 토큰 암호화
- 📝 기존 파일 보존 및 업데이트 (덮어쓰지 않음)
- 💰 LLM 캐싱으로 50-70% 비용 절감

## 라이선스

MIT License

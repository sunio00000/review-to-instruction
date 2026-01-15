# PR Convention Bridge - 테스트 가이드

## 개요

이 문서는 PR Convention Bridge의 End-to-End 테스트 시나리오와 검증 방법을 설명합니다.

## 사전 준비

### 1. Chrome Extension 설치

```bash
npm run build
```

1. Chrome에서 `chrome://extensions` 접속
2. "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `dist/` 폴더 선택

### 2. API Token 설정

1. Extension 아이콘 클릭
2. GitHub/GitLab Personal Access Token 입력
3. "연결 테스트" 버튼으로 인증 확인

**필요한 권한:**
- GitHub: `repo` (전체 레포지토리 접근)
- GitLab: `api` (전체 API 접근)

## 테스트 시나리오

### 시나리오 1: 새 Instruction 생성 (GitHub)

**목표:** GitHub PR 코멘트에서 새로운 instruction 파일을 생성하고 PR을 생성합니다.

**준비:**
1. 테스트용 GitHub 레포지토리 생성
2. `.claude/instructions/` 디렉토리 생성 (선택사항)
3. 테스트 PR 생성

**실행 단계:**

1. PR 페이지 접속
2. 다음과 같은 컨벤션 코멘트 작성:
   ```
   우리 팀의 컴포넌트 네이밍 컨벤션입니다.

   컴포넌트 파일명은 PascalCase를 사용해야 합니다.

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

3. 코멘트 하단의 "Convert to AI Instruction" 버튼 클릭
4. 버튼 상태가 "Processing..." → "Converted!"로 변경되는지 확인

**검증:**

1. 새로운 PR이 생성되었는지 확인
   - PR 제목: "Add AI instruction: Naming Conventions" (또는 유사)
   - 타겟 브랜치: 원본 PR의 브랜치
   - 소스 브랜치: `ai-instruction/add-naming-convention` (또는 유사)

2. PR 내용 확인
   - 파일 경로: `.claude/instructions/naming-conventions.md` (또는 유사)
   - YAML frontmatter 포함 여부
   - 코드 예시 포함 여부
   - 출처 정보 (PR 번호, 작성자, 링크) 포함 여부

3. 생성된 파일 내용 확인
   ```markdown
   ---
   title: "Naming Conventions"
   keywords: ["naming", "convention", "component"]
   category: "naming"
   created_from: "PR #1, Comment by username"
   created_at: "2026-01-15"
   last_updated: "2026-01-15"
   ---

   # Naming Conventions

   ## 규칙
   우리 팀의 컴포넌트 네이밍 컨벤션입니다...

   ## 예시
   ...

   ## 출처
   이 컨벤션은 PR #1의 리뷰 과정에서 확립되었습니다.
   ```

### 시나리오 2: 기존 Skill 업데이트 (GitHub)

**목표:** 기존 skill 파일을 찾아 업데이트합니다.

**준비:**
1. `.claude/skills/code-style.md` 파일 생성:
   ```markdown
   ---
   title: "Code Style"
   keywords: ["style", "formatting"]
   category: "style"
   created_at: "2026-01-01"
   last_updated: "2026-01-01"
   ---

   # Code Style

   ## 설명
   기본 코드 스타일 규칙
   ```

2. 새 PR에 스타일 관련 코멘트 작성:
   ```
   함수는 최대 50줄을 넘지 않도록 합니다.

   이 규칙은 코드 가독성을 위한 스타일 컨벤션입니다.
   ```

**실행 단계:**
1. "Convert to AI Instruction" 버튼 클릭
2. 버튼이 성공 상태로 변경되는지 확인

**검증:**
1. 기존 파일이 업데이트되었는지 확인 (새 파일이 아님)
2. PR 제목: "Update AI instruction: Code Style"
3. 파일 내용에 "추가 사례" 섹션이 추가되었는지 확인
4. 키워드가 병합되었는지 확인
5. `last_updated` 날짜가 갱신되었는지 확인

### 시나리오 3: GitLab MR 테스트

**목표:** GitLab에서도 동일하게 작동하는지 확인합니다.

**실행 단계:**
1. GitLab MR 페이지 접속
2. 컨벤션 관련 코멘트 작성
3. "Convert to AI Instruction" 버튼 클릭

**검증:**
- GitHub와 동일한 동작
- MR이 정상적으로 생성되는지 확인

### 시나리오 4: 에러 처리

**목표:** 다양한 에러 케이스를 확인합니다.

**테스트 케이스:**

1. **컨벤션이 아닌 일반 코멘트**
   - 입력: "This looks good!"
   - 예상: 에러 메시지 "이 코멘트는 컨벤션 관련 내용이 아닙니다."

2. **Token 미설정**
   - Extension 설정에서 Token 제거
   - 버튼 클릭
   - 예상: 에러 메시지 "github token이 설정되지 않았습니다."

3. **권한 부족**
   - 읽기 전용 레포지토리에서 시도
   - 예상: API 에러 메시지

4. **네트워크 오류**
   - 인터넷 연결 끊고 시도
   - 예상: 네트워크 에러 메시지

## 성능 테스트

### 응답 시간

- 버튼 클릭부터 PR 생성까지: **약 5-10초**
  - 코멘트 파싱: < 1초
  - .claude/ 디렉토리 탐색: 1-3초
  - 파일 생성: < 1초
  - 브랜치 생성: 1-2초
  - PR 생성: 1-2초

### 대량 코멘트

- 100개 코멘트가 있는 PR 페이지: 버튼 추가 < 2초
- MutationObserver 디바운싱으로 성능 최적화됨

## 회귀 테스트 체크리스트

새로운 변경 사항이 있을 때마다 다음을 확인:

- [ ] GitHub PR 페이지에서 버튼이 표시되는가?
- [ ] GitLab MR 페이지에서 버튼이 표시되는가?
- [ ] 컨벤션 코멘트에만 버튼이 작동하는가?
- [ ] 새 instruction 파일이 올바르게 생성되는가?
- [ ] 기존 skill 파일이 올바르게 업데이트되는가?
- [ ] PR/MR이 올바른 브랜치로 생성되는가?
- [ ] 커밋 메시지가 명료한가?
- [ ] PR 본문에 파일 미리보기가 포함되는가?
- [ ] 에러 메시지가 사용자 친화적인가?
- [ ] API Token 테스트가 작동하는가?

## 알려진 제한사항

1. **코드 블록이 없는 코멘트**
   - 코드 예시가 없어도 작동하지만, 생성된 파일에 예시 섹션이 비어있을 수 있음

2. **복잡한 YAML frontmatter**
   - 현재 간단한 key:value와 배열만 파싱
   - 중첩 객체는 지원하지 않음

3. **매우 긴 코멘트**
   - PR 본문 미리보기는 30줄까지만 표시

4. **브랜치명 중복**
   - 동일한 키워드로 여러 번 생성 시 브랜치명이 중복될 수 있음
   - 이 경우 API에서 에러 발생

## 디버깅

문제가 발생하면:

1. **Chrome DevTools Console 확인**
   - F12 → Console 탭
   - `[PR Convention Bridge]` 접두사가 있는 로그 확인

2. **Background Service Worker 로그**
   - `chrome://extensions` → PR Convention Bridge → "service worker" 링크 클릭

3. **네트워크 요청 확인**
   - DevTools → Network 탭
   - GitHub/GitLab API 요청 확인

4. **설정 확인**
   - Extension 팝업에서 Token이 올바르게 설정되었는지 확인
   - "연결 테스트" 버튼으로 인증 확인

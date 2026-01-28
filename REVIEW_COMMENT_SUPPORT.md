# 리뷰 코멘트 지원 가이드

## 문제 상황

기존에는 일반 PR/MR 코멘트에서만 "Convert to AI Instruction" 버튼이 표시되고, 리뷰 코멘트(인라인 코드 리뷰, diff 노트)에서는 버튼이 표시되지 않았습니다.

## 해결 방법

### 1. GitHub 리뷰 코멘트 선택자 추가

GitHub PR 페이지에서 다음과 같은 리뷰 코멘트를 감지합니다:

#### 일반 타임라인 코멘트
- `.timeline-comment` - PR 대화 탭의 일반 코멘트

#### 리뷰 코멘트
- `.review-comment` - 리뷰 제출 후 코멘트
- `.inline-comment` - 인라인 코드 리뷰 코멘트
- `.js-comment` - JavaScript로 동적 생성된 코멘트
- `.js-comment-container` - 코멘트 컨테이너

#### 디스커션 코멘트
- `div[id^="discussion_r"]` - 디스커션 ID로 시작하는 코멘트
- `div[id^="pullrequestreview"]` - PR 리뷰 ID로 시작하는 코멘트

#### 본문 선택자
- `.comment-body` - 기본 코멘트 본문
- `.js-comment-body` - JS 타겟 본문
- `.review-comment-contents .comment-body` - 리뷰 코멘트 본문
- `.edit-comment-hide` - 편집 가능 코멘트

### 2. GitLab 리뷰 코멘트 선택자 추가

GitLab MR 페이지에서 다음과 같은 리뷰 코멘트를 감지합니다:

#### 일반 노트
- `.note` - 모든 GitLab 노트
- `[data-testid="note"]` - data-testid 속성
- `.timeline-entry` - 타임라인 엔트리
- `.discussion-note` - 디스커션 노트
- `article[data-note-id]` - article with note id

#### Diff 노트 (리뷰 코멘트)
- `.diff-note` - diff 내부 노트
- `.note-wrapper` - 노트 래퍼
- `li.note` - li 태그 노트
- `[data-note-type="DiffNote"]` - diff 노트 타입
- `.discussion-reply-holder .note` - 답글 노트

#### 본문 선택자
- `.note-text` - 기본 노트 텍스트
- `[data-testid="note-text"]` - data-testid 속성
- `.timeline-entry-body` - 타임라인 본문
- `.note-body` - 노트 본문
- `.js-note-text` - JS 타겟 클래스
- `.note-text.md` - 마크다운 노트 텍스트
- `.note-body .note-text` - 노트 본문 내부 텍스트

## 테스트 방법

### GitHub PR 페이지 테스트

1. **일반 코멘트 테스트**
   - PR 대화 탭에서 새 코멘트 작성
   - 버튼이 코멘트 하단에 표시되는지 확인

2. **인라인 리뷰 코멘트 테스트**
   - Files changed 탭에서 특정 라인에 코멘트 작성
   - 버튼이 코멘트 하단에 표시되는지 확인

3. **리뷰 제출 후 코멘트 테스트**
   - Start a review로 여러 코멘트 작성
   - Finish your review로 리뷰 제출
   - 각 리뷰 코멘트에 버튼이 표시되는지 확인

4. **답글 코멘트 테스트**
   - 기존 코멘트에 답글 작성
   - 답글에도 버튼이 표시되는지 확인

### GitLab MR 페이지 테스트

1. **일반 디스커션 노트 테스트**
   - Overview 탭에서 새 코멘트 작성
   - 버튼이 노트 하단에 표시되는지 확인

2. **Diff 노트 테스트**
   - Changes 탭에서 특정 라인에 코멘트 작성
   - 버튼이 diff 노트 하단에 표시되는지 확인

3. **Thread 답글 테스트**
   - 기존 디스커션에 답글 작성
   - 답글에도 버튼이 표시되는지 확인

## 디버깅 방법

버튼이 표시되지 않는 경우 브라우저 개발자 도구(F12)로 확인:

### 1. 코멘트 엘리먼트 확인
```javascript
// GitHub
document.querySelectorAll('.review-comment, .inline-comment')

// GitLab
document.querySelectorAll('.diff-note, [data-note-type="DiffNote"]')
```

### 2. 버튼 컨테이너 확인
```javascript
document.querySelectorAll('.review-to-instruction-button-container')
```

### 3. 코멘트 본문 확인
```javascript
// GitHub
document.querySelectorAll('.comment-body, .js-comment-body')

// GitLab
document.querySelectorAll('.note-text, [data-testid="note-text"]')
```

## 알려진 제약사항

1. **Pending 리뷰 코멘트**: GitHub에서 "Start a review" 상태의 pending 코멘트는 버튼이 표시되지 않을 수 있습니다 (리뷰 제출 후 표시됨)

2. **동적 로딩**: 무한 스크롤이나 동적 로딩으로 추가된 코멘트는 MutationObserver가 감지할 때까지 약간의 지연(~100ms)이 있을 수 있습니다

3. **커스텀 GitLab 인스턴스**: GitLab Enterprise나 커스텀 인스턴스는 DOM 구조가 다를 수 있어 추가 선택자가 필요할 수 있습니다

## 향후 개선 사항

1. **선택자 자동 감지**: DOM 구조를 자동으로 분석하여 적절한 선택자 찾기
2. **성능 최적화**: 선택자 우선순위 조정으로 빠른 매칭
3. **에러 리포팅**: 버튼이 추가되지 않은 코멘트를 추적하고 리포트
4. **A/B 테스트**: 여러 선택자 조합의 효과 측정

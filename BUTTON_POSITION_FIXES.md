# Convert To AI Instruction 버튼 위치 개선

## 문제점

기존 버튼 삽입 로직이 단순히 `contentElement.parentElement`를 사용하여 버튼을 삽입했기 때문에, GitHub와 GitLab의 실제 DOM 구조를 고려하지 못했습니다.

### 기존 문제
1. 버튼이 코멘트 본문과 떨어져서 표시될 수 있음
2. Thread 버튼이 적절한 헤더 위치에 배치되지 않음
3. 플랫폼별 DOM 구조 차이를 고려하지 않음

## 개선 사항

### 1. 개별 코멘트 버튼 위치 개선

#### `findCommentContainer` 메서드 추가
- GitHub와 GitLab의 코멘트 컨테이너를 정확하게 찾음
- GitHub: `.timeline-comment`, `.review-comment`, `.js-comment`
- GitLab: `.note`, `[data-testid="note"]`, `.timeline-entry`, `.discussion-note`

#### `findInsertionPoint` 메서드 추가
- 플랫폼별 최적의 버튼 삽입 위치 결정
- GitHub: `.comment-body` 바로 다음
- GitLab: `.note-text` 또는 `[data-testid="note-text"]` 바로 다음

### 2. Thread 버튼 위치 개선

#### `findThreadButtonInsertionPoint` 메서드 추가
- 코멘트 헤더의 actions 영역을 우선적으로 찾음
- GitHub:
  - `.timeline-comment-actions` 또는 `.comment-actions` 내부
  - Fallback: `.timeline-comment-header`
- GitLab:
  - `.note-actions` 또는 `.note-header-actions` 내부
  - Fallback: `.note-header`

### 3. CSS 스타일 개선

#### 버튼 컨테이너 스타일
```css
.review-to-instruction-button-container {
  margin-top: 12px;
  margin-bottom: 8px;
  padding: 0 16px;  /* GitHub/GitLab 코멘트 여백과 일치 */
}
```

#### Thread 버튼 배치
```css
/* 헤더 내부 Thread 버튼 */
.timeline-comment-header .review-to-instruction-thread-button-container {
  margin-left: auto;  /* 헤더 우측에 배치 */
  padding-left: 12px;
}
```

## 테스트 체크리스트

### GitHub PR 페이지
- [ ] 개별 코멘트에 버튼이 본문 바로 아래에 표시됨
- [ ] 리뷰 코멘트에 버튼이 올바른 위치에 표시됨
- [ ] Thread 버튼이 첫 코멘트 헤더의 우측에 표시됨
- [ ] 다크 모드에서 버튼 스타일이 정상적으로 표시됨

### GitLab MR 페이지
- [ ] 개별 노트에 버튼이 본문 바로 아래에 표시됨
- [ ] 디스커션 답글에 버튼이 올바른 위치에 표시됨
- [ ] Thread 버튼이 첫 노트 헤더의 우측에 표시됨
- [ ] GitLab 다크 모드에서 버튼 스타일이 정상적으로 표시됨

## 파일 변경 내역

### src/content/ui-builder.ts
- `findCommentContainer()`: 코멘트 컨테이너 찾기 (71줄 추가)
- `findInsertionPoint()`: 삽입 위치 결정 (24줄 추가)
- `findThreadButtonInsertionPoint()`: Thread 버튼 위치 결정 (49줄 추가)
- `insertButton()`: 개선된 삽입 로직 (17줄 수정)
- `insertThreadButton()`: 개선된 Thread 버튼 삽입 (15줄 수정)

### src/content/styles.css
- 버튼 컨테이너 플랫폼별 스타일 추가 (18줄)
- Thread 버튼 컨테이너 배치 스타일 추가 (22줄)

## 향후 개선 가능 사항

1. **동적 DOM 변경 감지**: MutationObserver를 사용하여 동적으로 추가되는 코멘트에도 버튼을 올바르게 배치
2. **더 많은 Fallback**: 다양한 GitHub/GitLab 버전과 커스텀 인스턴스 지원
3. **성능 최적화**: 선택자 캐싱으로 DOM 쿼리 성능 개선
4. **접근성 개선**: ARIA 레이블과 키보드 네비게이션 지원

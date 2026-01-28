# Service Worker 문제 해결 가이드

## "비활성" 상태는 정상입니다

Chrome Extension Manifest V3의 Service Worker는 이벤트가 없을 때 자동으로 비활성화됩니다. 이것은 **정상적인 동작**입니다.

## 실제 문제 확인 방법

### 1. Service Worker 오류 확인

1. Chrome 확장 프로그램 페이지 열기: `chrome://extensions/`
2. 개발자 모드 활성화 (우측 상단 토글)
3. "Review to Instruction" 확장 프로그램 찾기
4. **"뷰 검사 서비스 워커"** 클릭 (비활성 상태여도 클릭 가능)
5. DevTools의 Console 탭에서 오류 확인

### 2. Service Worker 강제 활성화 테스트

Service Worker DevTools가 열리면:
- Console에서 다음 명령 실행:
  ```javascript
  console.log('Service Worker is alive!');
  chrome.runtime.getManifest();
  ```
- 정상적으로 manifest 객체가 출력되면 작동 중

### 3. 메시지 통신 테스트

Service Worker DevTools Console에서:
```javascript
// Storage 확인
chrome.storage.sync.get(null, (data) => {
  console.log('Sync storage:', data);
});

chrome.storage.local.get(null, (data) => {
  console.log('Local storage:', data);
});
```

### 4. Content Script와 통신 테스트

1. GitHub PR 페이지 열기 (예: `https://github.com/*/pull/*`)
2. 페이지에서 F12 눌러 DevTools 열기
3. Console에서:
   ```javascript
   // Content Script가 로드되었는지 확인
   console.log('Review to Instruction buttons:',
     document.querySelectorAll('[data-review-to-instruction]'));
   ```

## 일반적인 문제와 해결 방법

### 문제 1: Service Worker가 계속 충돌함
- **증상**: DevTools에서 오류 메시지 반복
- **해결**:
  1. 확장 프로그램 제거
  2. Chrome 재시작
  3. 확장 프로그램 재설치

### 문제 2: Content Script가 작동하지 않음
- **증상**: GitHub/GitLab PR 페이지에 버튼이 나타나지 않음
- **해결**:
  1. 페이지 새로고침 (Ctrl+R)
  2. 확장 프로그램 비활성화 후 다시 활성화
  3. 콘솔에서 오류 확인

### 문제 3: Storage 데이터가 사라짐
- **증상**: API 토큰이 저장되지 않거나 사라짐
- **해결**:
  1. `chrome://extensions/` → "Review to Instruction" → "뷰 검사 서비스 워커"
  2. Console에서 Storage 확인:
     ```javascript
     chrome.storage.local.get(null, console.log);
     ```
  3. 필요시 Popup에서 토큰 재입력

## Service Worker 정상 작동 확인 체크리스트

- [ ] `chrome://extensions/`에서 확장 프로그램이 활성화되어 있음
- [ ] "뷰 검사 서비스 워커" 클릭 시 DevTools가 열림
- [ ] DevTools Console에 오류가 없음
- [ ] GitHub/GitLab PR 페이지에서 Content Script 버튼이 보임
- [ ] Popup 설정 페이지가 정상적으로 열림
- [ ] API 토큰이 정상적으로 저장됨

## 추가 지원

위 방법으로 해결되지 않으면:
1. DevTools Console의 오류 메시지 캡처
2. GitHub Issues에 보고: https://github.com/sunio00000/review-to-instruction/issues

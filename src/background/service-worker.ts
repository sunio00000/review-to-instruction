/**
 * Review to Instruction - Background Service Worker
 */

import type { Message, MessageResponse } from '../types';
import { handleMessage } from './message-handler';
import { iconManager } from './services/icon-manager';
import { globalCrypto } from './global-crypto';

// 전역 CryptoService 인스턴스를 별도 파일에서 export
export { globalCrypto };

/**
 * 아이콘 상태 초기화
 */
async function initializeIconState(): Promise<void> {
  try {
    // 마스터 비밀번호 상태 확인
    const masterPassword = await globalCrypto.getMasterPassword();
    const hasPassword = !!masterPassword;
    const isUnlocked = hasPassword;

    console.log('[Service Worker] Initializing icon state:', { hasPassword, isUnlocked });

    // 아이콘 상태 결정
    let targetState: 'active' | 'locked' | 'off' = 'active'; // 기본값

    if (!hasPassword) {
      targetState = 'active'; // 비밀번호 미설정 시에도 active
    } else if (isUnlocked) {
      targetState = 'active'; // 잠금 해제됨
    } else {
      targetState = 'locked'; // 잠금 상태
    }

    // 강제로 아이콘 설정 (force=true)
    await iconManager.setIconState(targetState, true);

    console.log('[Service Worker] Icon state initialized:', {
      hasPassword,
      isUnlocked,
      targetState,
      currentState: iconManager.getCurrentState()
    });
  } catch (error) {
    console.error('[Service Worker] Failed to initialize icon state:', error);
    // 에러 발생 시 active 상태로 설정 (기본값, force=true)
    await iconManager.setIconState('active', true);
  }
}

// Extension 설치 시
chrome.runtime.onInstalled.addListener(async () => {
  // 기본 설정 초기화
  await chrome.storage.sync.set({
    showButtons: true
  });

  // 아이콘 상태 초기화
  await initializeIconState();
});

// Service Worker 시작 시 (브라우저 시작 또는 Extension 재로드)
chrome.runtime.onStartup.addListener(async () => {
  // 아이콘 상태 초기화
  await initializeIconState();
});

// Content script로부터 메시지 수신
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (response: MessageResponse) => void) => {
    // chrome.runtime.lastError 체크
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: 'Chrome runtime error occurred'
      });
      return true;
    }

    // 비동기 메시지 핸들러 호출
    handleMessage(message, sendResponse);

    // 비동기 응답을 위해 true 반환
    return true;
  }
);

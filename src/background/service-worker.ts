/**
 * Review to Instruction - Background Service Worker
 */

import type { Message, MessageResponse } from '../types';
import { handleMessage } from './message-handler';
import { iconManager } from './services/icon-manager';
import { globalCrypto } from './global-crypto';
import { logger } from '../utils/logger';
import { sessionManager } from './services/session-manager';

/**
 * 아이콘 상태 초기화
 */
async function initializeIconState(): Promise<void> {
  try {
    // 마스터 비밀번호 상태 확인
    const masterPassword = await globalCrypto.getMasterPassword();
    const hasPassword = !!masterPassword;
    const isUnlocked = hasPassword;

    logger.log('[Service Worker] Initializing icon state:', { hasPassword, isUnlocked });

    // 아이콘 상태 결정
    let targetState: 'active' | 'locked' | 'off';

    if (!hasPassword) {
      // 마스터 비밀번호 미설정: token 존재 여부 확인
      const hasTokens = await checkTokensExist();
      targetState = hasTokens ? 'active' : 'off';
    } else if (isUnlocked) {
      // 잠금 해제됨: token 복호화 가능 여부 확인
      const hasValidTokens = await checkTokensValid();
      targetState = hasValidTokens ? 'active' : 'off';
    } else {
      // 잠금 상태
      targetState = 'locked';
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
    // 에러 발생 시 off 상태로 설정
    await iconManager.setIconState('off', true);
  }
}

/**
 * 암호화된 token 존재 여부 확인
 */
async function checkTokensExist(): Promise<boolean> {
  try {
    const storage = await chrome.storage.local.get([
      'githubToken_enc',
      'gitlabToken_enc'
    ]);
    return !!(storage.githubToken_enc || storage.gitlabToken_enc);
  } catch (error) {
    console.error('[Service Worker] Failed to check tokens existence:', error);
    return false;
  }
}

/**
 * token 복호화 가능 여부 확인
 */
async function checkTokensValid(): Promise<boolean> {
  try {
    const storage = await chrome.storage.local.get([
      'githubToken_enc',
      'gitlabToken_enc'
    ]);

    // 적어도 하나의 암호화된 token이 있어야 함
    const hasEncryptedToken = !!(storage.githubToken_enc || storage.gitlabToken_enc);
    if (!hasEncryptedToken) {
      return false;
    }

    // 복호화 시도 (GitHub token 우선)
    if (storage.githubToken_enc) {
      try {
        await globalCrypto.decrypt(storage.githubToken_enc as string);
        return true;
      } catch (error) {
        // GitHub token 복호화 실패, GitLab token 시도
      }
    }

    if (storage.gitlabToken_enc) {
      try {
        await globalCrypto.decrypt(storage.gitlabToken_enc as string);
        return true;
      } catch (error) {
        // GitLab token도 복호화 실패
      }
    }

    return false;
  } catch (error) {
    logger.error('[Service Worker] Failed to validate tokens:', error);
    return false;
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

  // 세션 관리자 시작
  await sessionManager.start();
});

// Service Worker 시작 시 (브라우저 시작 또는 Extension 재로드)
chrome.runtime.onStartup.addListener(async () => {
  // 아이콘 상태 초기화
  await initializeIconState();

  // 세션 관리자 시작
  await sessionManager.start();
});

// Content script로부터 메시지 수신
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse: (response: MessageResponse) => void) => {
    // chrome.runtime.lastError 체크
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: 'Chrome runtime error occurred'
      });
      return true;
    }

    // 발신자 검증 - 이 extension에서만 메시지를 받도록
    if (!sender.id || sender.id !== chrome.runtime.id) {
      logger.warn('[Security] Rejected message from unauthorized sender:', sender);
      sendResponse({
        success: false,
        error: 'Unauthorized sender'
      });
      return true;
    }

    // 허용된 URL 패턴 검증 (content script나 extension page에서만)
    if (sender.url) {
      const isExtensionUrl = sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/`);
      const isAllowedUrl =
        sender.url.includes('github.com') ||
        sender.url.includes('gitlab.com') ||
        sender.url.includes('git.projectbro.com');

      if (!isExtensionUrl && !isAllowedUrl) {
        logger.warn('[Security] Rejected message from unauthorized URL:', sender.url);
        sendResponse({
          success: false,
          error: 'Unauthorized origin'
        });
        return true;
      }
    }

    // 비동기 메시지 핸들러 호출
    handleMessage(message, sendResponse);

    // 비동기 응답을 위해 true 반환
    return true;
  }
);

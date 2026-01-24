/**
 * Review to Instruction - Background Service Worker
 */

import type { Message, MessageResponse } from '../types';
import { handleMessage } from './message-handler';
import { CryptoService } from './services/crypto-service';

// 전역 CryptoService 인스턴스 (마스터 비밀번호 유지)
export const globalCrypto = new CryptoService();

// Extension 설치 시
chrome.runtime.onInstalled.addListener(() => {
  // 기본 설정 초기화
  chrome.storage.sync.set({
    showButtons: true
  });
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

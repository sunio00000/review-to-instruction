/**
 * Review to Instruction - Background Service Worker
 */

import type { Message, MessageResponse } from '../types';
import { handleMessage } from './message-handler';

// Extension 설치 시
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Review to Instruction] Extension installed');

  // 기본 설정 초기화
  chrome.storage.sync.set({
    showButtons: true
  });
});

// Content script로부터 메시지 수신
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (response: MessageResponse) => void) => {
    console.log('[Review to Instruction] Message received:', message.type);

    // 비동기 메시지 핸들러 호출
    handleMessage(message, sendResponse);

    // 비동기 응답을 위해 true 반환
    return true;
  }
);

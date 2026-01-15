/**
 * PR Convention Bridge - Background Service Worker
 */

import type { Message, MessageResponse } from '../types';

// Extension 설치 시
chrome.runtime.onInstalled.addListener(() => {
  console.log('[PR Convention Bridge] Extension installed');

  // 기본 설정 초기화
  chrome.storage.sync.set({
    showButtons: true
  });
});

// Content script로부터 메시지 수신
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (response: MessageResponse) => void) => {
    console.log('[PR Convention Bridge] Message received:', message.type);

    // Phase 5에서 메시지 핸들러 구현
    switch (message.type) {
      case 'GET_CONFIG':
        handleGetConfig(sendResponse);
        return true;  // 비동기 응답

      case 'SAVE_CONFIG':
        handleSaveConfig(message.payload, sendResponse);
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }

    return false;
  }
);

// 설정 가져오기
async function handleGetConfig(sendResponse: (response: MessageResponse) => void) {
  try {
    const config = await chrome.storage.sync.get(['githubToken', 'gitlabToken', 'showButtons']);
    sendResponse({ success: true, data: config });
  } catch (error) {
    sendResponse({ success: false, error: String(error) });
  }
}

// 설정 저장
async function handleSaveConfig(config: any, sendResponse: (response: MessageResponse) => void) {
  try {
    await chrome.storage.sync.set(config);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: String(error) });
  }
}

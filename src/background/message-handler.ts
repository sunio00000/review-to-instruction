/**
 * PR Convention Bridge - Message Handler
 * Content script와 Background 간 메시지 처리
 */

import { ApiClient } from './api-client';
import type { Message, MessageResponse, Comment, Repository, Platform } from '../types';

/**
 * 메시지 핸들러
 */
export async function handleMessage(
  message: Message,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  console.log('[MessageHandler] Processing message:', message.type);

  switch (message.type) {
    case 'GET_CONFIG':
      await handleGetConfig(sendResponse);
      break;

    case 'SAVE_CONFIG':
      await handleSaveConfig(message.payload, sendResponse);
      break;

    case 'TEST_API':
      await handleTestApi(message.payload, sendResponse);
      break;

    case 'CONVERT_COMMENT':
      await handleConvertComment(message.payload, sendResponse);
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
}

/**
 * 설정 가져오기
 */
async function handleGetConfig(sendResponse: (response: MessageResponse) => void) {
  try {
    const config = await chrome.storage.sync.get(['githubToken', 'gitlabToken', 'showButtons']);
    sendResponse({ success: true, data: config });
  } catch (error) {
    sendResponse({ success: false, error: String(error) });
  }
}

/**
 * 설정 저장
 */
async function handleSaveConfig(
  config: any,
  sendResponse: (response: MessageResponse) => void
) {
  try {
    await chrome.storage.sync.set(config);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: String(error) });
  }
}

/**
 * API 연결 테스트
 */
async function handleTestApi(
  payload: { platform: Platform; token: string },
  sendResponse: (response: MessageResponse) => void
) {
  try {
    const client = new ApiClient({
      token: payload.token,
      platform: payload.platform
    });

    const result = await client.testConnection();

    if (result.success) {
      sendResponse({
        success: true,
        data: { user: result.user }
      });
    } else {
      sendResponse({
        success: false,
        error: result.error || 'Connection test failed'
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * 코멘트 변환 (instruction/skills 생성)
 */
async function handleConvertComment(
  payload: { comment: Comment; repository: Repository },
  sendResponse: (response: MessageResponse) => void
) {
  try {
    const { comment, repository } = payload;

    console.log('[MessageHandler] Converting comment:', {
      commentId: comment.id,
      repository: `${repository.owner}/${repository.name}`
    });

    // 토큰 가져오기
    const tokenKey = repository.platform === 'github' ? 'githubToken' : 'gitlabToken';
    const storage = await chrome.storage.sync.get([tokenKey]);
    const token = storage[tokenKey] as string | undefined;

    if (!token) {
      throw new Error(`${repository.platform} token not configured`);
    }

    // API 클라이언트 생성 (Phase 6-9에서 사용 예정)
    // @ts-expect-error - will be used in Phase 6-9
    const _client = new ApiClient({
      token,
      platform: repository.platform
    });

    // TODO: Phase 6-9에서 구현
    // 1. 코멘트 파싱 (keywords, category 추출)
    // 2. .claude/ 디렉토리에서 매칭 파일 찾기
    // 3. instruction/skills 파일 생성
    // 4. 브랜치 생성 및 PR/MR 생성

    // 임시 응답 (Phase 6-9에서 실제 구현)
    console.log('[MessageHandler] Comment conversion will be implemented in Phase 6-9');
    sendResponse({
      success: true,
      data: {
        message: 'Comment conversion is not yet implemented. Coming in Phase 6-9!',
        comment,
        repository
      }
    });

  } catch (error) {
    console.error('[MessageHandler] Failed to convert comment:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

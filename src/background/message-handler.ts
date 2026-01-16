/**
 * Review to Instruction - Message Handler
 * Content script와 Background 간 메시지 처리
 */

import type { Message, MessageResponse, Comment, Repository, Platform } from '../types';
import { ApiClient } from './api-client';
import { llmCache } from './llm/cache';
import { createServiceContainer } from './services/di-container';
import { ConversionOrchestrator } from './services/conversion-orchestrator';

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

    case 'GET_CACHE_STATS':
      await handleGetCacheStats(sendResponse);
      break;

    case 'CLEAR_CACHE':
      await handleClearCache(sendResponse);
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
    const config = await chrome.storage.sync.get(['githubToken', 'gitlabToken', 'showButtons', 'llm']);
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

// Orchestrator 초기화
const orchestrator = new ConversionOrchestrator(createServiceContainer());

/**
 * 코멘트 변환 (instruction/skills 생성)
 * Feature 1: 다중 프로젝트 타입 지원
 *
 * 리팩토링됨: 비즈니스 로직을 ConversionOrchestrator로 위임
 */
async function handleConvertComment(
  payload: { comment: Comment; repository: Repository },
  sendResponse: (response: MessageResponse) => void
) {
  try {
    const result = await orchestrator.convertComment(payload);
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error('[MessageHandler] Failed to convert comment:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * 캐시 통계 조회 (Feature 2)
 */
async function handleGetCacheStats(
  sendResponse: (response: MessageResponse) => void
) {
  try {
    console.log('[MessageHandler] Getting cache stats...');

    const stats = await llmCache.getStats();

    sendResponse({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[MessageHandler] Failed to get cache stats:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * 캐시 초기화 (Feature 2)
 */
async function handleClearCache(
  sendResponse: (response: MessageResponse) => void
) {
  try {
    console.log('[MessageHandler] Clearing cache...');

    await llmCache.clear();

    console.log('[MessageHandler] Cache cleared successfully');

    sendResponse({
      success: true,
      data: { message: 'Cache cleared successfully' }
    });

  } catch (error) {
    console.error('[MessageHandler] Failed to clear cache:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

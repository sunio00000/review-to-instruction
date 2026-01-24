/**
 * Review to Instruction - Message Handler
 * Content script와 Background 간 메시지 처리
 */

import type { Message, MessageResponse, Comment, Repository, Platform } from '../types';
import { ApiClient } from './api-client';
import { llmCache } from './llm/cache';
import { createServiceContainer } from './services/di-container';
import { ConversionOrchestrator } from './services/conversion-orchestrator';
import { globalCrypto } from './service-worker';

/**
 * 메시지 핸들러
 */
export async function handleMessage(
  message: Message,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {

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

    case 'GET_REPOSITORY_INFO':
      await handleGetRepositoryInfo(message.payload, sendResponse);
      break;

    case 'GET_PR_INFO':
      await handleGetPRInfo(message.payload, sendResponse);
      break;

    case 'SET_MASTER_PASSWORD':
      await handleSetMasterPassword(message.payload, sendResponse);
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
  payload: { platform: Platform; token: string; gitlabUrl?: string },
  sendResponse: (response: MessageResponse) => void
) {
  try {
    const client = new ApiClient({
      token: payload.token,
      platform: payload.platform,
      gitlabUrl: payload.gitlabUrl
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

// Orchestrator 초기화 (전역 CryptoService 사용)
const orchestrator = new ConversionOrchestrator(createServiceContainer(globalCrypto));

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

    const stats = await llmCache.getStats();

    sendResponse({
      success: true,
      data: stats
    });

  } catch (error) {
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

    await llmCache.clear();


    sendResponse({
      success: true,
      data: { message: 'Cache cleared successfully' }
    });

  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Repository 정보 가져오기 (기본 브랜치 확인용)
 */
async function handleGetRepositoryInfo(
  payload: { owner: string; name: string },
  sendResponse: (response: MessageResponse) => void
) {
  try {

    // GitHub token 가져오기
    const storage = await chrome.storage.sync.get(['githubToken']);
    const token = storage.githubToken;

    if (!token) {
      throw new Error('GitHub token not configured');
    }

    // Repository 정보 조회
    const url = `https://api.github.com/repos/${payload.owner}/${payload.name}`;
    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const repoData = await response.json();


    sendResponse({
      success: true,
      data: {
        default_branch: repoData.default_branch,
        full_name: repoData.full_name
      }
    });

  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * PR 정보 가져오기 (head branch 확인용)
 */
async function handleGetPRInfo(
  payload: { owner: string; name: string; prNumber: number },
  sendResponse: (response: MessageResponse) => void
) {
  try {

    // GitHub token 가져오기
    const storage = await chrome.storage.sync.get(['githubToken']);
    const token = storage.githubToken;

    if (!token) {
      throw new Error('GitHub token not configured');
    }

    // PR 정보 조회
    const url = `https://api.github.com/repos/${payload.owner}/${payload.name}/pulls/${payload.prNumber}`;
    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const prData = await response.json();

    // head.ref가 PR의 source branch (작업 브랜치)
    const headBranch = prData.head.ref;
    const baseBranch = prData.base.ref;

    sendResponse({
      success: true,
      data: {
        head_branch: headBranch,
        base_branch: baseBranch,
        title: prData.title,
        number: prData.number
      }
    });

  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * 마스터 비밀번호 설정
 */
async function handleSetMasterPassword(
  payload: { password: string },
  sendResponse: (response: MessageResponse) => void
) {
  try {
    const { password } = payload;

    if (!password) {
      throw new Error('비밀번호가 제공되지 않았습니다.');
    }

    // 전역 CryptoService에 마스터 비밀번호 설정
    globalCrypto.setMasterPassword(password);

    sendResponse({
      success: true,
      data: { message: '마스터 비밀번호가 설정되었습니다.' }
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

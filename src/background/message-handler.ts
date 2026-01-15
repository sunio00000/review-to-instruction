/**
 * Review to Instruction - Message Handler
 * Content script와 Background 간 메시지 처리
 */

import { ApiClient } from './api-client';
import type { Message, MessageResponse, Comment, Repository, Platform } from '../types';
import { parseComment, isConventionComment } from '../core/parser';
import { findMatchingFile, generateFilePath, ensureUniqueFileName } from '../core/file-matcher';
import { generateInstruction } from '../core/instruction-generator';
import { generateSkill } from '../core/skill-generator';
import { createPullRequest } from '../core/pr-creator';

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

    // 1. 컨벤션 관련 코멘트인지 확인
    if (!isConventionComment(comment.content)) {
      throw new Error('이 코멘트는 컨벤션 관련 내용이 아닙니다.');
    }

    // 2. 토큰 가져오기
    const tokenKey = repository.platform === 'github' ? 'githubToken' : 'gitlabToken';
    const storage = await chrome.storage.sync.get([tokenKey]);
    const token = storage[tokenKey] as string | undefined;

    if (!token) {
      throw new Error(`${repository.platform} token이 설정되지 않았습니다.`);
    }

    // 3. API 클라이언트 생성
    const client = new ApiClient({
      token,
      platform: repository.platform
    });

    // 4. 코멘트 파싱
    console.log('[MessageHandler] Parsing comment...');
    const parsedComment = parseComment(comment.content);

    if (parsedComment.keywords.length === 0) {
      throw new Error('키워드를 추출할 수 없습니다. 더 명확한 컨벤션 설명이 필요합니다.');
    }

    console.log('[MessageHandler] Parsed comment:', {
      keywords: parsedComment.keywords,
      category: parsedComment.category
    });

    // 5. 매칭 파일 찾기
    console.log('[MessageHandler] Finding matching file...');
    let matchResult;
    try {
      matchResult = await findMatchingFile(client, repository, parsedComment);
      console.log('[MessageHandler] Match result:', { isMatch: matchResult.isMatch, path: matchResult.file?.path });
    } catch (error) {
      console.error('[MessageHandler] Error during file matching:', error);
      // 파일 매칭 실패해도 계속 진행 (새 파일 생성)
      matchResult = { file: null, score: 0, isMatch: false };
    }

    let filePath: string;
    let fileContent: string;
    let isUpdate = false;

    if (matchResult.isMatch && matchResult.file) {
      // 기존 파일 업데이트
      console.log('[MessageHandler] Updating existing file:', matchResult.file.path);
      isUpdate = true;
      filePath = matchResult.file.path;

      // Skills 파일 업데이트
      fileContent = generateSkill({
        parsedComment,
        originalComment: comment,
        repository,
        existingContent: matchResult.file.content
      });
    } else {
      // 새 파일 생성
      console.log('[MessageHandler] Creating new instruction file');
      const basePath = generateFilePath(false, parsedComment.suggestedFileName);
      filePath = await ensureUniqueFileName(client, repository, basePath);

      fileContent = generateInstruction({
        parsedComment,
        originalComment: comment,
        repository
      });
    }

    console.log('[MessageHandler] File path:', filePath);

    // 6. PR/MR 생성
    console.log('[MessageHandler] Creating PR/MR...', {
      repository: `${repository.owner}/${repository.name}`,
      branch: repository.branch,
      filePath,
      isUpdate
    });

    const prResult = await createPullRequest({
      client,
      repository,
      parsedComment,
      originalComment: comment,
      filePath,
      fileContent,
      isUpdate
    });

    if (!prResult.success) {
      console.error('[MessageHandler] PR/MR creation failed:', prResult.error);
      throw new Error(prResult.error || 'PR/MR 생성에 실패했습니다.');
    }

    console.log('[MessageHandler] PR/MR created successfully:', prResult.prUrl);

    // 7. 성공 응답
    sendResponse({
      success: true,
      data: {
        prUrl: prResult.prUrl,
        filePath,
        isUpdate,
        category: parsedComment.category,
        keywords: parsedComment.keywords
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

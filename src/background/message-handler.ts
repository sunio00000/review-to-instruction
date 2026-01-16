/**
 * Review to Instruction - Message Handler
 * Content script와 Background 간 메시지 처리
 */

import { ApiClient } from './api-client';
import type { Message, MessageResponse, Comment, Repository, Platform, EnhancedComment, LLMConfig, FileGenerationResult } from '../types';
import { parseComment, isConventionComment } from '../core/parser';
import { findMatchingFileForProjectType } from '../core/file-matcher';
import { createPullRequestWithMultipleFiles } from '../core/pr-creator';
import { enhanceWithLLM } from './llm/enhancer';
import { ProjectTypeDetector } from '../core/project-detector';
import { GeneratorFactory } from '../core/generators/generator-factory';
import { llmCache } from './llm/cache';

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

/**
 * 코멘트 변환 (instruction/skills 생성)
 * Feature 1: 다중 프로젝트 타입 지원
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

    // 2. 토큰 및 LLM 설정 가져오기
    const tokenKey = repository.platform === 'github' ? 'githubToken' : 'gitlabToken';
    const storage = await chrome.storage.sync.get([tokenKey, 'llm']);
    const token = storage[tokenKey] as string | undefined;
    const llmConfig = (storage.llm || { enabled: false, provider: 'none' }) as LLMConfig;

    if (!token) {
      throw new Error(`${repository.platform} token이 설정되지 않았습니다.`);
    }

    // 3. API 클라이언트 생성
    const client = new ApiClient({
      token,
      platform: repository.platform
    });

    // 4. 코멘트 파싱 (규칙 기반)
    console.log('[MessageHandler] Parsing comment...');
    const parsedComment = parseComment(comment.content);

    if (parsedComment.keywords.length === 0) {
      throw new Error('키워드를 추출할 수 없습니다. 더 명확한 컨벤션 설명이 필요합니다.');
    }

    console.log('[MessageHandler] Parsed comment:', {
      keywords: parsedComment.keywords,
      category: parsedComment.category
    });

    // 5. LLM 강화
    console.log('[MessageHandler] Enhancing with LLM...');
    const enhancedComment: EnhancedComment = await enhanceWithLLM(parsedComment, llmConfig);

    if (enhancedComment.llmEnhanced) {
      console.log('[MessageHandler] LLM enhancement successful:', {
        provider: llmConfig.provider,
        addedKeywords: enhancedComment.additionalKeywords?.length || 0
      });
    } else {
      console.log('[MessageHandler] Using original parsed comment (LLM disabled or failed)');
    }

    // 6. 프로젝트 타입 감지 (Feature 1)
    console.log('[MessageHandler] Detecting project types...');
    const projectDetector = new ProjectTypeDetector();
    const detectionResult = await projectDetector.detect(client, repository);

    if (detectionResult.detectedTypes.length === 0) {
      throw new Error('지원되는 AI 도구 형식(.claude/, .cursorrules, rules/)을 찾을 수 없습니다.');
    }

    console.log('[MessageHandler] Detected project types:', detectionResult.detectedTypes);

    // 7. 각 프로젝트 타입별 Generator 생성
    const generators = GeneratorFactory.createGenerators(detectionResult.detectedTypes);
    console.log(`[MessageHandler] Created ${generators.size} generators`);

    // 8. 각 타입별 파일 생성
    const files: FileGenerationResult[] = [];

    for (const [projectType, generator] of generators) {
      console.log(`[MessageHandler] Generating file for ${projectType}...`);

      try {
        // 매칭 파일 찾기
        const matchResult = await findMatchingFileForProjectType(
          client,
          repository,
          enhancedComment,
          projectType
        );

        // Generator로 파일 생성
        const generationResult = generator.generate({
          parsedComment: enhancedComment,
          originalComment: comment,
          repository,
          existingContent: matchResult.existingContent
        });

        // 파일 경로가 비어있으면 Generator가 결정한 경로 사용
        const finalFilePath = generationResult.filePath || matchResult.filePath;

        files.push({
          projectType: projectType,
          filePath: finalFilePath,
          content: generationResult.content,
          isUpdate: generationResult.isUpdate
        });

        console.log(`[MessageHandler] Generated file for ${projectType}:`, {
          filePath: finalFilePath,
          isUpdate: generationResult.isUpdate
        });

      } catch (error) {
        console.error(`[MessageHandler] Failed to generate file for ${projectType}:`, error);
        // 한 타입 실패해도 다른 타입은 계속 진행 (부분 성공 허용)
      }
    }

    if (files.length === 0) {
      throw new Error('파일 생성에 모두 실패했습니다.');
    }

    console.log(`[MessageHandler] Successfully generated ${files.length} files`);

    // 9. 다중 파일 PR/MR 생성
    console.log('[MessageHandler] Creating PR/MR with multiple files...');
    const prResult = await createPullRequestWithMultipleFiles({
      client,
      repository,
      parsedComment: enhancedComment,
      originalComment: comment,
      files
    });

    if (!prResult.success) {
      console.error('[MessageHandler] PR/MR creation failed:', prResult.error);
      throw new Error(prResult.error || 'PR/MR 생성에 실패했습니다.');
    }

    console.log('[MessageHandler] PR/MR created successfully:', prResult.prUrl);

    // 10. 성공 응답
    sendResponse({
      success: true,
      data: {
        prUrl: prResult.prUrl,
        files: files.map(f => ({ projectType: f.projectType, filePath: f.filePath, isUpdate: f.isUpdate })),
        category: enhancedComment.category,
        keywords: enhancedComment.keywords,
        llmEnhanced: enhancedComment.llmEnhanced
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

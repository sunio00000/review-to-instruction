/**
 * Review to Instruction - Message Handler
 * Content script와 Background 간 메시지 처리
 */

import type { Message, MessageResponse, Comment, Repository, Platform, DiscussionThread } from '../types';
import type { InstructionResult, CommentSource } from './llm/types';
import { ApiClient } from './api-client';
import { llmCache } from './llm/cache';
import { createServiceContainer } from './services/di-container';
import { ConversionOrchestrator } from './services/conversion-orchestrator';
import { globalCrypto } from './global-crypto';

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

    case 'PREVIEW_INSTRUCTION':
      await handlePreviewInstruction(message.payload, sendResponse);
      break;

    case 'CONFIRM_AND_CONVERT':
      await handleConfirmAndConvert(message.payload, sendResponse);
      break;

    case 'CONVERT_THREAD':
      await handleConvertThread(message.payload, sendResponse);
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
 * Thread 변환 (Discussion Thread 전체를 하나의 instruction으로)
 */
async function handleConvertThread(
  payload: { thread: DiscussionThread; repository: Repository },
  sendResponse: (response: MessageResponse) => void
) {
  try {
    const result = await orchestrator.convertThread(payload);
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

/**
 * Instruction 미리보기 생성 (LLM 분석만 수행, 파일 생성 안 함)
 */
async function handlePreviewInstruction(
  payload: { comment: Comment; repository: Repository },
  sendResponse: (response: MessageResponse) => void
) {
  try {
    // 1. 설정 로드
    const config = await orchestrator.container.configService.loadConfig(payload.repository.platform);

    // 2. LLM 분석만 수행
    const { enhancedComment, tokenUsage } = await orchestrator.container.commentService.validateAndEnhance(
      payload.comment,
      config.llmConfig
    );

    // 3. Instruction 내용 생성
    const instructionContent = `# ${enhancedComment.suggestedCategory || 'Convention'}

${enhancedComment.summary}

## Details

${enhancedComment.detailedExplanation}

${enhancedComment.codeExplanations && enhancedComment.codeExplanations.length > 0 ? `
## Examples

${enhancedComment.codeExplanations.map((ex, i) => `
### Example ${i + 1} (${ex.isGoodExample ? '✅ Good' : '❌ Bad'})

\`\`\`
${ex.code}
\`\`\`

${ex.explanation}
`).join('\n')}
` : ''}`;

    // 4. CommentSource 생성
    const sources: CommentSource[] = [];

    // 메인 코멘트
    sources.push({
      commentId: payload.comment.id,
      author: payload.comment.author,
      excerpt: payload.comment.content.substring(0, 150) +
        (payload.comment.content.length > 150 ? '...' : ''),
      weight: 1.0
    });

    // 답글들
    if (payload.comment.replies && payload.comment.replies.length > 0) {
      const replyWeight = 0.5 / payload.comment.replies.length;
      payload.comment.replies.forEach(reply => {
        sources.push({
          commentId: reply.id,
          author: reply.author,
          excerpt: reply.content.substring(0, 100) +
            (reply.content.length > 100 ? '...' : ''),
          weight: replyWeight
        });
      });
    }

    // 5. InstructionResult 생성
    const result: InstructionResult = {
      content: instructionContent,
      reasoning: enhancedComment.reasoning || {
        detectedIntent: [],
        keyPhrases: [],
        codeReferences: [],
        confidenceScore: 50
      },
      sources
    };

    sendResponse({
      success: true,
      data: { result, tokenUsage }
    });

  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * 미리보기 확인 후 실제 변환 수행
 */
async function handleConfirmAndConvert(
  payload: { comment: Comment; repository: Repository; editedContent?: string },
  sendResponse: (response: MessageResponse) => void
) {
  try {
    // editedContent가 있으면 comment 덮어쓰기 (Phase 2에서 구현)
    const finalComment = payload.editedContent
      ? { ...payload.comment, content: payload.editedContent }
      : payload.comment;

    // 기존 변환 로직 재사용
    const result = await orchestrator.convertComment({
      comment: finalComment,
      repository: payload.repository
    });

    sendResponse({ success: true, data: result });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

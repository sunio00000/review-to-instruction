/**
 * PullRequestService - PR/MR 생성 서비스
 */

import type { Repository, EnhancedComment, Comment, FileGenerationResult, LLMConfig } from '../../types';
import type { ApiClient } from '../api-client';
import { createPullRequestWithMultipleFiles } from '../../core/pr-creator';
import { createLLMClient } from '../llm/enhancer';

export interface PullRequestResult {
  prUrl: string;
}

export interface PullRequestService {
  create(
    client: ApiClient,
    repository: Repository,
    enhancedComment: EnhancedComment,
    originalComment: Comment,
    files: FileGenerationResult[],
    llmConfig?: LLMConfig
  ): Promise<PullRequestResult>;
}

/**
 * PullRequestService 구현
 */
export class PullRequestServiceImpl implements PullRequestService {
  /**
   * 다중 파일로 PR/MR 생성
   */
  async create(
    client: ApiClient,
    repository: Repository,
    enhancedComment: EnhancedComment,
    originalComment: Comment,
    files: FileGenerationResult[],
    llmConfig?: LLMConfig
  ): Promise<PullRequestResult> {
    // LLM 클라이언트 생성 (활성화되어 있으면)
    const llmClient = llmConfig?.enabled
      ? (createLLMClient(llmConfig) ?? undefined)
      : undefined;

    const prResult = await createPullRequestWithMultipleFiles({
      client,
      repository,
      parsedComment: enhancedComment,
      originalComment,
      files,
      llmClient
    });

    if (!prResult.success) {
      throw new Error(prResult.error || 'PR/MR 생성에 실패했습니다.');
    }


    return {
      prUrl: prResult.prUrl!
    };
  }
}

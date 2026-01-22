/**
 * PullRequestService - PR/MR 생성 서비스
 */

import type { Repository, EnhancedComment, Comment, FileGenerationResult } from '../../types';
import type { ApiClient } from '../api-client';
import { createPullRequestWithMultipleFiles } from '../../core/pr-creator';

export interface PullRequestResult {
  prUrl: string;
}

export interface PullRequestService {
  create(
    client: ApiClient,
    repository: Repository,
    enhancedComment: EnhancedComment,
    originalComment: Comment,
    files: FileGenerationResult[]
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
    files: FileGenerationResult[]
  ): Promise<PullRequestResult> {

    const prResult = await createPullRequestWithMultipleFiles({
      client,
      repository,
      parsedComment: enhancedComment,
      originalComment,
      files
    });

    if (!prResult.success) {
      throw new Error(prResult.error || 'PR/MR 생성에 실패했습니다.');
    }


    return {
      prUrl: prResult.prUrl!
    };
  }
}

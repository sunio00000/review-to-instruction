/**
 * PullRequestService - PR/MR 생성 서비스
 */

import type { Repository, EnhancedComment, Comment, FileGenerationResult, LLMConfig } from '../../types';
import type { ApiClient } from '../api-client';
import { createPullRequestWithMultipleFiles } from '../../core/pr-creator';
import { createLLMClient } from '../llm/enhancer';
import { FileMerger } from '../../core/file-merger';

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

  createMultiFileWrapup(
    client: ApiClient,
    repository: Repository,
    results: Array<{
      enhancedComment: EnhancedComment;
      comment: Comment;
      files: FileGenerationResult[];
    }>,
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
    // LLM 클라이언트 생성 (llmConfig가 있으면)
    const llmClient = llmConfig
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

  /**
   * Wrapup: 여러 코멘트의 파일들을 하나의 PR로 생성
   */
  async createMultiFileWrapup(
    client: ApiClient,
    repository: Repository,
    results: Array<{
      enhancedComment: EnhancedComment;
      comment: Comment;
      files: FileGenerationResult[];
    }>,
    llmConfig?: LLMConfig
  ): Promise<PullRequestResult> {
    // 모든 파일 수집
    const allFiles: FileGenerationResult[] = [];
    for (const result of results) {
      allFiles.push(...result.files);
    }

    // 중복 파일 병합
    const fileMerger = new FileMerger();
    const mergedFiles = fileMerger.mergeFiles(allFiles);

    // LLM 클라이언트 생성
    const llmClient = llmConfig ? (createLLMClient(llmConfig) ?? undefined) : undefined;

    // 첫 번째 결과를 대표로 사용 (PR 제목/본문 생성용)
    const firstResult = results[0];

    // PR 생성 (wrapup 모드) - 병합된 파일 사용
    const prResult = await createPullRequestWithMultipleFiles({
      client,
      repository,
      parsedComment: firstResult.enhancedComment,
      originalComment: firstResult.comment,
      files: mergedFiles,
      llmClient,
      isWrapup: true,  // Wrapup 모드 표시
      wrapupCommentCount: results.length  // 총 코멘트 수
    });

    if (!prResult.success) {
      throw new Error(prResult.error || 'PR/MR 생성에 실패했습니다.');
    }

    return {
      prUrl: prResult.prUrl!
    };
  }
}

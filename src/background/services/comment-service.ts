/**
 * CommentService - 코멘트 검증, 파싱, LLM 강화
 */

import type { Comment, LLMConfig, EnhancedComment, DiscussionThread } from '../../types';
import { isConventionComment, parseComment } from '../../core/parser';
import { enhanceWithLLM } from '../llm/enhancer';

export interface CommentService {
  validateAndEnhance(
    comment: Comment,
    llmConfig: LLMConfig
  ): Promise<{ enhancedComment: EnhancedComment; tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number; } }>;

  validateAndEnhanceThread(
    mergedComment: Comment,
    thread: DiscussionThread,
    llmConfig: LLMConfig
  ): Promise<{ enhancedComment: EnhancedComment; tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number; } }>;
}

/**
 * CommentService 구현
 */
export class CommentServiceImpl implements CommentService {
  /**
   * 코멘트 검증, 파싱, LLM 강화를 한 번에 수행 (Feature 2: 답글 포함)
   */
  async validateAndEnhance(
    comment: Comment,
    llmConfig: LLMConfig
  ): Promise<{ enhancedComment: EnhancedComment; tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number; } }> {
    // 1. 컨벤션 관련 코멘트인지 확인
    if (!isConventionComment(comment.content)) {
      throw new Error('이 코멘트는 컨벤션 관련 내용이 아닙니다.');
    }

    // 2. 코멘트 파싱 (규칙 기반)
    const parsedComment = parseComment(comment.content);

    // 3. 키워드 검증
    if (parsedComment.keywords.length === 0) {
      throw new Error('키워드를 추출할 수 없습니다. 더 명확한 컨벤션 설명이 필요합니다.');
    }

    // 4. LLM 강화 (답글 포함)
    const { enhancedComment, tokenUsage } = await enhanceWithLLM(
      parsedComment,
      llmConfig,
      comment.replies
    );

    return { enhancedComment, tokenUsage };
  }

  /**
   * Thread 전체 검증 및 강화
   */
  async validateAndEnhanceThread(
    mergedComment: Comment,
    thread: DiscussionThread,
    llmConfig: LLMConfig
  ): Promise<{ enhancedComment: EnhancedComment; tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number; } }> {
    // 1. Thread가 컨벤션 관련인지 확인 (하나라도 컨벤션이면 OK)
    const isConvention = thread.comments.some(comment =>
      isConventionComment(comment.content)
    );

    if (!isConvention) {
      throw new Error('이 Thread는 컨벤션 관련 내용이 아닙니다.');
    }

    // 2. 통합 코멘트 파싱
    const parsedComment = parseComment(mergedComment.content);

    // 3. 키워드 검증
    if (parsedComment.keywords.length === 0) {
      throw new Error('Thread에서 키워드를 추출할 수 없습니다.');
    }

    // 4. Thread 맥락을 고려한 LLM 강화
    const { enhancedComment, tokenUsage } = await enhanceWithLLM(
      parsedComment,
      llmConfig,
      undefined,  // replies 없음 (이미 통합됨)
      thread      // Thread 전체 컨텍스트 전달
    );

    return { enhancedComment, tokenUsage };
  }
}

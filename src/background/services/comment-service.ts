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

    // 3. 키워드 검증 제거 - LLM이 키워드를 추출할 것

    // 4. LLM 강화 (답글 포함, 키워드 병합)
    const { enhancedComment, tokenUsage } = await enhanceWithLLM(
      parsedComment,
      llmConfig,
      comment.replies
    );

    // 5. 선택적 경고 (디버깅용)
    if (enhancedComment.keywords.length === 0) {
      console.warn('[CommentService] No keywords extracted, but proceeding with LLM enhancement');
    }

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

    // 3. 키워드 검증 제거 - LLM이 Thread에서 키워드를 추출할 것

    // 4. Thread 맥락을 고려한 LLM 강화
    const { enhancedComment, tokenUsage } = await enhanceWithLLM(
      parsedComment,
      llmConfig,
      undefined,  // replies 없음 (이미 통합됨)
      thread      // Thread 전체 컨텍스트 전달
    );

    // 5. 선택적 경고 (디버깅용)
    if (enhancedComment.keywords.length === 0) {
      console.warn('[CommentService] Thread has no keywords, but proceeding');
    }

    return { enhancedComment, tokenUsage };
  }
}

/**
 * CommentService - 코멘트 검증, 파싱, LLM 강화
 */

import type { Comment, LLMConfig, EnhancedComment } from '../../types';
import { isConventionComment, parseComment } from '../../core/parser';
import { enhanceWithLLM } from '../llm/enhancer';

export interface CommentService {
  validateAndEnhance(comment: Comment, llmConfig: LLMConfig): Promise<EnhancedComment>;
}

/**
 * CommentService 구현
 */
export class CommentServiceImpl implements CommentService {
  /**
   * 코멘트 검증, 파싱, LLM 강화를 한 번에 수행
   */
  async validateAndEnhance(comment: Comment, llmConfig: LLMConfig): Promise<EnhancedComment> {
    // 1. 컨벤션 관련 코멘트인지 확인
    if (!isConventionComment(comment.content)) {
      throw new Error('이 코멘트는 컨벤션 관련 내용이 아닙니다.');
    }

    // 2. 코멘트 파싱 (규칙 기반)
    console.log('[CommentService] Parsing comment...');
    const parsedComment = parseComment(comment.content);

    // 3. 키워드 검증
    if (parsedComment.keywords.length === 0) {
      throw new Error('키워드를 추출할 수 없습니다. 더 명확한 컨벤션 설명이 필요합니다.');
    }

    console.log('[CommentService] Parsed comment:', {
      keywords: parsedComment.keywords,
      category: parsedComment.category
    });

    // 4. LLM 강화
    console.log('[CommentService] Enhancing with LLM...');
    const enhancedComment = await enhanceWithLLM(parsedComment, llmConfig);

    // 5. 결과 로깅
    if (enhancedComment.llmEnhanced) {
      console.log('[CommentService] LLM enhancement successful:', {
        provider: llmConfig.provider,
        addedKeywords: enhancedComment.additionalKeywords?.length || 0
      });
    } else {
      console.log('[CommentService] Using original parsed comment (LLM disabled or failed)');
    }

    return enhancedComment;
  }
}

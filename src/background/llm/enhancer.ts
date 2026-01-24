/**
 * LLM 강화 엔트리포인트
 */

import type { ParsedComment, EnhancedComment, LLMConfig } from '../../types';
import { ClaudeClient } from './claude-client';
import { OpenAIClient } from './openai-client';
import type { ILLMClient } from './types';

/**
 * ParsedComment를 LLM으로 강화 (Feature 2: 답글 포함, 토큰 사용량 반환)
 */
export async function enhanceWithLLM(
  parsedComment: ParsedComment,
  config: LLMConfig,
  replies?: Array<{ author: string; content: string; createdAt: string; }>
): Promise<{ enhancedComment: EnhancedComment; tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number; } }> {

  // LLM 비활성화 또는 제공자가 'none'인 경우
  if (!config.enabled || config.provider === 'none') {
    return { enhancedComment: { ...parsedComment, llmEnhanced: false } };
  }

  // API 키 확인
  const apiKey = config.provider === 'claude' ? config.claudeApiKey : config.openaiApiKey;
  if (!apiKey) {
    return { enhancedComment: { ...parsedComment, llmEnhanced: false } };
  }

  try {
    // 클라이언트 생성
    const client = createClient(config.provider, apiKey);

    // LLM 분석 호출 (replies 포함)
    const response = await client.analyzeComment(
      parsedComment.content,
      parsedComment.codeExamples,
      replies
    );

    if (!response.success || !response.data) {
      return { enhancedComment: { ...parsedComment, llmEnhanced: false } };
    }

    const { data, tokenUsage } = response;

    // 키워드 병합 (중복 제거)
    const mergedKeywords = Array.from(new Set([
      ...parsedComment.keywords,
      ...(data.additionalKeywords || [])
    ]));

    // 카테고리 선택 (LLM 제안 우선, 없으면 기존)
    const finalCategory = data.suggestedCategory || parsedComment.category;

    const enhancedComment: EnhancedComment = {
      ...parsedComment,
      keywords: mergedKeywords,
      category: finalCategory,
      llmEnhanced: true,
      summary: data.summary,
      detailedExplanation: data.detailedExplanation,
      codeExplanations: data.codeExplanations,
      additionalKeywords: data.additionalKeywords,
      suggestedCategory: data.suggestedCategory
    };

    return { enhancedComment, tokenUsage };

  } catch (error) {
    return { enhancedComment: { ...parsedComment, llmEnhanced: false } };
  }
}

/**
 * LLM 클라이언트 팩토리
 */
export function createLLMClient(config: LLMConfig): ILLMClient | null {
  if (!config.enabled || config.provider === 'none') {
    return null;
  }

  const apiKey = config.provider === 'claude' ? config.claudeApiKey : config.openaiApiKey;
  if (!apiKey) {
    return null;
  }

  switch (config.provider) {
    case 'claude':
      return new ClaudeClient(apiKey);
    case 'openai':
      return new OpenAIClient(apiKey);
    default:
      return null;
  }
}

/**
 * 내부용 클라이언트 생성 (기존 호환성 유지)
 */
function createClient(provider: 'claude' | 'openai', apiKey: string): ILLMClient {
  switch (provider) {
    case 'claude':
      return new ClaudeClient(apiKey);
    case 'openai':
      return new OpenAIClient(apiKey);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * LLM 강화 엔트리포인트
 */

import type { ParsedComment, EnhancedComment, LLMConfig } from '../../types';
import { ClaudeClient } from './claude-client';
import { OpenAIClient } from './openai-client';
import type { ILLMClient } from './types';

/**
 * ParsedComment를 LLM으로 강화
 */
export async function enhanceWithLLM(
  parsedComment: ParsedComment,
  config: LLMConfig
): Promise<EnhancedComment> {
  console.log('[LLM Enhancer] Starting enhancement...');

  // LLM 비활성화 또는 제공자가 'none'인 경우
  if (!config.enabled || config.provider === 'none') {
    console.log('[LLM Enhancer] LLM disabled, returning original');
    return { ...parsedComment, llmEnhanced: false };
  }

  // API 키 확인
  const apiKey = config.provider === 'claude' ? config.claudeApiKey : config.openaiApiKey;
  if (!apiKey) {
    console.warn('[LLM Enhancer] API key not configured, returning original');
    return { ...parsedComment, llmEnhanced: false };
  }

  try {
    // 클라이언트 생성
    console.log('[LLM Enhancer] Creating client:', config.provider);
    const client = createClient(config.provider, apiKey);

    // LLM 분석 호출
    console.log('[LLM Enhancer] Calling analyzeComment...');
    console.log('[LLM Enhancer] Content length:', parsedComment.content.length);
    console.log('[LLM Enhancer] Code examples:', parsedComment.codeExamples.length);

    const response = await client.analyzeComment(
      parsedComment.content,
      parsedComment.codeExamples
    );

    console.log('[LLM Enhancer] Response received:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error
    });

    if (!response.success || !response.data) {
      console.error('[LLM Enhancer] ❌ LLM analysis failed');
      console.error('[LLM Enhancer] Response:', response);
      return { ...parsedComment, llmEnhanced: false };
    }

    const { data } = response;

    console.log('[LLM Enhancer] Analysis data:', {
      hasSummary: !!data.summary,
      hasExplanation: !!data.detailedExplanation,
      additionalKeywords: data.additionalKeywords?.length || 0,
      suggestedCategory: data.suggestedCategory
    });

    // 키워드 병합 (중복 제거)
    const mergedKeywords = Array.from(new Set([
      ...parsedComment.keywords,
      ...(data.additionalKeywords || [])
    ]));

    // 카테고리 선택 (LLM 제안 우선, 없으면 기존)
    const finalCategory = data.suggestedCategory || parsedComment.category;

    console.log('[LLM Enhancer] Enhancement complete', {
      provider: config.provider,
      addedKeywords: data.additionalKeywords?.length || 0,
      codeExplanations: data.codeExplanations?.length || 0
    });

    return {
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

  } catch (error) {
    console.error('[LLM Enhancer] Unexpected error:', error);
    return { ...parsedComment, llmEnhanced: false };
  }
}

/**
 * LLM 클라이언트 팩토리
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

/**
 * OpenAI API 클라이언트
 */

import { BaseLLMClient } from './base-client';
import type { LLMProvider, LLMResponse, LLMAnalysisResult, TokenUsage, SimilarityCheckResult } from './types';
import { LLMError } from './types';
import { buildAnalysisPrompt, buildSimilarityCheckPrompt, buildMergeInstructionsPrompt, SYSTEM_PROMPT } from './prompts';

export class OpenAIClient extends BaseLLMClient {
  provider: LLMProvider = 'openai';
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model = 'gpt-4-turbo-preview'; // 또는 'gpt-4o'

  async analyzeComment(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>,
    existingKeywords?: string[],
    codeContext?: { filePath: string; lines: string; startLine?: number; endLine?: number; }
  ): Promise<LLMResponse> {
    // Feature 2: 캐시를 활용한 분석 (replies 포함, 기존 키워드 전달)
    return this.analyzeWithCache(content, codeExamples, replies, existingKeywords, codeContext);
  }

  protected async callAnalysisAPI(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>,
    existingKeywords?: string[],
    codeContext?: { filePath: string; lines: string; startLine?: number; endLine?: number; }
  ): Promise<LLMResponse> {
    try {

      const { result, tokenUsage } = await this.retry(() =>
        this.withTimeout(this.callAPIInternal(content, codeExamples, replies, existingKeywords, codeContext))
      );

      return { success: true, data: result, tokenUsage };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async callAPIInternal(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>,
    existingKeywords?: string[],
    codeContext?: { filePath: string; lines: string; startLine?: number; endLine?: number; }
  ): Promise<{ result: LLMAnalysisResult; tokenUsage: TokenUsage }> {
    const prompt = buildAnalysisPrompt(content, codeExamples, replies, existingKeywords, codeContext);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2048,
        temperature: 0.3,
        response_format: { type: 'json_object' } // JSON 모드 활성화
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        errorData.error?.message || `API error: ${response.status}`,
        'openai',
        response.status
      );
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;

    if (!textContent) {
      throw new LLMError('Empty response from OpenAI API', 'openai');
    }

    // 토큰 사용량 추출 (OpenAI API response format)
    const tokenUsage: TokenUsage = {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    };

    // JSON 파싱
    const parsed = this.parseJSON(textContent);

    // 타입 검증
    if (!parsed.summary || !parsed.detailedExplanation) {
      throw new LLMError('Invalid response format from OpenAI API', 'openai');
    }

    const result: LLMAnalysisResult = {
      summary: parsed.summary,
      detailedExplanation: parsed.detailedExplanation,
      codeExplanations: parsed.codeExplanations || [],
      additionalKeywords: parsed.additionalKeywords || [],
      suggestedCategory: parsed.suggestedCategory,
      reasoning: parsed.reasoning || {
        detectedIntent: [],
        keyPhrases: [],
        codeReferences: [],
        confidenceScore: 50
      }
    };

    return { result, tokenUsage };
  }

  /**
   * 파일명 생성 (AI 기반)
   */
  async generateFileName(prompt: string): Promise<string> {
    try {
      const response = await this.retry(() =>
        this.withTimeout(this.callFileNamingAPI(prompt))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  private async callFileNamingAPI(prompt: string): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at organizing code conventions and documentation. Generate concise, descriptive filenames following best practices.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1024,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        errorData.error?.message || `API error: ${response.status}`,
        'openai',
        response.status
      );
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;

    if (!textContent) {
      throw new LLMError('Empty response from OpenAI API', 'openai');
    }

    return textContent;
  }

  /**
   * 범용 텍스트 생성
   */
  async generateText(prompt: string, options?: {
    max_tokens?: number;
    temperature?: number;
    system?: string;
  }): Promise<string> {
    try {
      const response = await this.retry(() =>
        this.withTimeout(this.callTextGenerationAPI(prompt, options))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  private async callTextGenerationAPI(prompt: string, options?: {
    max_tokens?: number;
    temperature?: number;
    system?: string;
  }): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: options?.system || 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: options?.max_tokens || 1024,
        temperature: options?.temperature ?? 1.0
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        errorData.error?.message || `API error: ${response.status}`,
        'openai',
        response.status
      );
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;

    if (!textContent) {
      throw new LLMError('Empty response from OpenAI API', 'openai');
    }

    return textContent;
  }

  /**
   * 유사도 검사 API 호출 (Phase 1: 중복 파일 방지)
   */
  protected async callSimilarityAPI(
    existingContent: string,
    newContent: string
  ): Promise<SimilarityCheckResult> {
    const prompt = buildSimilarityCheckPrompt(existingContent, newContent);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a code convention comparison expert.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 512,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        errorData.error?.message || `API error: ${response.status}`,
        'openai',
        response.status
      );
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;

    if (!textContent) {
      throw new LLMError('Empty response from OpenAI API', 'openai');
    }

    // JSON 파싱
    const parsed = this.parseJSON(textContent);

    // 타입 검증
    if (typeof parsed.similarity !== 'number' || !parsed.decision || !parsed.reasoning) {
      throw new LLMError('Invalid similarity check response format', 'openai');
    }

    // 토큰 사용량 추출
    const tokenUsage: TokenUsage = {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    };

    return {
      success: true,
      data: {
        similarity: parsed.similarity,
        decision: parsed.decision,
        reasoning: parsed.reasoning
      },
      tokenUsage
    };
  }

  /**
   * 병합 API 호출 (Phase 1: 파일 병합)
   */
  protected async callMergeAPI(
    existingContent: string,
    newContent: string
  ): Promise<string> {
    const prompt = buildMergeInstructionsPrompt(existingContent, newContent);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at merging code review conventions intelligently.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2048,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        errorData.error?.message || `API error: ${response.status}`,
        'openai',
        response.status
      );
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;

    if (!textContent) {
      throw new LLMError('Empty response from OpenAI API', 'openai');
    }

    // 병합된 내용 그대로 반환 (JSON 아님)
    return textContent;
  }
}

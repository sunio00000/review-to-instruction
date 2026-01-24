/**
 * Claude API 클라이언트
 */

import { BaseLLMClient } from './base-client';
import type { LLMProvider, LLMResponse, LLMAnalysisResult, TokenUsage } from './types';
import { LLMError } from './types';
import { buildAnalysisPrompt, SYSTEM_PROMPT } from './prompts';

export class ClaudeClient extends BaseLLMClient {
  provider: LLMProvider = 'claude';
  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';
  private readonly model = 'claude-sonnet-4-5-20250929'; // 최신 모델

  async analyzeComment(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>,
    existingKeywords?: string[]
  ): Promise<LLMResponse> {
    // Feature 2: 캐시를 활용한 분석 (replies 포함, 기존 키워드 전달)
    return this.analyzeWithCache(content, codeExamples, replies, existingKeywords);
  }

  protected async callAnalysisAPI(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>,
    existingKeywords?: string[]
  ): Promise<LLMResponse> {
    try {

      const { result, tokenUsage } = await this.retry(() =>
        this.withTimeout(this.callAPIInternal(content, codeExamples, replies, existingKeywords))
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
    existingKeywords?: string[]
  ): Promise<{ result: LLMAnalysisResult; tokenUsage: TokenUsage }> {
    const prompt = buildAnalysisPrompt(content, codeExamples, replies, existingKeywords);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        system: SYSTEM_PROMPT
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        errorData.error?.message || `API error: ${response.status}`,
        'claude',
        response.status
      );
    }

    const data = await response.json();
    const textContent = data.content?.[0]?.text;

    if (!textContent) {
      throw new LLMError('Empty response from Claude API', 'claude');
    }

    // 토큰 사용량 추출 (Claude API response format)
    const tokenUsage: TokenUsage = {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    };

    // JSON 파싱
    const parsed = this.parseJSON(textContent);

    // 타입 검증
    if (!parsed.summary || !parsed.detailedExplanation) {
      throw new LLMError('Invalid response format from Claude API', 'claude');
    }

    const result: LLMAnalysisResult = {
      summary: parsed.summary,
      detailedExplanation: parsed.detailedExplanation,
      codeExplanations: parsed.codeExplanations || [],
      additionalKeywords: parsed.additionalKeywords || [],
      suggestedCategory: parsed.suggestedCategory
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
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        system: 'You are an expert at organizing code conventions and documentation. Generate concise, descriptive filenames following best practices.'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        errorData.error?.message || `API error: ${response.status}`,
        'claude',
        response.status
      );
    }

    const data = await response.json();
    const textContent = data.content?.[0]?.text;

    if (!textContent) {
      throw new LLMError('Empty response from Claude API', 'claude');
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
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.max_tokens || 1024,
        temperature: options?.temperature ?? 1.0,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        system: options?.system || 'You are a helpful assistant.'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        errorData.error?.message || `API error: ${response.status}`,
        'claude',
        response.status
      );
    }

    const data = await response.json();
    const textContent = data.content?.[0]?.text;

    if (!textContent) {
      throw new LLMError('Empty response from Claude API', 'claude');
    }

    return textContent;
  }
}

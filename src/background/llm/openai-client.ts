/**
 * OpenAI API 클라이언트
 */

import { BaseLLMClient } from './base-client';
import type { LLMProvider, LLMResponse, LLMAnalysisResult, TokenUsage } from './types';
import { LLMError } from './types';
import { buildAnalysisPrompt, SYSTEM_PROMPT } from './prompts';

export class OpenAIClient extends BaseLLMClient {
  provider: LLMProvider = 'openai';
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model = 'gpt-4-turbo-preview'; // 또는 'gpt-4o'

  async analyzeComment(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>
  ): Promise<LLMResponse> {
    // Feature 2: 캐시를 활용한 분석 (replies 포함)
    return this.analyzeWithCache(content, codeExamples, replies);
  }

  protected async callAnalysisAPI(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>
  ): Promise<LLMResponse> {
    try {

      const { result, tokenUsage } = await this.retry(() =>
        this.withTimeout(this.callAPIInternal(content, codeExamples, replies))
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
    replies?: Array<{ author: string; content: string; createdAt: string; }>
  ): Promise<{ result: LLMAnalysisResult; tokenUsage: TokenUsage }> {
    const prompt = buildAnalysisPrompt(content, codeExamples, replies);

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
}

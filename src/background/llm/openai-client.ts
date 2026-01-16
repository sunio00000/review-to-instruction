/**
 * OpenAI API 클라이언트
 */

import { BaseLLMClient } from './base-client';
import type { LLMProvider, LLMResponse, LLMAnalysisResult } from './types';
import { LLMError } from './types';
import { buildAnalysisPrompt, SYSTEM_PROMPT } from './prompts';

export class OpenAIClient extends BaseLLMClient {
  provider: LLMProvider = 'openai';
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model = 'gpt-4-turbo-preview'; // 또는 'gpt-4o'

  async analyzeComment(content: string, codeExamples: string[]): Promise<LLMResponse> {
    console.log('[OpenAIClient] Analyzing comment (with cache)...');
    // Feature 2: 캐시를 활용한 분석
    return this.analyzeWithCache(content, codeExamples);
  }

  protected async callAnalysisAPI(content: string, codeExamples: string[]): Promise<LLMResponse> {
    try {
      console.log('[OpenAIClient] Calling OpenAI API...');

      const result = await this.retry(() =>
        this.withTimeout(this.callAPIInternal(content, codeExamples))
      );

      console.log('[OpenAIClient] API call complete');
      return { success: true, data: result };

    } catch (error) {
      console.error('[OpenAIClient] API call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async callAPIInternal(content: string, codeExamples: string[]): Promise<LLMAnalysisResult> {
    const prompt = buildAnalysisPrompt(content, codeExamples);

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

    // JSON 파싱
    const parsed = this.parseJSON(textContent);

    // 타입 검증
    if (!parsed.summary || !parsed.detailedExplanation) {
      throw new LLMError('Invalid response format from OpenAI API', 'openai');
    }

    return {
      summary: parsed.summary,
      detailedExplanation: parsed.detailedExplanation,
      codeExplanations: parsed.codeExplanations || [],
      additionalKeywords: parsed.additionalKeywords || [],
      suggestedCategory: parsed.suggestedCategory
    };
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
      console.error('[OpenAIClient] File naming API failed:', error);
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
}

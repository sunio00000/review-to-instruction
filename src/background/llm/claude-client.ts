/**
 * Claude API 클라이언트
 */

import { BaseLLMClient } from './base-client';
import type { LLMProvider, LLMResponse, LLMAnalysisResult } from './types';
import { LLMError } from './types';
import { buildAnalysisPrompt, SYSTEM_PROMPT } from './prompts';

export class ClaudeClient extends BaseLLMClient {
  provider: LLMProvider = 'claude';
  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';
  private readonly model = 'claude-sonnet-4-5-20250929'; // 최신 모델

  async analyzeComment(content: string, codeExamples: string[]): Promise<LLMResponse> {
    console.log('[ClaudeClient] Analyzing comment (with cache)...');
    // Feature 2: 캐시를 활용한 분석
    return this.analyzeWithCache(content, codeExamples);
  }

  protected async callAnalysisAPI(content: string, codeExamples: string[]): Promise<LLMResponse> {
    try {
      console.log('[ClaudeClient] Calling Claude API...');

      const result = await this.retry(() =>
        this.withTimeout(this.callAPIInternal(content, codeExamples))
      );

      console.log('[ClaudeClient] API call complete');
      return { success: true, data: result };

    } catch (error) {
      console.error('[ClaudeClient] API call failed:', error);
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
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
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

    // JSON 파싱
    const parsed = this.parseJSON(textContent);

    // 타입 검증
    if (!parsed.summary || !parsed.detailedExplanation) {
      throw new LLMError('Invalid response format from Claude API', 'claude');
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
      console.error('[ClaudeClient] File naming API failed:', error);
      throw error;
    }
  }

  private async callFileNamingAPI(prompt: string): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
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
}

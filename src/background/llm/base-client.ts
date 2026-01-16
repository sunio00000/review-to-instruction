/**
 * LLM 클라이언트 추상 베이스 클래스
 * Feature 2: 캐시 통합
 */

import type { ILLMClient, LLMProvider, LLMResponse } from './types';
import { llmCache } from './cache';

export abstract class BaseLLMClient implements ILLMClient {
  abstract provider: LLMProvider;
  protected apiKey: string;
  protected timeout: number = 30000; // 30초 타임아웃

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  abstract analyzeComment(content: string, codeExamples: string[]): Promise<LLMResponse>;

  /**
   * 캐시를 활용한 분석 (Feature 2)
   * - Protected: 하위 클래스에서 analyzeComment()에서 호출
   */
  protected async analyzeWithCache(
    content: string,
    codeExamples: string[]
  ): Promise<LLMResponse> {
    try {
      // 1. 캐시 키 생성
      const cacheKey = await llmCache.generateCacheKey(content, codeExamples, this.provider);

      // 2. 캐시 조회
      const cachedData = await llmCache.get(cacheKey);

      if (cachedData) {
        // 캐시 HIT - LLMResponse 형식으로 반환
        console.log('[BaseLLMClient] Cache HIT, returning cached result');
        return {
          success: true,
          data: cachedData
        };
      }

      // 3. 캐시 MISS - API 호출
      console.log('[BaseLLMClient] Cache MISS, calling API');
      const response = await this.callAnalysisAPI(content, codeExamples);

      // 4. 응답 캐싱 (성공한 경우만)
      if (response.success && response.data) {
        await llmCache.set(cacheKey, response.data, this.provider);
        console.log('[BaseLLMClient] Response cached');
      }

      // 5. 반환
      return response;

    } catch (error) {
      console.error('[BaseLLMClient] Error in analyzeWithCache:', error);
      // 캐시 실패 시 API 직접 호출 (Fail-safe)
      return this.callAnalysisAPI(content, codeExamples);
    }
  }

  /**
   * 실제 API 호출 (추상 메서드)
   * - Protected: 하위 클래스에서 구현
   * - 기존 analyzeComment의 API 호출 로직을 여기로 이동
   */
  protected abstract callAnalysisAPI(
    content: string,
    codeExamples: string[]
  ): Promise<LLMResponse>;

  /**
   * 타임아웃 래퍼
   */
  protected async withTimeout<T>(promise: Promise<T>, ms: number = this.timeout): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), ms)
      )
    ]);
  }

  /**
   * 재시도 로직 (최대 2회)
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 2
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        console.warn(`[LLM] Attempt ${attempt + 1} failed:`, error);

        // 마지막 시도면 에러 던지기
        if (attempt === maxRetries) {
          throw lastError;
        }

        // 지수 백오프 (1초, 2초)
        await this.sleep(1000 * Math.pow(2, attempt));
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * JSON 파싱 헬퍼
   */
  protected parseJSON(text: string): any {
    // 마크다운 코드 블록 제거
    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('[LLM] JSON parse error:', error);
      throw new Error('Failed to parse LLM response as JSON');
    }
  }
}

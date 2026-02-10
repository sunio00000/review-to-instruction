/**
 * LLM 클라이언트 추상 베이스 클래스
 * Feature 2: 캐시 통합
 */

import type { ILLMClient, LLMProvider, LLMResponse } from './types';
import { llmCache } from './cache';
import { RateLimiter } from '../../utils/rate-limiter';

export abstract class BaseLLMClient implements ILLMClient {
  abstract provider: LLMProvider;
  protected apiKey: string;
  protected timeout: number = 30000; // 30초 타임아웃
  protected rateLimiter: RateLimiter;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.rateLimiter = new RateLimiter(10, 60000); // 분당 10회 제한
  }

  abstract analyzeComment(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>,
    existingKeywords?: string[],
    codeContext?: { filePath: string; lines: string; startLine?: number; endLine?: number; }
  ): Promise<LLMResponse>;

  /**
   * 파일명 생성 (AI 기반)
   */
  abstract generateFileName(prompt: string): Promise<string>;

  /**
   * 범용 텍스트 생성 (AI 기반)
   * - 디렉토리 제안, 코드 설명 등 다양한 용도로 사용
   */
  abstract generateText(prompt: string, options?: {
    max_tokens?: number;
    temperature?: number;
    system?: string;
  }): Promise<string>;

  /**
   * 캐시를 활용한 분석 (Feature 2: 답글 포함, 기존 키워드 전달)
   * - Protected: 하위 클래스에서 analyzeComment()에서 호출
   */
  protected async analyzeWithCache(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>,
    existingKeywords?: string[],
    codeContext?: { filePath: string; lines: string; startLine?: number; endLine?: number; }
  ): Promise<LLMResponse> {
    try {
      // 1. 캐시 키 생성 (replies + existingKeywords + codeContext 포함)
      const cacheKey = await llmCache.generateCacheKey(
        content + (replies ? JSON.stringify(replies) : '') + (existingKeywords ? JSON.stringify(existingKeywords) : '') + (codeContext ? JSON.stringify(codeContext) : ''),
        codeExamples,
        this.provider
      );

      // 2. 캐시 조회
      const cachedData = await llmCache.get(cacheKey);

      if (cachedData) {
        // 캐시 HIT - LLMResponse 형식으로 반환 (rate limit 체크 불필요)
        return {
          success: true,
          data: cachedData
        };
      }

      // 3. Rate limiting 체크 (캐시 MISS인 경우만)
      if (!this.rateLimiter.tryRequest()) {
        const timeUntilReset = Math.ceil(this.rateLimiter.getTimeUntilReset() / 1000);
        return {
          success: false,
          error: `Rate limit exceeded. Please wait ${timeUntilReset} seconds before trying again.`
        };
      }

      // 4. 캐시 MISS - API 호출
      const response = await this.callAnalysisAPI(content, codeExamples, replies, existingKeywords, codeContext);

      // 5. 응답 캐싱 (성공한 경우만)
      if (response.success && response.data) {
        await llmCache.set(cacheKey, response.data, this.provider);
      }

      // 6. 반환
      return response;

    } catch (error) {
      // 캐시 실패 시 API 직접 호출 (Fail-safe)
      return this.callAnalysisAPI(content, codeExamples, replies, existingKeywords, codeContext);
    }
  }

  /**
   * 실제 API 호출 (추상 메서드)
   * - Protected: 하위 클래스에서 구현
   * - 기존 analyzeComment의 API 호출 로직을 여기로 이동
   */
  protected abstract callAnalysisAPI(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>,
    existingKeywords?: string[],
    codeContext?: { filePath: string; lines: string; startLine?: number; endLine?: number; }
  ): Promise<LLMResponse>;

  /**
   * 캐시를 활용한 유사도 검사 (Phase 1: 중복 파일 방지)
   */
  protected async checkSimilarityWithCache(
    existingContent: string,
    newContent: string
  ): Promise<import('./types').SimilarityCheckResult> {
    try {
      // 1. 캐시 키 생성: SHA256(existingContent + newContent + provider)
      const cacheKey = await llmCache.generateCacheKey(
        existingContent + ':similarity:' + newContent,
        [],
        this.provider
      );

      // 2. 캐시 조회
      const cachedData = await llmCache.get(cacheKey);
      if (cachedData) {
        return { success: true, data: cachedData as any };
      }

      // 3. Rate limiting 체크
      if (!this.rateLimiter.tryRequest()) {
        const timeUntilReset = Math.ceil(this.rateLimiter.getTimeUntilReset() / 1000);
        return {
          success: false,
          error: `Rate limit exceeded. Please wait ${timeUntilReset} seconds.`
        };
      }

      // 4. API 호출
      const response = await this.callSimilarityAPI(existingContent, newContent);

      // 5. 캐싱 (30일 TTL, 성공한 경우만)
      if (response.success && response.data) {
        await llmCache.set(cacheKey, response.data as any, this.provider);
      }

      return response;

    } catch (error) {
      return {
        success: false,
        error: `Similarity check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * 실제 유사도 검사 API 호출 (추상 메서드)
   */
  protected abstract callSimilarityAPI(
    existingContent: string,
    newContent: string
  ): Promise<import('./types').SimilarityCheckResult>;

  /**
   * 캐시를 활용한 파일 병합 (Phase 1: 중복 파일 방지)
   */
  protected async mergeInstructionsWithCache(
    existingContent: string,
    newContent: string
  ): Promise<string> {
    // 1. 캐시 키 생성
    const cacheKey = await llmCache.generateCacheKey(
      'merge:' + existingContent + ':' + newContent,
      [],
      this.provider
    );

    // 2. 캐시 조회
    const cachedData = await llmCache.get(cacheKey);
    if (cachedData) {
      return cachedData as unknown as string;
    }

    // 3. Rate limiting 체크
    if (!this.rateLimiter.tryRequest()) {
      const timeUntilReset = Math.ceil(this.rateLimiter.getTimeUntilReset() / 1000);
      throw new Error(`Rate limit exceeded. Please wait ${timeUntilReset} seconds.`);
    }

    // 4. API 호출
    const mergedContent = await this.callMergeAPI(existingContent, newContent);

    // 5. 캐싱 (30일 TTL)
    await llmCache.set(cacheKey, mergedContent as any, this.provider);

    return mergedContent;
  }

  /**
   * 실제 병합 API 호출 (추상 메서드)
   */
  protected abstract callMergeAPI(
    existingContent: string,
    newContent: string
  ): Promise<string>;

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
      throw new Error('Failed to parse LLM response as JSON');
    }
  }
}

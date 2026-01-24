/**
 * LLM 관련 타입 정의
 */

import type { CodeExplanation } from '../../types';

// LLM 제공자 타입
export type LLMProvider = 'claude' | 'openai';

// LLM API 응답
export interface LLMResponse {
  success: boolean;
  data?: LLMAnalysisResult;
  error?: string;
  tokenUsage?: TokenUsage;  // 토큰 사용량 추가
}

// LLM 분석 결과
export interface LLMAnalysisResult {
  summary: string;                      // 코멘트 요약 (1-2문장)
  detailedExplanation: string;         // 상세 설명 (재구성된 코멘트)
  codeExplanations: CodeExplanation[]; // 코드 예시 설명
  additionalKeywords: string[];        // 추가 키워드
  suggestedCategory?: string;          // 제안 카테고리
}

// 토큰 사용량
export interface TokenUsage {
  inputTokens: number;    // 입력 토큰 수
  outputTokens: number;   // 출력 토큰 수
  totalTokens: number;    // 총 토큰 수
}

// LLM 클라이언트 인터페이스
export interface ILLMClient {
  provider: LLMProvider;
  analyzeComment(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>
  ): Promise<LLMResponse>;
  generateText(prompt: string, options?: {
    max_tokens?: number;
    temperature?: number;
    system?: string;
  }): Promise<string>;
}

// LLM API 에러
export class LLMError extends Error {
  constructor(
    message: string,
    public provider: LLMProvider,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
